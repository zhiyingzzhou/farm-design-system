/**
 * 同步 `src` 下的静态资产（供编译与运行时消费）：
 * - `scripts/finex-ui.json`：Token Studio 从 Figma 导出的原始 JSON（含 base/base + Light/Dark 分组）
 * - `src/finex-ui.json`：解析后的 `{ light, dark }` 扁平结构（运行时直接消费，避免重复做引用解析）
 * - `src/adapters/farm-token-map.json`：Farm Token -> Finex key 映射（Farm Token 用于业务组件 / CSS 变量 / Tailwind）
 * - `src/adapters/antd-token-map.json`：Ant Design Token -> Farm Token（用于全局 token 覆盖）
 * - `src/adapters/antd-components-map.json`：Ant Design 组件级 Token -> Farm Token（用于组件细化覆盖，例如 Button 状态色）
 *
 * 约定：
 * - 这几个文件都由脚本生成，避免手工维护时出现 token 漏配/拼写差异。
 * - 如需调整映射规则，请改本脚本里的 `buildAntdTokenMap/buildAntdComponentsMap`。
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
const scriptsRoot = path.join(packageRoot, 'scripts');
const srcRoot = path.join(packageRoot, 'src');

const tokenStudioExportPath = path.join(scriptsRoot, 'finex-ui.json');
const srcFinexUiPath = path.join(srcRoot, 'finex-ui.json');
const adaptersRoot = path.join(srcRoot, 'adapters');
const farmTokenMapPath = path.join(adaptersRoot, 'farm-token-map.json');
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
 * - key：finexKey（用于后续生成 Farm Token 与适配层映射）
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

/**
 * 将 finexKey 转成 Farm Token（主题包对外的稳定语义层）。
 *
 * 命名规则（保持稳定，避免影响下游依赖）：
 * - 小写
 * - 空格（含多空白）统一转为 `-`
 * - `_` 转为 `-`
 */
function toFarmToken(finexKey: string): string {
  return finexKey.trim().toLowerCase().replaceAll(/\s+/g, '-').replaceAll('_', '-');
}

/**
 * Farm Token 名称校验。
 *
 * - 允许：`a-z` / `0-9` / `-`
 * - 支持分段：`xxx.yyy`（为未来的命名空间预留，但当前生成规则不会产出 `.`）
 */
function isValidFarmTokenName(token: string): boolean {
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(token);
}

/**
 * 从若干候选 Farm Token 中挑一个“确实存在”的 token。
 *
 * 为什么需要候选：
 * - 映射规则会随着设计稿/命名调整而演进；通过候选 + 兜底可以降低修改心智负担
 * - 找不到时直接抛错，避免悄悄回退到 antd 默认值导致 UI 割裂
 */
function pickFarmToken(
  farmTokenMap: Record<string, string>,
  candidates: string[],
  label: string
): string {
  for (const token of candidates) {
    if (token in farmTokenMap) return token;
  }
  throw new Error(`sync-src-assets: 无法为 "${label}" 找到可用的 Farm Token（候选：${candidates.join(', ')}）`);
}

/**
 * 生成 antd “全局 Token -> Farm Token” 映射。
 *
 * 映射策略：
 * - 只覆盖“能明确从设计稿落地”的颜色类 token（背景/边框/填充/文本/状态色）
 * - 其余 token（尺寸、阴影、圆角、动效等）继续交给 antd 默认算法派生，避免过度定制导致维护成本上升
 *
 * 注意：
 * - 这里返回的是映射关系，不是最终色值；
 *   最终色值在运行时由 `@farm-design-system/theme` 根据 mode + overrides 解析。
 */
function buildAntdTokenMap(farmTokenMap: Record<string, string>): Record<string, string> {
  const primary = pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'colorPrimary');
  // `neutral-color-neutral-2` 在设计稿里是更亮的一档品牌紫，作为 hover 更容易拉开层级（特别是 dark 模式）
  const primaryHover = pickFarmToken(farmTokenMap, ['neutral-color-neutral-2', primary], 'colorPrimaryHover');
  const primaryActive = pickFarmToken(
    farmTokenMap,
    ['button-color-main-button-press', 'text-color-text-13', primary],
    'colorPrimaryActive'
  );
  const primaryBg = pickFarmToken(farmTokenMap, ['brand-color-brand-3', 'neutral-color-neutral-1'], 'colorPrimaryBg');
  // 主色浅背景 hover：优先使用“主按钮 disable”（比 Brand-3 更深一档），让 hover/selected 更有层级
  const primaryBgHover = pickFarmToken(
    farmTokenMap,
    ['button-color-main-button-disable', primaryBg],
    'colorPrimaryBgHover'
  );
  const primaryText = pickFarmToken(farmTokenMap, ['text-color-text-4', primary], 'colorPrimaryText');
  const primaryTextHover = pickFarmToken(farmTokenMap, [primaryText], 'colorPrimaryTextHover');
  const primaryTextActive = pickFarmToken(
    farmTokenMap,
    ['text-color-text-13', primaryActive],
    'colorPrimaryTextActive'
  );

  const bgBase = pickFarmToken(farmTokenMap, ['bg-color-bg-1'], 'colorBgBase');
  const bgLayout = pickFarmToken(farmTokenMap, ['bg-group-color-2', 'bg-color-bg-2'], 'colorBgLayout');
  const bgContainer = pickFarmToken(farmTokenMap, ['neutral-color-neutral-4', 'bg-group-color-1', 'bg-color-bg-1'], 'colorBgContainer');
  const bgElevated = pickFarmToken(
    farmTokenMap,
    ['ohter-color-ohter-4', 'neutral-color-neutral-5', 'bg-group-color-3', 'bg-color-bg-2', bgContainer],
    'colorBgElevated'
  );

  const border = pickFarmToken(farmTokenMap, ['divider-color-divider-1'], 'colorBorder');
  const borderSecondary = pickFarmToken(farmTokenMap, ['divider-color-divider-2'], 'colorBorderSecondary');
  const borderDisabled = pickFarmToken(farmTokenMap, ['divider-color-divider-3', borderSecondary], 'colorBorderDisabled');

  const fill = pickFarmToken(farmTokenMap, ['divider-color-divider-1'], 'colorFill');
  const fillSecondary = pickFarmToken(farmTokenMap, ['divider-color-divider-2'], 'colorFillSecondary');
  const fillTertiary = pickFarmToken(farmTokenMap, ['divider-color-divider-3'], 'colorFillTertiary');
  const fillQuaternary = pickFarmToken(farmTokenMap, ['divider-color-divider-4'], 'colorFillQuaternary');
  // 文本 hover 背景：Light 模式与 `divider-4` 同值；Dark 模式用带透明度的灰，让 hover 更“浮”出来
  const bgTextHover = pickFarmToken(
    farmTokenMap,
    ['button-color-secondary-grey-button-disable', fillQuaternary],
    'colorBgTextHover'
  );

  const disabledBg = pickFarmToken(
    farmTokenMap,
    ['button-color-gray-button-disable', 'bg-color-bg-2', 'neutral-color-neutral-6'],
    'colorBgContainerDisabled'
  );

  return {
    // ===== Brand / Link =====
    colorPrimary: primary,
    colorPrimaryHover: primaryHover,
    colorPrimaryActive: primaryActive,
    colorPrimaryBg: primaryBg,
    colorPrimaryBgHover: primaryBgHover,
    colorPrimaryBorder: primary,
    colorPrimaryBorderHover: primaryHover,
    colorPrimaryText: primaryText,
    colorPrimaryTextHover: primaryTextHover,
    colorPrimaryTextActive: primaryTextActive,

    colorLink: primary,
    colorLinkHover: primaryHover,
    colorLinkActive: primaryActive,

    // ===== Semantic Colors =====
    colorInfo: pickFarmToken(farmTokenMap, ['tips-blue'], 'colorInfo'),
    colorInfoText: pickFarmToken(farmTokenMap, ['tips-blue'], 'colorInfoText'),
    colorInfoTextHover: pickFarmToken(farmTokenMap, ['tips-blue'], 'colorInfoTextHover'),
    colorInfoTextActive: pickFarmToken(farmTokenMap, ['tips-blue'], 'colorInfoTextActive'),

    colorSuccess: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2', 'tips-green'], 'colorSuccess'),
    colorSuccessBg: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-4'], 'colorSuccessBg'),
    colorSuccessText: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2', 'tips-green'], 'colorSuccessText'),
    colorSuccessBorder: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2'], 'colorSuccessBorder'),
    colorSuccessHover: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2'], 'colorSuccessHover'),
    colorSuccessActive: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2'], 'colorSuccessActive'),
    colorSuccessTextHover: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2', 'tips-green'], 'colorSuccessTextHover'),
    colorSuccessTextActive: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-2', 'tips-green'], 'colorSuccessTextActive'),

    colorWarning: pickFarmToken(farmTokenMap, ['tips-orange', 'ohter-color-other-1'], 'colorWarning'),
    colorWarningBg: pickFarmToken(farmTokenMap, ['ohter-color-ohter-2'], 'colorWarningBg'),
    colorWarningBgHover: pickFarmToken(farmTokenMap, ['ohter-color-other-5'], 'colorWarningBgHover'),
    colorWarningBorder: pickFarmToken(farmTokenMap, ['ohter-color-other-1', 'tips-orange'], 'colorWarningBorder'),
    colorWarningBorderHover: pickFarmToken(farmTokenMap, ['ohter-color-other-1', 'tips-orange'], 'colorWarningBorderHover'),
    colorWarningHover: pickFarmToken(farmTokenMap, ['ohter-color-other-1', 'tips-orange'], 'colorWarningHover'),
    colorWarningActive: pickFarmToken(farmTokenMap, ['text-color-text-14', 'ohter-color-other-1'], 'colorWarningActive'),
    colorWarningText: pickFarmToken(farmTokenMap, ['text-color-text-14', 'tips-orange'], 'colorWarningText'),
    colorWarningTextHover: pickFarmToken(farmTokenMap, ['text-color-text-14'], 'colorWarningTextHover'),
    colorWarningTextActive: pickFarmToken(farmTokenMap, ['text-color-text-14'], 'colorWarningTextActive'),

    colorError: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-1', 'tips-red'], 'colorError'),
    colorErrorBg: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-3'], 'colorErrorBg'),
    colorErrorBgHover: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-3'], 'colorErrorBgHover'),
    colorErrorBorder: pickFarmToken(farmTokenMap, ['pump-dump-color-pd-1', 'text-color-text-11'], 'colorErrorBorder'),
    colorErrorBorderHover: pickFarmToken(farmTokenMap, ['text-color-text-8', 'pump-dump-color-pd-1'], 'colorErrorBorderHover'),
    colorErrorHover: pickFarmToken(farmTokenMap, ['text-color-text-8', 'pump-dump-color-pd-1'], 'colorErrorHover'),
    colorErrorActive: pickFarmToken(farmTokenMap, ['text-color-text-8', 'pump-dump-color-pd-1'], 'colorErrorActive'),
    colorErrorText: pickFarmToken(farmTokenMap, ['text-color-text-11', 'pump-dump-color-pd-1'], 'colorErrorText'),
    colorErrorTextHover: pickFarmToken(farmTokenMap, ['text-color-text-8', 'text-color-text-11'], 'colorErrorTextHover'),
    colorErrorTextActive: pickFarmToken(farmTokenMap, ['text-color-text-8', 'text-color-text-11'], 'colorErrorTextActive'),

    // 背景色分层：尽量用“跨模式一致语义”的 Bg-group（Light=浅灰/白，Dark=黑/深灰）
    colorBgBase: bgBase,
    colorBgLayout: bgLayout,
    colorBgContainer: bgContainer,
    colorBgElevated: bgElevated,
    colorBgMask: pickFarmToken(farmTokenMap, ['mask-color-mask'], 'colorBgMask'),
    colorBgContainerDisabled: disabledBg,
    colorBgSpotlight: pickFarmToken(farmTokenMap, ['neutral-color-neutral-3'], 'colorBgSpotlight'),
    colorBgBlur: pickFarmToken(farmTokenMap, ['bg-color-bg-3'], 'colorBgBlur'),
    colorBgSolid: pickFarmToken(farmTokenMap, ['button-color-gray-button-normal', 'bg-color-bg-2'], 'colorBgSolid'),
    colorBgSolidHover: pickFarmToken(
      farmTokenMap,
      ['button-color-gray-button-press', 'button-color-secondary-grey-button-press'],
      'colorBgSolidHover'
    ),
    colorBgSolidActive: pickFarmToken(
      farmTokenMap,
      ['button-color-gray-button-press', 'button-color-secondary-grey-button-press'],
      'colorBgSolidActive'
    ),

    // 填充色：直接对齐 Divider 色阶（Figma 已明确给出）
    colorFill: fill,
    colorFillSecondary: fillSecondary,
    colorFillTertiary: fillTertiary,
    colorFillQuaternary: fillQuaternary,

    // AliasToken：偏语义的“可复用槽位”，同样用现有色阶对齐
    colorFillContent: fillQuaternary,
    colorFillContentHover: fillTertiary,
    colorFillAlter: fillQuaternary,
    colorBgTextHover: bgTextHover,
    colorBgTextActive: fillTertiary,
    colorBorderBg: fillQuaternary,

    // 高亮/交互态背景（Menu/Select/Tree 等大量使用）
    controlItemBgHover: pickFarmToken(
      farmTokenMap,
      ['button-color-secondary-grey-button-normal', 'divider-color-divider-4'],
      'controlItemBgHover'
    ),
    controlItemBgActive: pickFarmToken(farmTokenMap, ['neutral-color-neutral-1', primaryBg], 'controlItemBgActive'),
    controlItemBgActiveHover: pickFarmToken(
      farmTokenMap,
      ['neutral-color-neutral-5', 'divider-color-divider-3'],
      'controlItemBgActiveHover'
    ),
    controlItemBgActiveDisabled: pickFarmToken(
      farmTokenMap,
      ['neutral-color-neutral-6', 'divider-color-divider-3'],
      'controlItemBgActiveDisabled'
    ),

    // Outline（focus ring）
    controlOutline: pickFarmToken(farmTokenMap, ['text-color-text-12', primaryBg], 'controlOutline'),
    colorWarningOutline: pickFarmToken(farmTokenMap, ['ohter-color-other-5', 'ohter-color-ohter-2'], 'colorWarningOutline'),
    colorErrorOutline: pickFarmToken(farmTokenMap, ['text-color-text-10', 'pump-dump-color-pd-3'], 'colorErrorOutline'),
    controlTmpOutline: pickFarmToken(farmTokenMap, ['text-color-text-7', fillSecondary], 'controlTmpOutline'),

    // 预设色板（Badge/Tag/Button preset colors 等会消费这些 token）
    blue6: pickFarmToken(farmTokenMap, ['tips-blue'], 'blue6'),
    cyan6: pickFarmToken(farmTokenMap, ['tips-cyan'], 'cyan6'),
    green6: pickFarmToken(farmTokenMap, ['tips-green', 'pump-dump-color-pd-2'], 'green6'),
    red6: pickFarmToken(farmTokenMap, ['tips-red', 'pump-dump-color-pd-1'], 'red6'),
    yellow6: pickFarmToken(farmTokenMap, ['tips-yellow'], 'yellow6'),
    magenta6: pickFarmToken(farmTokenMap, ['tips-purple-red'], 'magenta6'),
    pink6: pickFarmToken(farmTokenMap, ['tips-bright-red'], 'pink6'),
    purple6: pickFarmToken(farmTokenMap, ['tips-dark-purple'], 'purple6'),

    red1: pickFarmToken(farmTokenMap, ['text-color-text-9', 'text-color-text-10'], 'red1'),
    red3: pickFarmToken(farmTokenMap, ['text-color-text-10'], 'red3'),
    orange6: pickFarmToken(farmTokenMap, ['tips-orange', 'ohter-color-other-1'], 'orange6'),
    orange1: pickFarmToken(farmTokenMap, ['ohter-color-ohter-2'], 'orange1'),
    purple1: pickFarmToken(farmTokenMap, ['brand-color-brand-3', 'neutral-color-neutral-1'], 'purple1'),

    colorTextBase: pickFarmToken(farmTokenMap, ['text-color-text-1'], 'colorTextBase'),
    colorText: pickFarmToken(farmTokenMap, ['text-color-text-1'], 'colorText'),
    colorTextSecondary: pickFarmToken(farmTokenMap, ['text-color-text-2'], 'colorTextSecondary'),
    colorTextTertiary: pickFarmToken(farmTokenMap, ['text-color-text-3'], 'colorTextTertiary'),
    colorTextQuaternary: pickFarmToken(farmTokenMap, ['text-color-text-6'], 'colorTextQuaternary'),
    // `colorTextLightSolid` 同时会影响 Primary/Danger Button、Badge 等；优先用实心白，半透明白走 `text-color-text-7`（见 `controlTmpOutline`）
    colorTextLightSolid: pickFarmToken(farmTokenMap, ['text-color-text-5'], 'colorTextLightSolid'),
    // 目前 `brand-color-brand-1` 与 `text-color-text-1` 同值（黑/白），但语义上更接近“标题/强强调”
    colorTextHeading: pickFarmToken(farmTokenMap, ['brand-color-brand-1', 'text-color-text-1'], 'colorTextHeading'),
    colorTextLabel: pickFarmToken(farmTokenMap, ['text-color-text-2'], 'colorTextLabel'),
    colorTextDescription: pickFarmToken(farmTokenMap, ['text-color-text-3'], 'colorTextDescription'),
    colorTextPlaceholder: pickFarmToken(farmTokenMap, ['text-color-text-3'], 'colorTextPlaceholder'),
    colorTextDisabled: pickFarmToken(farmTokenMap, ['text-color-text-6', 'text-color-text-3'], 'colorTextDisabled'),
    colorIcon: pickFarmToken(farmTokenMap, ['text-color-text-2'], 'colorIcon'),
    colorIconHover: pickFarmToken(farmTokenMap, ['text-color-text-1'], 'colorIconHover'),

    colorBorder: border,
    colorBorderSecondary: borderSecondary,
    colorBorderDisabled: borderDisabled,
    colorSplit: pickFarmToken(farmTokenMap, [borderSecondary], 'colorSplit')
  };
}

/**
 * 生成 antd “组件级 Token -> Farm Token” 映射。
 *
 * 映射策略：
 * - 对齐设计稿里“组件状态色”（hover/active/selected/disabled 等）
 * - 优先覆盖颜色相关 token，其余保持默认（避免把组件行为做死）
 *
 * 组件级覆盖的优势：
 * - 不会污染全局 token（例如只想改 Button 的 disabled 背景，不影响 Input/Select）
 */
function buildAntdComponentsMap(farmTokenMap: Record<string, string>): Record<string, Record<string, string>> {
  const primaryButton = pickFarmToken(
    farmTokenMap,
    ['button-color-main-button-normal', 'brand-color-brand-2'],
    'Button.colorPrimary'
  );
  const primaryButtonActive = pickFarmToken(
    farmTokenMap,
    ['button-color-main-button-press', 'text-color-text-13', primaryButton],
    'Button.colorPrimaryActive'
  );
  const buttonDisabledBg = pickFarmToken(
    farmTokenMap,
    ['button-color-gray-button-disable', 'bg-color-bg-2', 'neutral-color-neutral-6'],
    'Button.colorBgContainerDisabled'
  );

  return {
    Button: {
      // primary（solid）：用 Figma 里的主按钮 normal/press 细化 hover/active
      colorPrimary: primaryButton,
      colorPrimaryHover: primaryButton,
      colorPrimaryActive: primaryButtonActive,
      // antd Button 的“默认背景”最终会落在 `colorBgContainer` 上，但全局容器色 ≠ 控件底色；
      // 这里把 Button 的容器背景单独对齐到「二级白按钮 normal」（dark 下是更亮的 #484848）
      colorBgContainer: pickFarmToken(
        farmTokenMap,
        ['button-color-secondary-white-button-normal', 'bg-group-color-1', 'bg-color-bg-1'],
        'Button.colorBgContainer'
      ),
      // disabled：antd v6 的 Button disabled 背景最终会落到 `colorBgContainerDisabled`
      // 这里选择“灰按钮 disable”作为通用禁用底色（避免禁用态带品牌色导致对比度不稳）
      colorBgContainerDisabled: buttonDisabledBg,

      // 主要按钮文字色
      primaryColor: pickFarmToken(farmTokenMap, ['text-color-text-5'], 'Button.primaryColor'),

      // default（outlined/dashed）：hover/active 背景按 Figma 的二级按钮状态色
      defaultHoverBg: pickFarmToken(
        farmTokenMap,
        ['button-color-secondary-white-button-press'],
        'Button.defaultHoverBg'
      ),
      defaultActiveBg: pickFarmToken(
        farmTokenMap,
        ['button-color-secondary-grey-button-press', 'button-color-secondary-white-button-press'],
        'Button.defaultActiveBg'
      ),

      // default 的边框与 hover/active 高亮
      defaultBorderColor: pickFarmToken(farmTokenMap, ['divider-color-divider-2'], 'Button.defaultBorderColor'),
      defaultHoverBorderColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Button.defaultHoverBorderColor'),
      defaultActiveBorderColor: primaryButtonActive,
      defaultColor: pickFarmToken(farmTokenMap, ['text-color-text-1'], 'Button.defaultColor'),
      defaultHoverColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Button.defaultHoverColor'),
      defaultActiveColor: pickFarmToken(farmTokenMap, ['button-color-main-button-press', 'brand-color-brand-2'], 'Button.defaultActiveColor'),
      textHoverBg: pickFarmToken(farmTokenMap, ['divider-color-divider-4'], 'Button.textHoverBg')
    },

    Input: {
      // 输入框本体：主要通过全局 token 控制，这里只把 hover/active 的边框与背景对齐到现有色阶
      addonBg: pickFarmToken(farmTokenMap, ['bg-color-bg-2', 'bg-group-color-2'], 'Input.addonBg'),
      hoverBorderColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Input.hoverBorderColor'),
      activeBorderColor: pickFarmToken(
        farmTokenMap,
        ['button-color-main-button-press', 'brand-color-brand-2'],
        'Input.activeBorderColor'
      ),
      hoverBg: pickFarmToken(farmTokenMap, ['bg-group-color-1', 'bg-color-bg-1'], 'Input.hoverBg'),
      activeBg: pickFarmToken(farmTokenMap, ['bg-group-color-1', 'bg-color-bg-1'], 'Input.activeBg')
    },

    Select: {
      selectorBg: pickFarmToken(farmTokenMap, ['bg-group-color-1', 'bg-color-bg-1'], 'Select.selectorBg'),
      clearBg: pickFarmToken(farmTokenMap, ['bg-group-color-1', 'bg-color-bg-1'], 'Select.clearBg'),

      hoverBorderColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Select.hoverBorderColor'),
      activeBorderColor: pickFarmToken(
        farmTokenMap,
        ['button-color-main-button-press', 'brand-color-brand-2'],
        'Select.activeBorderColor'
      ),
      activeOutlineColor: pickFarmToken(farmTokenMap, ['brand-color-brand-3', 'neutral-color-neutral-1'], 'Select.activeOutlineColor'),

      optionSelectedColor: pickFarmToken(farmTokenMap, ['text-color-text-1'], 'Select.optionSelectedColor'),
      optionSelectedBg: pickFarmToken(farmTokenMap, ['brand-color-brand-3', 'neutral-color-neutral-1'], 'Select.optionSelectedBg'),
      optionActiveBg: pickFarmToken(farmTokenMap, ['divider-color-divider-4'], 'Select.optionActiveBg'),

      multipleItemBg: pickFarmToken(farmTokenMap, ['divider-color-divider-4'], 'Select.multipleItemBg'),
      multipleItemBorderColor: pickFarmToken(farmTokenMap, ['divider-color-divider-2'], 'Select.multipleItemBorderColor'),
      multipleSelectorBgDisabled: pickFarmToken(
        farmTokenMap,
        ['button-color-gray-button-disable', 'bg-color-bg-2', 'neutral-color-neutral-6'],
        'Select.multipleSelectorBgDisabled'
      ),
      multipleItemColorDisabled: pickFarmToken(farmTokenMap, ['text-color-text-6', 'text-color-text-3'], 'Select.multipleItemColorDisabled'),
      multipleItemBorderColorDisabled: pickFarmToken(farmTokenMap, ['divider-color-divider-3'], 'Select.multipleItemBorderColorDisabled')
    },

    Tabs: {
      cardBg: pickFarmToken(farmTokenMap, ['bg-group-color-1', 'bg-color-bg-1'], 'Tabs.cardBg'),
      inkBarColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Tabs.inkBarColor'),
      itemColor: pickFarmToken(farmTokenMap, ['text-color-text-2'], 'Tabs.itemColor'),
      itemHoverColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Tabs.itemHoverColor'),
      itemActiveColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Tabs.itemActiveColor'),
      itemSelectedColor: pickFarmToken(farmTokenMap, ['brand-color-brand-2'], 'Tabs.itemSelectedColor')
    },

    Modal: {
      headerBg: pickFarmToken(farmTokenMap, ['bg-group-color-3', 'bg-color-bg-2'], 'Modal.headerBg'),
      contentBg: pickFarmToken(farmTokenMap, ['bg-group-color-3', 'bg-color-bg-2'], 'Modal.contentBg'),
      footerBg: pickFarmToken(farmTokenMap, ['bg-group-color-3', 'bg-color-bg-2'], 'Modal.footerBg'),
      titleColor: pickFarmToken(farmTokenMap, ['text-color-text-1'], 'Modal.titleColor')
    }
  };
}

/**
 * 脚本入口：把 Token Studio 导出同步成“运行时/构建可直接消费”的文件。
 *
 * 产物：
 * - `src/finex-ui.json`：{ light, dark } 扁平结构（运行时直接读）
 * - `src/adapters/farm-token-map.json`：Farm Token -> finexKey（主题包对外稳定入口）
 * - `src/adapters/antd-token-map.json`：antd 全局 token 映射
 * - `src/adapters/antd-components-map.json`：antd 组件级 token 映射
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

  const farmTokenMap: Record<string, string> = {};
  const seen = new Set<string>();

  for (const finexKey of Object.keys(finexUi.light).sort()) {
    const token = toFarmToken(finexKey);
    if (!isValidFarmTokenName(token)) {
      throw new Error(`sync-src-assets: 生成了非法的 Farm Token 名称 "${token}"（来自 "${finexKey}"）`);
    }
    if (seen.has(token)) {
      throw new Error(`sync-src-assets: Farm Token 冲突 "${token}"（来自 "${finexKey}"）`);
    }
    seen.add(token);
    farmTokenMap[token] = finexKey;
  }

  const antdTokenMap = buildAntdTokenMap(farmTokenMap);
  const antdComponentsMap = buildAntdComponentsMap(farmTokenMap);

  await Promise.all([
    fs.writeFile(farmTokenMapPath, JSON.stringify(farmTokenMap, null, 2) + '\n', 'utf8'),
    fs.writeFile(antdTokenMapPath, JSON.stringify(antdTokenMap, null, 2) + '\n', 'utf8'),
    fs.writeFile(antdComponentsMapPath, JSON.stringify(antdComponentsMap, null, 2) + '\n', 'utf8')
  ]);
}

await main();
