/**
 * 同步 `src` 下的静态资产（供编译与运行时消费）：
 * - `scripts/finex-ui.json`：Token Studio 从 Figma 导出的原始 JSON（含 base/base + Light/Dark 分组）
 * - `src/finex-ui.json`：解析后的 `{ light, dark }` 扁平结构（运行时直接消费，避免重复做引用解析）
 * - `src/adapters/antd-token-map.json`：Ant Design 全局 Token -> finex key（用于全局 token 覆盖）
 * - `src/adapters/antd-components-map.json`：Ant Design 组件级 Token -> finex key（用于组件细化覆盖，例如 Button 状态色）
 *
 * 约定：
 * - 这几个文件都由脚本生成，避免手工维护时出现 token 漏配/拼写差异。
 * - 如需调整映射规则：改 `scripts/finex-to-antd-map.ts`
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { antdComponentTokenFinexMap, antdTokenFinexMap, type FinexKeyCandidates } from './finex-to-antd-map';

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
const scriptsRoot = path.join(packageRoot, 'scripts');
const srcRoot = path.join(packageRoot, 'src');

const tokenStudioExportPath = path.join(scriptsRoot, 'finex-ui.json');
const srcFinexUiPath = path.join(srcRoot, 'finex-ui.json');
const adaptersRoot = path.join(srcRoot, 'adapters');
const antdTokenMapPath = path.join(adaptersRoot, 'antd-token-map.json');
const antdComponentsMapPath = path.join(adaptersRoot, 'antd-components-map.json');

/**
 * 判断一个值是否是“普通对象”（JSON Object）。
 * - 排除：`null` / 数组
 * - 用途：把 `JSON.parse()` 得到的 `unknown` 安全收窄，便于后续递归遍历
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
 * - 因为 base/base 里可能包含非颜色 token（text/number 等），类型过滤放到更靠近业务语义的位置处理
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
 * - `base/base` 会被先展平为 lookup，供 Light/Dark 中的 token 解析引用时查找。
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
    throw new Error(`sync-src-assets: 检测到循环引用：${[...stack, ref].join(' -> ')}`);
  }
  const next = lookup[ref];
  if (next === undefined) {
    throw new Error(`sync-src-assets: 无法解析引用 "{${ref}}"`);
  }
  return resolveTokenValue(next, lookup, [...stack, ref]);
}

/**
 * Token Studio 的层级路径 -> 扁平 key（与 `src/tokens.ts` 保持一致）
 * - 分组：空白折叠为单个 `-`
 * - 叶子：保留空格（只折叠多空白为单空格）
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
 * - value 允许引用 base/base 的 token，会用 `baseLookup` 解析到最终色值
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
      // 这里只同步颜色类 token；避免把 Token Studio 里的 text/number 等类型混进主题色体系
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
 * 将 `scripts/finex-ui.json` 统一解析成 `{ light, dark }` 的扁平结构。
 *
 * 支持两种输入：
 * 1) Token Studio 原始导出：顶层 key 类似 `base/base`、`xxx/Light`、`xxx/Dark`
 * 2) 已解析产物：`{ light: Record<string,string>, dark: Record<string,string> }`
 *
 * 返回值约定：
 * - key：finexKey（用于后续适配层映射）
 * - value：最终色值（已解引用）
 */
function resolveFinexUi(raw: unknown): FinexUiResolved {
  // 允许直接写入 resolved 产物（例如手工维护或从别处复制）
  if (isRecord(raw) && isRecord(raw.light) && isRecord(raw.dark)) return raw as FinexUiResolved;
  if (!isRecord(raw)) {
    throw new Error('sync-src-assets: finex-ui.json 格式不正确');
  }

  const base = raw['base/base'];
  if (!isRecord(base)) {
    throw new Error('sync-src-assets: 缺少 base/base，无法解析 Token Studio 导出的 JSON');
  }

  const keys = Object.keys(raw);
  const lightGroupKey = keys.find((k) => /\/Light$/.test(k));
  const darkGroupKey = keys.find((k) => /\/Dark$/.test(k));

  if (!lightGroupKey || !darkGroupKey) {
    throw new Error('sync-src-assets: 未找到以 "/Light" 或 "/Dark" 结尾的主题分组');
  }

  const baseLookup = collectTokenValues(base);
  const light = collectThemeTokens(raw[lightGroupKey], baseLookup);
  const dark = collectThemeTokens(raw[darkGroupKey], baseLookup);

  return { light, dark };
}

function normalizeCandidates(value: FinexKeyCandidates): string[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * 从候选 finex key 中挑一个“确实存在于当前 finexUi” 的 key。
 *
 * - 找不到时直接抛错，避免悄悄回退到 antd 默认值导致 UI 割裂
 */
function pickFinexKey(available: Set<string>, candidates: FinexKeyCandidates, label: string): string {
  const list = normalizeCandidates(candidates);
  for (const key of list) {
    if (available.has(key)) return key;
  }
  throw new Error(`sync-src-assets: 无法为 "${label}" 找到可用的 finex key（候选：${list.join(', ')}）`);
}

function buildAntdTokenMap(available: Set<string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [antdToken, candidates] of Object.entries(antdTokenFinexMap)) {
    result[antdToken] = pickFinexKey(available, candidates, `token.${antdToken}`);
  }
  return result;
}

function buildAntdComponentsMap(available: Set<string>): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const [componentName, tokenMap] of Object.entries(antdComponentTokenFinexMap)) {
    const componentTokens: Record<string, string> = {};
    for (const [componentToken, candidates] of Object.entries(tokenMap)) {
      componentTokens[componentToken] = pickFinexKey(available, candidates, `components.${componentName}.${componentToken}`);
    }
    result[componentName] = componentTokens;
  }
  return result;
}

/**
 * 脚本入口：把 Token Studio 导出同步成“运行时/构建可直接消费”的文件。
 *
 * 产物：
 * - `src/finex-ui.json`：{ light, dark } 扁平结构（运行时直接读）
 * - `src/adapters/antd-token-map.json`：antd 全局 token -> finex key
 * - `src/adapters/antd-components-map.json`：antd 组件级 token -> finex key
 *
 * 约束：
 * - Light/Dark 必须拥有同一套 finexKey；如果不一致通常是设计侧数据问题，这里会直接抛错，避免悄悄丢 token。
 */
async function main() {
  const raw = JSON.parse(await fs.readFile(tokenStudioExportPath, 'utf8')) as unknown;
  const finexUi = resolveFinexUi(raw);

  await fs.mkdir(adaptersRoot, { recursive: true });

  await fs.writeFile(srcFinexUiPath, JSON.stringify(finexUi, null, 2) + '\n', 'utf8');

  const lightKeys = Object.keys(finexUi.light);
  const darkKeys = Object.keys(finexUi.dark);
  const lightSet = new Set(lightKeys);
  const darkSet = new Set(darkKeys);
  const missingInDark = lightKeys.filter((key) => !darkSet.has(key));
  const missingInLight = darkKeys.filter((key) => !lightSet.has(key));
  if (missingInDark.length > 0 || missingInLight.length > 0) {
    const preview = (items: string[]) => items.slice(0, 10).join(', ');
    const parts = [
      missingInDark.length > 0 ? `dark 缺少：${preview(missingInDark)}${missingInDark.length > 10 ? ' ...' : ''}` : null,
      missingInLight.length > 0 ? `light 缺少：${preview(missingInLight)}${missingInLight.length > 10 ? ' ...' : ''}` : null
    ].filter(Boolean);
    throw new Error(`sync-src-assets: Light/Dark token key 不一致（${parts.join('；')}）`);
  }

  const available = new Set(lightKeys);
  const antdTokenMap = buildAntdTokenMap(available);
  const antdComponentsMap = buildAntdComponentsMap(available);

  await Promise.all([
    fs.writeFile(antdTokenMapPath, JSON.stringify(antdTokenMap, null, 2) + '\n', 'utf8'),
    fs.writeFile(antdComponentsMapPath, JSON.stringify(antdComponentsMap, null, 2) + '\n', 'utf8')
  ]);
}

await main();

