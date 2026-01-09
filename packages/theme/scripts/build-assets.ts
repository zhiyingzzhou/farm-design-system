/**
 * 构建主题包的静态产物：
 * - 从 `src/finex-ui.json` 产出 dist 可消费的 `{ light, dark }` 扁平结构
 *   - `src/finex-ui.json` 允许两种形态：Token Studio 原始导出（含 base/base + Light/Dark 分组）或已解析好的 `{ light, dark }`
 *   - 推荐用 `scripts/sync-src-assets.ts` 固化为已解析形态，避免在运行时重复做引用解析
 * - 基于 `antd-token-map.json` 生成 `tokens.css/.scss/.less`（变量名以 antd token 为语义）
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
 * 从某个主题分组（Light/Dark）里收集“颜色 token”，输出为 finexKey -> resolvedValue。
 *
 * 注意：
 * - 这里只同步 `type === "color"` 的 token；避免把 Token Studio 里的字号/间距等混进主题色体系
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
      if (value.type !== 'color') continue;
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
 * - key：finexKey（供 adapters 指向）
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
 * antd token -> CSS var name（与 antd `theme.cssVar.prefix` 的规则保持一致）。
 *
 * - prefix = "farm" 时：`colorPrimary` -> `--farm-color-primary`
 */
function tokenToCssVar(token: string, prefix = 'farm'): `--${string}` {
  return `--${prefix ? `${prefix}-` : ''}${token}`
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1-$2')
    .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
    .toLowerCase();
}

function formatCssVarBlock(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

async function main() {
  const [finexUiRaw, antdTokenMapRaw, antdComponentsMapRaw] = await Promise.all([
    fs.readFile(finexUiPath, 'utf8'),
    fs.readFile(antdTokenMapPath, 'utf8'),
    fs.readFile(antdComponentsMapPath, 'utf8')
  ]);

  const finexUi = resolveFinexUi(JSON.parse(finexUiRaw) as unknown);
  const antdTokenMap = JSON.parse(antdTokenMapRaw) as Record<string, string>;
  const antdComponentsMap = JSON.parse(antdComponentsMapRaw) as Record<string, Record<string, string>>;

  // 构建前做一次完整性校验：避免映射表与 Token 源不同步导致产物缺 token
  const finexLight = finexUi.light ?? {};
  const finexDark = finexUi.dark ?? {};

  for (const [antdToken, finexKey] of Object.entries(antdTokenMap)) {
    if (!(finexKey in finexLight)) {
      throw new Error(`antdTokenMap["${antdToken}"] 指向不存在的 finex key "${finexKey}" (light)`);
    }
    if (!(finexKey in finexDark)) {
      throw new Error(`antdTokenMap["${antdToken}"] 指向不存在的 finex key "${finexKey}" (dark)`);
    }
  }

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    for (const [componentToken, finexKey] of Object.entries(tokenMap)) {
      if (!(finexKey in finexLight)) {
        throw new Error(
          `antdComponentsMap["${componentName}"]["${componentToken}"] 指向不存在的 finex key "${finexKey}" (light)`
        );
      }
      if (!(finexKey in finexDark)) {
        throw new Error(
          `antdComponentsMap["${componentName}"]["${componentToken}"] 指向不存在的 finex key "${finexKey}" (dark)`
        );
      }
    }
  }

  function buildTokensCss(): string {
    const lightVars: Record<string, string> = {};
    const darkVars: Record<string, string> = {};

    for (const [antdToken, finexKey] of Object.entries(antdTokenMap)) {
      const varName = tokenToCssVar(antdToken, 'farm');
      lightVars[varName] = finexUi.light[finexKey];
      darkVars[varName] = finexUi.dark[finexKey];
    }

    return [
      '/* Auto-generated by @farm-design-system/theme. */',
      formatCssVarBlock(':root, [data-theme=\"light\"], .light', lightVars),
      formatCssVarBlock('[data-theme=\"dark\"], .dark', darkVars),
      ''
    ].join('\n\n');
  }

  function buildTokensScss(): string {
    const lines = ['/* Auto-generated by @farm-design-system/theme. */', ''];
    for (const antdToken of Object.keys(antdTokenMap)) {
      const varName = tokenToCssVar(antdToken, 'farm');
      const name = varName.replace(/^--farm-/, '');
      lines.push(`$farm-${name}: var(${varName});`);
    }
    lines.push('');
    return lines.join('\n');
  }

  function buildTokensLess(): string {
    const lines = ['/* Auto-generated by @farm-design-system/theme. */', ''];
    for (const antdToken of Object.keys(antdTokenMap)) {
      const varName = tokenToCssVar(antdToken, 'farm');
      const name = varName.replace(/^--farm-/, '');
      lines.push(`@farm-${name}: var(${varName});`);
    }
    lines.push('');
    return lines.join('\n');
  }

  function buildTailwindPreset() {
    const colors: Record<string, string> = {};
    for (const antdToken of Object.keys(antdTokenMap)) {
      const varName = tokenToCssVar(antdToken, 'farm');
      const key = varName.replace(/^--farm-/, '');
      colors[key] = `var(${varName})`;
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

