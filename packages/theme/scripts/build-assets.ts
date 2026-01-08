/**
 * 构建主题包的静态产物：
 * - 从 `src/finex-ui.json` 产出 dist 可消费的 `{ light, dark }` 扁平结构
 *   - `src/finex-ui.json` 允许两种形态：Token Studio 原始导出（含 base/base + Light/Dark 分组）或已解析好的 `{ light, dark }`
 *   - 推荐用 `scripts/sync-src-assets.ts` 固化为已解析形态，避免在运行时重复做引用解析
 * - 基于 farmTokenMap 生成 `tokens.css/.scss/.less`
 * - 生成 Tailwind preset（ESM + CJS）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonRecord = Record<string, unknown>;

type TokenLeaf = {
  value: string;
  type?: string;
};

type FinexUiResolved = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(packageRoot, 'src');
const distRoot = path.join(packageRoot, 'dist');

const finexUiPath = path.join(srcRoot, 'finex-ui.json');
const farmTokenMapPath = path.join(srcRoot, 'adapters', 'farm-token-map.json');
const antdTokenMapPath = path.join(srcRoot, 'adapters', 'antd-token-map.json');
const antdComponentsMapPath = path.join(srcRoot, 'adapters', 'antd-components-map.json');
const tailwindTypesPath = path.join(srcRoot, 'tailwind.d.ts');

/**
 * 判断一个值是否是“普通对象”（JSON Object）。
 * - 排除：`null` / 数组
 * - 用途：把 `JSON.parse()` 得到的 `unknown` 安全收窄，便于递归遍历
 */
function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 判断节点是否是 Token Studio 导出里的“叶子 token”结构。
 *
 * Token Studio 的叶子一般长这样：
 * `{ value: string, type?: string }`
 *
 * 这里仅检查 `value` 为 string：
 * - base/base 中可能包含多种类型 token，是否过滤（例如只取颜色）由更上层逻辑决定
 */
function isTokenLeaf(node: unknown): node is TokenLeaf {
  return isRecord(node) && typeof node.value === 'string';
}

/**
 * 解析 Token Studio 的引用写法：`"{xxx.yyy}"`。
 *
 * - 如果是引用：返回去掉大括号后的路径（例如 `"base.base.Brand.Primary"`）
 * - 如果不是引用（直接值）：返回 `null`
 */
function normalizeRef(value: string): string | null {
  const match = /^\{(.+)\}$/.exec(value.trim());
  return match ? match[1] : null;
}

/**
 * 将一棵 token 树“展平”为 lookup 表：`path.to.token` -> `rawValue`。
 *
 * 规则：
 * - key：用 `.` 拼接层级路径（与 Token Studio 的引用路径保持一致）
 * - value：叶子节点上的 `value`（可能仍是 `"{...}"` 引用）
 *
 * 用途：
 * - base/base 会先展平为 lookup，Light/Dark 中的 token 引用会在这个表里查找并解引用。
 */
function collectTokenValues(
  tree: unknown,
  prefixParts: string[] = [],
  out: Record<string, string> = {}
): Record<string, string> {
  if (!isRecord(tree)) return out;
  for (const [key, value] of Object.entries(tree)) {
    const nextParts = [...prefixParts, key];
    if (isTokenLeaf(value)) {
      out[nextParts.join('.')] = value.value;
      continue;
    }
    if (isRecord(value)) {
      collectTokenValues(value, nextParts, out);
    }
  }
  return out;
}

/**
 * 解析 token 的最终值（主要处理 Token Studio 的引用链）。
 *
 * - 如果 `value` 不是 `"{...}"` 引用：直接返回原值（例如 `#5856d7` / `rgba(...)`）
 * - 如果是引用：递归解析到最终值（支持“引用引用”）
 * - 输入数据异常时会抛错：
 *   - 引用不存在
 *   - 循环引用
 */
function resolveTokenValue(value: string, lookup: Record<string, string>, stack: string[] = []): string {
  const ref = normalizeRef(value);
  if (!ref) return value;
  if (stack.includes(ref)) {
    throw new Error(`finex-ui: 检测到循环引用：${[...stack, ref].join(' -> ')}`);
  }
  const next = lookup[ref];
  if (next === undefined) {
    throw new Error(`finex-ui: 无法解析引用 "{${ref}}"`);
  }
  return resolveTokenValue(next, lookup, [...stack, ref]);
}

/**
 * Token Studio 的层级路径 -> dist 中使用的 finex key
 * - 分组：空白折叠为单个 `-`（例如 "Secondary White  button" -> "Secondary-White-button"）
 * - 叶子：保留空格（例如 "Dark purple"），但折叠多空白为单空格
 */
function toFinexKey(pathParts: string[]): string {
  if (pathParts.length === 0) return '';
  const groups = pathParts
    .slice(0, -1)
    .map((part) => part.trim().replaceAll(/\s+/g, '-'));
  const leaf = pathParts[pathParts.length - 1].trim().replaceAll(/\s+/g, ' ');
  return [...groups, leaf].join('-');
}

/**
 * 从某个主题分组（Light/Dark）里收集 token，输出为 finexKey -> resolvedValue。
 *
 * 注意：
 * - 本脚本最终产物（tokens.css/scss/less）只会消费 `farmTokenMap` 中的 finexKey；
 *   因此即使输入是 Token Studio 原始导出、分组里包含非颜色 token，也不会影响 CSS 变量产物。
 * - 推荐搭配 `scripts/sync-src-assets.ts` 使用：它会先把 `src/finex-ui.json` 固化为“已解析 + 颜色 token”形态，
 *   这里就只是在构建阶段做转换与输出。
 */
function collectThemeTokens(
  tree: unknown,
  baseLookup: Record<string, string>,
  prefixParts: string[] = [],
  out: Record<string, string> = {}
): Record<string, string> {
  if (!isRecord(tree)) return out;
  for (const [key, value] of Object.entries(tree)) {
    const nextParts = [...prefixParts, key];
    if (isTokenLeaf(value)) {
      const finexKey = toFinexKey(nextParts);
      out[finexKey] = resolveTokenValue(value.value, baseLookup);
      continue;
    }
    if (isRecord(value)) {
      collectThemeTokens(value, baseLookup, nextParts, out);
    }
  }
  return out;
}

/**
 * 将 `src/finex-ui.json` 统一解析成 `{ light, dark }` 的扁平结构。
 *
 * 支持两种输入：
 * 1) Token Studio 原始导出：顶层 key 类似 `base/base`、`xxx/Light`、`xxx/Dark`
 * 2) 已解析产物：`{ light: Record<string,string>, dark: Record<string,string> }`
 *
 * 返回值约定：
 * - key：finexKey（供 `farm-token-map.json` 指向）
 * - value：最终色值（已解引用）
 */
function resolveFinexUi(raw: unknown): FinexUiResolved {
  if (isRecord(raw) && isRecord(raw.light) && isRecord(raw.dark)) return raw as FinexUiResolved;
  if (!isRecord(raw)) {
    throw new Error('finex-ui: finex-ui.json 格式不正确');
  }

  const base = raw['base/base'];
  if (!isRecord(base)) {
    throw new Error('finex-ui: 缺少 base/base，无法解析 Token Studio 导出的 JSON');
  }

  const keys = Object.keys(raw);
  const lightGroupKey = keys.find((k) => /\/Light$/.test(k));
  const darkGroupKey = keys.find((k) => /\/Dark$/.test(k));

  if (!lightGroupKey || !darkGroupKey) {
    throw new Error('finex-ui: 未找到以 "/Light" 或 "/Dark" 结尾的主题分组');
  }

  const baseLookup = collectTokenValues(base);
  const light = collectThemeTokens(raw[lightGroupKey], baseLookup);
  const dark = collectThemeTokens(raw[darkGroupKey], baseLookup);

  return { light, dark };
}

/**
 * Token 名称校验：
 * - 允许：`a-z` / `0-9` / `-`
 * - 支持分段：`xxx.yyy`（为未来扩展预留）
 */
function isValidTokenName(token: string): boolean {
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(token);
}

/**
 * 将 Farm Token 转为 CSS 变量名。
 *
 * 约定：
 * - 对外统一以 `--farm-` 作为命名空间，避免与业务/第三方变量冲突
 * - `.` 会被替换为 `-`，保证 CSS 变量名合法
 */
function cssVarName(token: string): `--farm-${string}` {
  return `--farm-${token.replaceAll('.', '-')}`;
}

/**
 * 把若干 CSS 变量输出成一个选择器块。
 *
 * 说明：
 * - 排序由 `vars` 的插入顺序决定；这里的上游是 `farm-token-map.json`（脚本生成且稳定），因此产物 diff 不会抖动。
 */
function formatCssVarBlock(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * 构建脚本入口：
 * 1) 读取 `src/finex-ui.json` 与 adapters 映射（均由 `sync-src-assets.ts` 生成）
 * 2) 基于 Farm Token 生成 CSS/SCSS/LESS 变量产物
 * 3) 生成 Tailwind preset（ESM + CJS）
 * 4) 将 adapters 与 `tailwind.d.ts` 一并复制到 dist，保证下游“开箱即用”
 */
async function main() {
  const [finexUiRaw, farmTokenMapRaw, antdTokenMapRaw, antdComponentsMapRaw] = await Promise.all([
    fs.readFile(finexUiPath, 'utf8'),
    fs.readFile(farmTokenMapPath, 'utf8'),
    fs.readFile(antdTokenMapPath, 'utf8'),
    fs.readFile(antdComponentsMapPath, 'utf8')
  ]);

  const finexUi = resolveFinexUi(JSON.parse(finexUiRaw) as unknown);
  const farmTokenMap = JSON.parse(farmTokenMapRaw) as Record<string, string>;
  const antdTokenMap = JSON.parse(antdTokenMapRaw) as Record<string, string>;
  const antdComponentsMap = JSON.parse(antdComponentsMapRaw) as Record<string, Record<string, string>>;

  // 构建前做一次完整性校验：避免映射表与 Token 源不同步导致产物缺 token
  const finexLight = finexUi.light ?? {};
  const finexDark = finexUi.dark ?? {};

  for (const [token, finexKey] of Object.entries(farmTokenMap)) {
    if (!isValidTokenName(token)) {
      throw new Error(`非法 token 名称 "${token}"`);
    }
    if (!(finexKey in finexLight)) {
      throw new Error(`farmTokenMap["${token}"] 指向不存在的 finex key "${finexKey}" (light)`);
    }
    if (!(finexKey in finexDark)) {
      throw new Error(`farmTokenMap["${token}"] 指向不存在的 finex key "${finexKey}" (dark)`);
    }
  }

  for (const [antdToken, token] of Object.entries(antdTokenMap)) {
    if (!(token in farmTokenMap)) {
      throw new Error(`antdTokenMap["${antdToken}"] 指向不存在的 Farm Token "${token}"`);
    }
  }

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    for (const [componentToken, token] of Object.entries(tokenMap)) {
      if (!(token in farmTokenMap)) {
        throw new Error(`antdComponentsMap["${componentName}"]["${componentToken}"] 指向不存在的 Farm Token "${token}"`);
      }
    }
  }

  /**
   * 生成 `dist/tokens.css`：
   * - light：`:root, [data-theme="light"], .light`
   * - dark：`[data-theme="dark"], .dark`
   *
   * 这样做的好处：
   * - 既支持“属性切换”（业务常用 `data-theme`），也支持“类名切换”（部分站点/老项目）
   * - 不依赖任何运行时 JS，纯 CSS 即可生效
   */
  function buildTokensCss(): string {
    const lightVars: Record<string, string> = {};
    const darkVars: Record<string, string> = {};

    for (const [token, finexKey] of Object.entries(farmTokenMap)) {
      const varName = cssVarName(token);
      lightVars[varName] = finexUi.light[finexKey];
      darkVars[varName] = finexUi.dark[finexKey];
    }

    return [
      '/* Auto-generated by @farm-design-system/theme. */',
      formatCssVarBlock(':root, [data-theme="light"], .light', lightVars),
      formatCssVarBlock('[data-theme="dark"], .dark', darkVars),
      ''
    ].join('\n\n');
  }

  /**
   * 生成 `dist/tokens.scss`：
   * - 输出 `$farm-xxx: var(--farm-xxx);`
   * - 目的是让 Sass 项目里可以用变量名获得更好的可读性（本质仍是引用 CSS 变量）
   */
  function buildTokensScss(): string {
    const lines = ['/* Auto-generated by @farm-design-system/theme. */', ''];
    for (const token of Object.keys(farmTokenMap)) {
      const varName = cssVarName(token);
      const scssName = token.replaceAll('.', '-');
      lines.push(`$farm-${scssName}: var(${varName});`);
    }
    lines.push('');
    return lines.join('\n');
  }

  /**
   * 生成 `dist/tokens.less`：
   * - 输出 `@farm-xxx: var(--farm-xxx);`
   * - 与 scss 一样，只做“变量别名”，不复制一份颜色值（避免多处真值导致不一致）
   */
  function buildTokensLess(): string {
    const lines = ['/* Auto-generated by @farm-design-system/theme. */', ''];
    for (const token of Object.keys(farmTokenMap)) {
      const varName = cssVarName(token);
      const lessName = token.replaceAll('.', '-');
      lines.push(`@farm-${lessName}: var(${varName});`);
    }
    lines.push('');
    return lines.join('\n');
  }

  /**
   * 给对象按路径写入值（用于拼 Tailwind 的 `theme.extend.colors`）。
   *
   * 示例：
   * - pathParts = ["button", "primary"]
   * - value = "var(--farm-button-primary)"
   * 结果：`obj.button.primary = value`
   */
  function setNestedValue(obj: Record<string, unknown>, pathParts: string[], value: string): void {
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < pathParts.length - 1; i += 1) {
      const key = pathParts[i]!;
      const next = current[key];
      if (!next || typeof next !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[pathParts[pathParts.length - 1]!] = value;
  }

  /**
   * 生成 Tailwind preset（只包含颜色扩展）。
   *
   * 输出形态：
   * ```ts
   * {
   *   theme: {
   *     extend: {
   *       colors: { farm: { ... } }
   *     }
   *   }
   * }
   * ```
   *
   * 约定：
   * - `farm.xxx` 的值永远是 `var(--farm-xxx)`，切换主题时 Tailwind 颜色会跟着 CSS 变量一起变
   * - 不做 Tailwind 其它能力的定制（spacing/font/radius 等），避免主题包侵入项目构建配置
   */
  function buildTailwindPreset() {
    const colors: Record<string, unknown> = {};
    for (const token of Object.keys(farmTokenMap)) {
      const pathParts = token.split('.');
      setNestedValue(colors, pathParts, `var(${cssVarName(token)})`);
    }

    return {
      theme: {
        extend: {
          colors: {
            farm: colors
          }
        }
      }
    } as const;
  }

  await fs.mkdir(distRoot, { recursive: true });
  await fs.mkdir(path.join(distRoot, 'adapters'), { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(distRoot, 'finex-ui.json'), JSON.stringify(finexUi, null, 2), 'utf8'),
    fs.copyFile(farmTokenMapPath, path.join(distRoot, 'adapters', 'farm-token-map.json')),
    fs.copyFile(antdTokenMapPath, path.join(distRoot, 'adapters', 'antd-token-map.json')),
    fs.copyFile(antdComponentsMapPath, path.join(distRoot, 'adapters', 'antd-components-map.json')),
    fs.copyFile(tailwindTypesPath, path.join(distRoot, 'tailwind.d.ts')),
    fs.writeFile(path.join(distRoot, 'tokens.css'), buildTokensCss(), 'utf8'),
    fs.writeFile(path.join(distRoot, 'tokens.scss'), buildTokensScss(), 'utf8'),
    fs.writeFile(path.join(distRoot, 'tokens.less'), buildTokensLess(), 'utf8')
  ]);

  const preset = buildTailwindPreset();
  const presetJson = JSON.stringify(preset, null, 2);
  const colorsJson = JSON.stringify(preset.theme.extend.colors.farm, null, 2);

  await Promise.all([
    fs.writeFile(
      path.join(distRoot, 'tailwind-preset.js'),
      [
        '/* Auto-generated by @farm-design-system/theme. */',
        `export const tailwindColors = ${colorsJson};`,
        `export const tailwindPreset = ${presetJson};`,
        'export default tailwindPreset;',
        ''
      ].join('\n'),
      'utf8'
    ),
    fs.writeFile(
      path.join(distRoot, 'tailwind-preset.cjs'),
      [
        '/* Auto-generated by @farm-design-system/theme. */',
        `const tailwindColors = ${colorsJson};`,
        `const tailwindPreset = ${presetJson};`,
        'module.exports = tailwindPreset;',
        'module.exports.tailwindPreset = tailwindPreset;',
        'module.exports.tailwindColors = tailwindColors;',
        ''
      ].join('\n'),
      'utf8'
    )
  ]);
}

await main();
