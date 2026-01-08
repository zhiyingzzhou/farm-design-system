import antdTokenMapJson from './adapters/antd-token-map.json';
import antdComponentsMapJson from './adapters/antd-components-map.json';
import farmTokenMapJson from './adapters/farm-token-map.json';
import finexUiJson from './finex-ui.json';

export type ThemeMode = 'light' | 'dark';

/**
 * 资产约定（主题包内部）：
 * - `src/finex-ui.json`：Finex 主题 Token（已解析成 `{ light, dark }` 扁平结构）
 * - `src/adapters/farm-token-map.json`：Farm Token -> Finex key（用于业务组件 / CSS 变量 / Tailwind）
 * - `src/adapters/antd-token-map.json`：Ant Design Token -> Farm Token（决定注入哪些 antd token）
 * - `src/adapters/antd-components-map.json`：Ant Design 组件 Token -> Farm Token（用于组件级细化覆盖）
 *
 * 说明：
 * - 这几份 JSON 都由 `pnpm --filter @farm-design-system/theme sync:assets` 生成；
 *   如需调整映射规则，改 `packages/theme/scripts/sync-src-assets.ts`，不要直接改 JSON。
 * - `Farm Token` 是对业务最稳定的消费入口：业务组件、UI 组件、Tailwind、CSS 变量都只认它。
 */

/**
 * 统一后的 finex token 结构：
 * - `light/dark` 两套扁平 token（key 为 finex 原始命名，例如 `Brand-Color-Brand-2`）
 * - value 为最终可消费的颜色值（已把 `{Grey.18}` 等引用解析完成）
 */
export type FinexUi = Record<ThemeMode, Record<string, string>>;

type TokenLeaf = {
  value: string;
  type?: string;
};

/**
 * 判定一个值是否为“普通对象”（排除 null/数组）。
 * 主题解析流程会大量走 JSON 遍历，这里做一层轻量的类型保护。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Token Studio 导出里，叶子节点的基本形态是 `{ value, type }`。
 * 这里不关心具体的 type（color/number/...），只把 `value: string` 作为“可解析”的入口。
 */
function isTokenLeaf(node: unknown): node is TokenLeaf {
  return isRecord(node) && typeof node.value === 'string';
}

/**
 * Token Studio 的引用语法：`{Grey.18}`。
 * 返回引用的路径（例如 `Grey.18`），不符合语法则返回 null。
 */
function normalizeRef(value: string): string | null {
  const match = /^\{(.+)\}$/.exec(value.trim());
  return match ? match[1] : null;
}

/**
 * 把 Token Studio 的“树形 JSON”拉平成 `a.b.c -> value` 的 lookup 表。
 * 用途：
 * - 解析 `{Grey.18}` 这类引用时，通过 lookup 快速取到被引用的 value。
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
 * 解析 Token Studio 的引用链：
 * - 输入可以是普通色值 `#fff`，也可以是引用 `{Grey.18}`；
 * - 遇到引用会递归展开，直到拿到最终色值；
 * - 对循环引用做显式报错，避免静默得到错误结果。
 */
function resolveTokenValue(value: string, lookup: Record<string, string>, stack: string[] = []): string {
  const ref = normalizeRef(value);
  if (!ref) return value;
  if (stack.includes(ref)) {
    throw new Error(`@farm-design-system/theme: 检测到循环引用：${[...stack, ref].join(' -> ')}`);
  }
  const next = lookup[ref];
  if (next === undefined) {
    throw new Error(`@farm-design-system/theme: 无法解析引用 "{${ref}}"`);
  }
  return resolveTokenValue(next, lookup, [...stack, ref]);
}

/**
 * 把 Token Studio 的层级路径转换成“稳定可读”的 finex key（写入 `finex-ui.json`）。
 *
 * 设计目标：
 * - 分组路径用 `-` 连接，避免空格带来的歧义；
 * - 最后一段（叶子）保留空格，尽量贴近设计侧命名，方便对照；
 * - 与 `scripts/sync-src-assets.ts` 保持一致，避免 build/run 时出现 key 不一致。
 */
function toFinexKey(pathParts: string[]): string {
  // 这个 key 会写入 `finex-ui.json`，并作为 `farm-token-map` 的 value 使用；
  // 因此它需要稳定、可读，同时对 Token Studio 的层级结构不敏感。
  if (pathParts.length === 0) return '';
  const groups = pathParts
    .slice(0, -1)
    .map((part) => part.trim().replaceAll(/\s+/g, '-'));
  const leaf = pathParts[pathParts.length - 1].trim().replaceAll(/\s+/g, ' ');
  return [...groups, leaf].join('-');
}

/**
 * 从 Token Studio 的主题分组中收集 token：
 * - 生成 finex key（见 `toFinexKey`）
 * - 将 `{xxx}` 引用解析为最终色值
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
 * 判断输入是否已经是 `{ light, dark }` 的“已解析结构”。
 * 这样 dist 产物或手工维护 json 可以直接被消费，不必再走 Token Studio 的解析逻辑。
 */
function isFinexUiResolved(raw: unknown): raw is FinexUi {
  if (!isRecord(raw)) return false;
  return isRecord(raw.light) && isRecord(raw.dark);
}

/**
 * 统一处理 finex token 输入：
 * - 已解析结构：直接返回
 * - Token Studio 原始导出：解析 base/base + Light/Dark 分组，并展开引用
 */
function resolveFinexUi(raw: unknown): FinexUi {
  // 兼容两种输入：
  // 1) 已解析好的 `{ light, dark }`（dist 产物、或手工维护的 json）
  // 2) Token Studio 导出的原始结构（含 base/base + xxx/Light + xxx/Dark）
  //
  // 实际推荐做法：
  // - 开发/构建阶段用 `sync:assets` 把 Token Studio 的原始导出解析为 `{ light, dark }` 后写入 `src/finex-ui.json`
  // - 运行时只消费已解析好的结构（避免在应用启动时做深度遍历与引用解析）
  if (isFinexUiResolved(raw)) return raw;
  if (!isRecord(raw)) {
    throw new Error('@farm-design-system/theme: finex-ui.json 格式不正确');
  }

  const base = raw['base/base'];
  if (!isRecord(base)) {
    throw new Error('@farm-design-system/theme: finex-ui.json 缺少 base/base，无法解析 Token Studio 导出的 JSON');
  }

  const keys = Object.keys(raw);
  const lightKey = keys.find((k) => /\/Light$/.test(k));
  const darkKey = keys.find((k) => /\/Dark$/.test(k));

  if (!lightKey || !darkKey) {
    throw new Error('@farm-design-system/theme: finex-ui.json 未找到以 "/Light" 或 "/Dark" 结尾的主题分组');
  }

  const baseLookup = collectTokenValues(base);
  const light = collectThemeTokens(raw[lightKey], baseLookup);
  const dark = collectThemeTokens(raw[darkKey], baseLookup);

  return { light, dark };
}

const finexUiResolved = resolveFinexUi(finexUiJson as unknown);

/**
 * Finex 设计 token（已解析）：
 * - key：finex 原始命名（例如 `Brand-Color-Brand-2`）
 * - value：最终色值（已展开 `{Grey.18}` 引用）
 */
export const finexUi = finexUiResolved;
/**
 * Farm Token -> finex key。
 * Farm Token 是主题包对外的稳定入口，业务组件/样式应尽量只依赖 Farm Token。
 */
export const farmTokenMap = farmTokenMapJson;
/**
 * antd 全局 token -> Farm Token。
 * 控制哪些 antd token 会被注入（覆盖范围可控、便于审计）。
 */
export const antdTokenMap = antdTokenMapJson;
/**
 * antd 组件级 token -> Farm Token。
 * 用于更细的组件状态色覆盖（hover/active/disabled 等），避免把局部差异污染到全局。
 */
export const antdComponentsMap = antdComponentsMapJson as unknown as Record<string, Record<string, string>>;

export type FinexTokenKey = string;
export type FarmToken = keyof typeof farmTokenMap;
export type AntdTokenName = keyof typeof antdTokenMap;

const farmTokens = Object.keys(farmTokenMap) as FarmToken[];

/**
 * 校验 Farm Token 名称是否合法。
 *
 * 规则：
 * - 允许：小写字母/数字/中划线 `-`
 * - 允许用 `.` 做分段（方便未来扩展层级语义，例如 `brand.color.primary`）
 *
 * 为什么要有这个校验：
 * - 这些 token 会被用来生成 CSS 变量名、Tailwind 嵌套路径等；
 * - 一旦出现非法字符，会导致样式层“静默失效”，排查成本很高，所以在主题包加载时直接失败更安全。
 */
function isValidTokenName(token: string): boolean {
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(token);
}

/**
 * 主题完整性校验（早失败）。
 *
 * 校验内容：
 * 1) `farm-token-map.json` 指向的 finex key 在 light/dark 都存在
 * 2) `antd-token-map.json` / `antd-components-map.json` 指向的 Farm Token 都存在
 * 3) Farm Token 命名合法（见 `isValidTokenName`）
 *
 * 维护要点：
 * - 这一步的意义是把“缺 token/拼写不一致/映射漂移”的问题提前到 import 阶段暴露；
 * - 你在维护映射规则（`scripts/sync-src-assets.ts`）后，一旦生成了不一致的产物，这里会直接报错；
 * - 如果这里报错，不要在业务侧兜底，而是回到脚本与映射表修复根因。
 */
function assertThemeIntegrity(): void {
  // 这一步是“早失败”策略：
  // - `farm-token-map.json` 与 `finex-ui.json` 任意不同步都会在这里报错
  // - `antd-token-map.json` / `antd-components-map.json` 指向了不存在的 Farm Token 也会在这里报错
  //
  // 这样可以保证：只要 theme 包能被正常 import，就不会把缺 token 的问题拖到运行时 UI 上才暴露。
  const finexLight = finexUi.light;
  const finexDark = finexUi.dark;

  for (const token of farmTokens) {
    if (!isValidTokenName(token)) {
      throw new Error(
        `@farm-design-system/theme: 非法 token 名称 "${token}"，仅允许小写字母/数字/中划线，并用 "." 分段。`
      );
    }

    const finexKey = farmTokenMap[token] as string;
    if (!Object.prototype.hasOwnProperty.call(finexLight, finexKey)) {
      throw new Error(
        `@farm-design-system/theme: farmTokenMap["${token}"] 指向不存在的 finex key "${finexKey}" (light)。`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(finexDark, finexKey)) {
      throw new Error(
        `@farm-design-system/theme: farmTokenMap["${token}"] 指向不存在的 finex key "${finexKey}" (dark)。`
      );
    }
  }

  for (const [antdToken, token] of Object.entries(antdTokenMap)) {
    if (!Object.prototype.hasOwnProperty.call(farmTokenMap, token)) {
      throw new Error(
        `@farm-design-system/theme: antdTokenMap["${antdToken}"] 指向不存在的 Farm Token "${token}"。`
      );
    }
  }

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    if (!isRecord(tokenMap)) {
      throw new Error(`@farm-design-system/theme: antdComponentsMap["${componentName}"] 必须是对象。`);
    }

    for (const [componentToken, token] of Object.entries(tokenMap)) {
      if (!Object.prototype.hasOwnProperty.call(farmTokenMap, token)) {
        throw new Error(
          `@farm-design-system/theme: antdComponentsMap["${componentName}"]["${componentToken}"] 指向不存在的 Farm Token "${token}"。`
        );
      }
    }
  }
}

assertThemeIntegrity();

/**
 * 将 Farm Token 转换为 CSS 变量名。
 *
 * 约定：
 * - 统一前缀 `--farm-`，避免和业务自己的变量冲突
 * - 由于 token 允许用 `.` 分段，这里会把 `.` 转为 `-`，保证变量名合法
 */
export function cssVarName(token: FarmToken): `--farm-${string}` {
  // 统一 CSS 变量命名：`brand.color.primary` -> `--farm-brand-color-primary`
  return `--farm-${token.replaceAll('.', '-')}`;
}

/** 预生成的 CSS 变量名表，避免业务侧重复做字符串拼接。 */
export const cssVarNames: Record<FarmToken, `--farm-${string}`> = farmTokens.reduce(
  (acc, token) => {
    acc[token] = cssVarName(token);
    return acc;
  },
  {} as Record<FarmToken, `--farm-${string}`>
);

export type FarmTokensByMode = Record<ThemeMode, Record<FarmToken, string>>;

/**
 * 解析指定 mode 下的 Farm Token 最终值。
 *
 * 输入：
 * - `mode`：light/dark
 * - `finexUi`：可选；不传则使用包内置的 `finexUi`
 * - `overrides`：可选；项目级覆写（最终色值）
 *
 * 输出：
 * - `Record<FarmToken, string>`：每个 Farm Token 都会有值（缺失会抛错）
 *
 * 维护要点：
 * - 这里是“多项目能力”的根：先把 Farm Token 算准，后续 CSS Vars / antdTheme 都基于它映射
 * - 如果你发现 UI/业务/antd 三端出现颜色不一致，优先从这里确认 overrides 是否按预期生效
 */
function resolveModeTokens(
  mode: ThemeMode,
  options: { finexUi?: FinexUi; overrides?: Partial<Record<FarmToken, string>> } = {}
): Record<FarmToken, string> {
  // 一个 mode 的 Farm Token 最终值来自三层：
  // 1) `finexUi[mode]`：Figma/Token Studio 的原始设计值（已解析引用）
  // 2) `farm-token-map.json`：把设计侧 key 映射到 Farm Token（业务语义入口）
  // 3) `overrides`：项目级覆写（同一套组件，多项目皮肤）
  const finexModeTokens = (options.finexUi ?? finexUi)[mode];
  const result = {} as Record<FarmToken, string>;

  for (const token of farmTokens) {
    const finexKey = farmTokenMap[token] as string;
    const value = finexModeTokens[finexKey];
    if (value === undefined) {
      throw new Error(
        `@farm-design-system/theme: finexUi.${mode} 缺少 key "${finexKey}" (来自 Farm Token "${token}")。`
      );
    }
    result[token] = options.overrides?.[token] ?? value;
  }

  return result;
}

/**
 * 主题包内置的两套 Farm Token：
 * - 直接由 `finexUi + farmTokenMap` 生成
 * - 不包含任何项目级覆写
 *
 * 什么时候直接用它：
 * - 你只需要一套默认主题（不做多项目换肤）
 *
 * 什么时候不要直接用它：
 * - 需要按项目覆写品牌色/背景色（请用 `createTheme({ overrides })`）
 */
export const tokens: FarmTokensByMode = {
  light: resolveModeTokens('light'),
  dark: resolveModeTokens('dark')
};

/** 读取单个 Farm Token 在指定模式下的最终色值（包含项目级 overrides 的结果）。 */
export function getToken(mode: ThemeMode, token: FarmToken): string {
  return tokens[mode][token];
}

export type CssVarsByMode = Record<ThemeMode, Record<`--farm-${string}`, string>>;

/**
 * 把某个 mode 的 Farm Token 转成 CSS 变量表。
 * - key：`--farm-xxx`
 * - value：最终色值
 */
function resolveModeCssVars(
  mode: ThemeMode,
  modeTokens: Record<FarmToken, string>
): Record<`--farm-${string}`, string> {
  const result = {} as Record<`--farm-${string}`, string>;
  for (const token of farmTokens) {
    result[cssVarNames[token]] = modeTokens[token];
  }
  return result;
}

/**
 * 内置主题的 CSS 变量（与 `tokens` 一一对应）。
 * - 默认选择器可直接用 `createTokensCss()` 生成样式文本
 * - 多项目覆写时建议用 `createTheme().cssVars`，避免自己手动合并
 */
export const cssVars: CssVarsByMode = {
  light: resolveModeCssVars('light', tokens.light),
  dark: resolveModeCssVars('dark', tokens.dark)
};

export type TokensCssOptions = {
  lightSelector?: string;
  darkSelector?: string;
  /** 支持传入自定义 vars（例如多项目覆写后生成的 cssVars） */
  vars?: CssVarsByMode;
};

/**
 * 格式化单个 CSS 变量块：
 *
 * ```css
 * selector {
 *   --farm-xxx: #fff;
 * }
 * ```
 */
function formatCssVarBlock(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * 生成 CSS 变量声明文本（同时包含 light/dark 两套）。
 *
 * 特点：
 * - 只输出变量定义，不包含任何组件样式
 * - 默认使用 `[data-theme="light|dark"]` 作为模式选择器，便于业务自行切换
 */
export function createTokensCss(options: TokensCssOptions = {}): string {
  // 产出的 CSS 仅包含 CSS 变量定义，不包含任何 antd 或组件样式。
  // 推荐选择器：通过 `data-theme` 或 `.dark/.light` 做模式切换，业务可按项目习惯调整。
  const {
    lightSelector = ':root, [data-theme="light"], .light',
    darkSelector = '[data-theme="dark"], .dark',
    vars = cssVars
  } = options;

  return [
    '/* Auto-generated by @farm-design-system/theme. */',
    formatCssVarBlock(lightSelector, vars.light),
    formatCssVarBlock(darkSelector, vars.dark),
    ''
  ].join('\n\n');
}

export type AntdThemeConfig = {
  /**
   * antd 全局 token 覆写（对应 `ConfigProvider theme.token`）。
   * 这里的 key 允许是 Seed/Map/Alias token 名称；实际注入范围由 `antdTokenMap` 控制。
   */
  token: Record<string, string | number>;
  /** antd 组件级 token 覆写（对应 `ConfigProvider theme.components`）。 */
  components?: Record<string, Record<string, string | number>>;
};

/**
 * antd 主题生成参数（只影响 antd 这一端）。
 *
 * 你什么时候需要它：
 * - 想统一调整 antd 的 `borderRadius`（而不改设计 token）
 * - 某个组件在 antd 的默认派生下与设计存在偏差，需要做“最后一公里”修正
 *
 * 你什么时候不应该用它：
 * - 仅仅想换品牌色/背景色：请用 `createTheme({ overrides })` 覆写 Farm Token；
 *   因为 Farm Token 会同时驱动 antd + CSS 变量 + Tailwind，三端才能保持一致。
 *
 * 维护要点：
 * - `overrides/components` 都是对 antd token 的直接覆写，属于“强绑定 antd 体系”的配置；
 *   建议控制使用频率，把大多数主题差异收敛在 Farm Token 这一层。
 */
export type CreateAntdThemeOptions = {
  /** 圆角：默认 8；如果你的设计系统有统一圆角，可在这里改。 */
  borderRadius?: number;
  /**
   * 最后一公里覆写 antd token（不建议日常使用）：
   * - 正常情况下只需要覆写 Farm Token（`createTheme({ overrides })`）
   * - 只有当 antd 算法派生必须保持某些内部约束时，才在这里直接改 antd token
   */
  overrides?: Partial<Record<AntdTokenName, string | number>>;
  /**
   * antd 的组件级覆盖（会与默认组件映射合并）：
   * - key 是 antd 组件名（例如 `Button`）
   * - value 是该组件支持的 Component Token / Alias Token 覆写
   */
  components?: Record<string, Record<string, string | number>>;
};

/**
 * 根据 `antdComponentsMap` 生成 antd `theme.components` 覆写。
 *
 * 维护要点：
 * - 这里只处理“组件状态色/局部差异”，不要把全局语义塞进来（全局语义请走 `antdTokenMap`）
 * - `options.overrides` 的优先级最高：用于业务侧极少数的局部修正
 *
 * 如何新增/调整组件 token：
 * - 先在 `scripts/sync-src-assets.ts` 的 `buildAntdComponentsMap` 增加映射规则
 * - 再执行 `pnpm --filter @farm-design-system/theme sync:assets` 生成 `src/adapters/antd-components-map.json`
 * - 不建议直接手改 json（会被脚本覆盖，也难以保证命名一致）
 */
function resolveAntdComponents(
  mode: ThemeMode,
  options: { modeTokens?: Record<FarmToken, string>; overrides?: Record<string, Record<string, string | number>> } = {}
): Record<string, Record<string, string | number>> {
  // 组件级覆盖用于“把设计稿里的组件状态色落到 antd 的 Component Token 上”。
  //
  // 注意点：
  // - antd 的 `theme.components.Xxx` 既能覆盖该组件的 Component Token，也能覆盖该组件消费的 AliasToken（例如 Button 里的 `colorBgContainerDisabled`）
  // - 我们在 `antd-components-map.json` 里只维护“颜色相关”的键；尺寸/阴影/间距等保持走 antd 默认算法
  const modeTokens = options.modeTokens ?? tokens[mode];
  const result: Record<string, Record<string, string | number>> = {};

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    const componentTokens: Record<string, string | number> = {};
    for (const [componentToken, token] of Object.entries(tokenMap)) {
      componentTokens[componentToken] = modeTokens[token as FarmToken] ?? getToken(mode, token as FarmToken);
    }
    result[componentName] = componentTokens;
  }

  if (options.overrides) {
    for (const [componentName, overrideTokens] of Object.entries(options.overrides)) {
      result[componentName] = { ...(result[componentName] ?? {}), ...overrideTokens };
    }
  }

  return result;
}

/**
 * 生成给 antd `ConfigProvider` 使用的主题：
 * - 只注入 `antd-token-map.json` 里列出的 token（覆盖面可控、便于审计）
 * - 其余 token 由 antd 的算法（default/dark/compact）派生
 *
 * 注意：
 * - 这里不会设置 antd 的 `algorithm`，因为 algorithm 属于应用层决策：
 *   - 业务一般会根据系统暗色/用户选择来决定用 `defaultAlgorithm` 还是 `darkAlgorithm`
 *   - theme 包只负责给出“可注入的 token 覆写”
 *
 * 覆写优先级（从低到高）：
 * 1) `antdTokenMap`/`antdComponentsMap` 的默认映射（来自设计稿）
 * 2) `options.overrides`（直接覆写 antd 全局 token）
 * 3) `options.components`（直接覆写 antd 组件级 token）
 */
function resolveAntdTheme(
  mode: ThemeMode,
  options: CreateAntdThemeOptions & { modeTokens?: Record<FarmToken, string> } = {}
): AntdThemeConfig {
  // antd 主题分两部分：
  // - `token`：全局 Design Token 覆盖（主要是 Seed/Map/Alias token）
  // - `components`：组件级 Token 覆盖（对齐设计稿里的状态色/局部差异）
  //
  // 这两部分都来自映射表（由 `sync:assets` 生成），业务侧一般不需要手工列 token。
  const token: Record<string, string | number> = {
    borderRadius: options.borderRadius ?? 8
  };

  for (const [antdToken, farmToken] of Object.entries(antdTokenMap)) {
    token[antdToken] = options.modeTokens?.[farmToken as FarmToken] ?? getToken(mode, farmToken as FarmToken);
  }

  if (options.overrides) {
    Object.assign(token, options.overrides);
  }

  const components = resolveAntdComponents(mode, { modeTokens: options.modeTokens, overrides: options.components });
  return Object.keys(components).length > 0 ? { token, components } : { token };
}

/**
 * 主题包内置的 antd 主题配置（light/dark）。
 * - 只包含我们明确映射过的 token（见 `antdTokenMap/antdComponentsMap`）
 * - 其余 token 仍由 antd algorithm 派生
 *
 * 多项目覆写请使用 `createTheme()`，不要直接修改这个对象。
 */
export const antdTheme: Record<ThemeMode, AntdThemeConfig> = {
  light: resolveAntdTheme('light'),
  dark: resolveAntdTheme('dark')
};

export type ThemeBundle = {
  finexUi: FinexUi;
  tokens: FarmTokensByMode;
  cssVars: CssVarsByMode;
  antdTheme: Record<ThemeMode, AntdThemeConfig>;
};

export type CreateThemeOptions = {
  finexUi?: FinexUi;
  /**
   * 项目级覆写（最常用的多项目能力）：
   * - key 是 Farm Token
   * - value 是最终色值（建议用 hex / rgba）
   *
   * 覆写顺序：
   * - overrides 会影响 `tokens/cssVars/antdTheme/components` 的最终结果
   */
  overrides?: Partial<Record<ThemeMode, Partial<Record<FarmToken, string>>>>;
  /**
   * 透传给 antdTheme 生成逻辑（仅影响 antd 的 `ConfigProvider theme`）
   * - `overrides` 仍是第一优先级（先改变 Farm Token，再映射到 antd）
   * - `antd.light/dark.overrides` 用于“最后一公里”覆盖（例如某些 antd token 必须和算法保持一致时）
   */
  antd?: Partial<Record<ThemeMode, CreateAntdThemeOptions>>;
};

/**
 * 多项目/多皮肤主题工厂：
 * - 以 finex token 为源，产出 Farm Token / CSS Vars / Antd Theme
 * - 通过 overrides 覆写 Farm Token，可实现不同项目品牌色/背景色差异
 *
 * 推荐用法：
 * - 组件库/业务组件：消费 `theme.tokens` 或 CSS 变量（不要直接消费 finex key）
 * - antd：消费 `theme.antdTheme[mode]`
 *
 * 维护要点：
 * - 本函数的返回值是“一次性快照”，建议在业务侧用 memo 缓存（避免每次 render 都重新组装对象）
 * - 如果你需要让 antd 的 dark 算法生效，仍需在业务侧传入 `algorithm: darkAlgorithm/defaultAlgorithm`
 */
export function createTheme(options: CreateThemeOptions = {}): ThemeBundle {
  const finex = options.finexUi ?? finexUi;

  const resolvedTokens: FarmTokensByMode = {
    light: resolveModeTokens('light', { finexUi: finex, overrides: options.overrides?.light }),
    dark: resolveModeTokens('dark', { finexUi: finex, overrides: options.overrides?.dark })
  };

  const resolvedCssVars: CssVarsByMode = {
    light: resolveModeCssVars('light', resolvedTokens.light),
    dark: resolveModeCssVars('dark', resolvedTokens.dark)
  };

  const resolvedAntdTheme: Record<ThemeMode, AntdThemeConfig> = {
    light: resolveAntdTheme('light', { ...options.antd?.light, modeTokens: resolvedTokens.light }),
    dark: resolveAntdTheme('dark', { ...options.antd?.dark, modeTokens: resolvedTokens.dark })
  };

  return {
    finexUi: finex,
    tokens: resolvedTokens,
    cssVars: resolvedCssVars,
    antdTheme: resolvedAntdTheme
  };
}

export interface TailwindColors {
  [key: string]: string | TailwindColors;
}

/**
 * 将 `a.b.c` 形式的 token path 写入到嵌套对象：
 * - Tailwind 的 `theme.extend.colors` 支持嵌套对象（例如 `farm.brand.color.brand-2`）
 * - 这里的 value 会写成 `var(--farm-xxx)`，最终由 CSS 变量驱动
 */
function setNestedValue(obj: TailwindColors, path: string[], value: string): void {
  let current: TailwindColors = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]!;
    const next = current[key];
    if (!next || typeof next === 'string') {
      current[key] = {};
    }
    current = current[key] as TailwindColors;
  }
  current[path[path.length - 1]!] = value;
}

/**
 * Tailwind 颜色对象（可直接用于 `theme.extend.colors`）：
 * - 结构与 Farm Token 分段一致：`a.b.c` -> `{ a: { b: { c: 'var(--farm-a-b-c)' }}}`
 */
export const tailwindColors: TailwindColors = (() => {
  const root: TailwindColors = {};
  for (const token of farmTokens) {
    const path = token.split('.');
    setNestedValue(root, path, `var(${cssVarNames[token]})`);
  }
  return root;
})();

/**
 * Tailwind preset：
 * - 使用方式：`presets: [require('@farm-design-system/theme/tailwind')]`
 * - 产物同时提供 ESM/CJS（见 package.json exports）
 */
export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        farm: tailwindColors
      }
    }
  }
} as const;
