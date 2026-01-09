import antdTokenMapJson from './adapters/antd-token-map.json';
import antdComponentsMapJson from './adapters/antd-components-map.json';
import finexUiJson from './finex-ui.json';

export type ThemeMode = 'light' | 'dark';

type JsonRecord = Record<string, unknown>;

type TokenLeaf = {
  value: string;
  type?: string;
};

/**
 * 统一后的 finex token 结构：
 * - `light/dark` 两套扁平 token（key 为 finex 原始命名，例如 `Brand-Color-Brand-2`）
 * - value 为最终可消费的颜色值（已把 `{Grey.18}` 等引用解析完成）
 */
export type FinexUi = Record<ThemeMode, Record<string, string>>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTokenLeaf(node: unknown): node is TokenLeaf {
  return isRecord(node) && typeof node.value === 'string';
}

function normalizeRef(value: string): string | null {
  const match = /^\{(.+)\}$/.exec(value.trim());
  return match ? match[1] : null;
}

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

function toFinexKey(pathParts: string[]): string {
  if (pathParts.length === 0) return '';
  const groups = pathParts
    .slice(0, -1)
    .map((part) => part.trim().replaceAll(/\s+/g, '-'));
  const leaf = pathParts[pathParts.length - 1].trim().replaceAll(/\s+/g, ' ');
  return [...groups, leaf].join('-');
}

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
      // 只同步颜色类 token；避免把 Token Studio 里的 text/number 等类型混进主题色体系
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

function isFinexUiResolved(raw: unknown): raw is FinexUi {
  if (!isRecord(raw)) return false;
  return isRecord(raw.light) && isRecord(raw.dark);
}

function resolveFinexUi(raw: unknown): FinexUi {
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

/** Finex 设计 token（已解析）。 */
export const finexUi = finexUiResolved;

/** antd 全局 token -> finex key（由 `sync:assets` 生成）。 */
export const antdTokenMap = antdTokenMapJson as Record<string, string>;

/** antd 组件级 token -> finex key（由 `sync:assets` 生成）。 */
export const antdComponentsMap = antdComponentsMapJson as unknown as Record<string, Record<string, string>>;

function assertThemeIntegrity(): void {
  const finexLight = finexUi.light;
  const finexDark = finexUi.dark;

  for (const [antdToken, finexKey] of Object.entries(antdTokenMap)) {
    if (typeof finexKey !== 'string') {
      throw new Error(`@farm-design-system/theme: antdTokenMap["${antdToken}"] 必须是 string。`);
    }
    if (!Object.prototype.hasOwnProperty.call(finexLight, finexKey)) {
      throw new Error(`@farm-design-system/theme: antdTokenMap["${antdToken}"] 指向不存在的 finex key "${finexKey}" (light)。`);
    }
    if (!Object.prototype.hasOwnProperty.call(finexDark, finexKey)) {
      throw new Error(`@farm-design-system/theme: antdTokenMap["${antdToken}"] 指向不存在的 finex key "${finexKey}" (dark)。`);
    }
  }

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    if (!isRecord(tokenMap)) {
      throw new Error(`@farm-design-system/theme: antdComponentsMap["${componentName}"] 必须是对象。`);
    }
    for (const [componentToken, finexKey] of Object.entries(tokenMap)) {
      if (typeof finexKey !== 'string') {
        throw new Error(`@farm-design-system/theme: antdComponentsMap["${componentName}"]["${componentToken}"] 必须是 string。`);
      }
      if (!Object.prototype.hasOwnProperty.call(finexLight, finexKey)) {
        throw new Error(
          `@farm-design-system/theme: antdComponentsMap["${componentName}"]["${componentToken}"] 指向不存在的 finex key "${finexKey}" (light)。`
        );
      }
      if (!Object.prototype.hasOwnProperty.call(finexDark, finexKey)) {
        throw new Error(
          `@farm-design-system/theme: antdComponentsMap["${componentName}"]["${componentToken}"] 指向不存在的 finex key "${finexKey}" (dark)。`
        );
      }
    }
  }
}

assertThemeIntegrity();

export type AntdTokenName = string;

const mappedAntdTokens = Object.keys(antdTokenMap);

export type MappedAntdTokensByMode = Record<ThemeMode, Record<AntdTokenName, string>>;

function resolveModeTokens(
  mode: ThemeMode,
  options: { finexUi: FinexUi; overrides?: Record<string, string> } // 覆写最终色值（hex/rgba）
): Record<string, string> {
  const modeFinex = options.finexUi[mode];
  const result: Record<string, string> = {};
  for (const [antdToken, finexKey] of Object.entries(antdTokenMap)) {
    result[antdToken] = options.overrides?.[antdToken] ?? modeFinex[finexKey]!;
  }
  return result;
}

/**
 * 内置主题的“映射后 antd token 值”（light/dark）。
 * - key：antd token 名
 * - value：最终色值（由 finex key 解引用后得到）
 */
export const tokens: MappedAntdTokensByMode = {
  light: resolveModeTokens('light', { finexUi }),
  dark: resolveModeTokens('dark', { finexUi })
};

export function getToken(mode: ThemeMode, token: AntdTokenName): string {
  const value = tokens[mode]?.[token];
  if (value === undefined) {
    throw new Error(`@farm-design-system/theme: 未找到 token "${token}"（当前仅暴露 antdTokenMap 里声明过的 token）。`);
  }
  return value;
}

/**
 * antd token -> CSS var name（与 antd `theme.cssVar.prefix` 的规则保持一致）。
 *
 * - 统一前缀 `--farm-` 作为命名空间，避免与业务/第三方变量冲突
 * - `colorPrimary` -> `--farm-color-primary`
 */
export function cssVarName(token: AntdTokenName): `--farm-${string}` {
  // 与 @ant-design/cssinjs 的 token2CSSVar 保持一致
  return (`--farm-${token}` as const)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1-$2')
    .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
    .toLowerCase() as `--farm-${string}`;
}

export const cssVarNames: Record<AntdTokenName, `--farm-${string}`> = mappedAntdTokens.reduce(
  (acc, token) => {
    acc[token] = cssVarName(token);
    return acc;
  },
  {} as Record<AntdTokenName, `--farm-${string}`>
);

export type CssVarsByMode = Record<ThemeMode, Record<`--farm-${string}`, string>>;

function resolveModeCssVars(modeTokens: Record<string, string>): Record<`--farm-${string}`, string> {
  const result = {} as Record<`--farm-${string}`, string>;
  for (const token of mappedAntdTokens) {
    result[cssVarNames[token]] = modeTokens[token]!;
  }
  return result;
}

export const cssVars: CssVarsByMode = {
  light: resolveModeCssVars(tokens.light),
  dark: resolveModeCssVars(tokens.dark)
};

export type TokensCssOptions = {
  lightSelector?: string;
  darkSelector?: string;
  /** 支持传入自定义 vars（例如多项目覆写后生成的 cssVars） */
  vars?: CssVarsByMode;
};

function formatCssVarBlock(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * 生成 CSS 变量声明文本（同时包含 light/dark 两套）。
 *
 * 默认选择器：
 * - light：`:root, [data-theme="light"], .light`
 * - dark：`[data-theme="dark"], .dark`
 */
export function createTokensCss(options: TokensCssOptions = {}): string {
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
  token: Record<string, string | number>;
  components?: Record<string, Record<string, string | number>>;
};

export type CreateAntdThemeOptions = {
  borderRadius?: number;
  /** 最后一公里覆写 antd token（不建议日常使用） */
  overrides?: Record<string, string | number>;
  /** 最后一公里覆写 antd 组件级 token（不建议日常使用） */
  components?: Record<string, Record<string, string | number>>;
};

function resolveAntdComponents(
  mode: ThemeMode,
  options: { finexUi?: FinexUi; overrides?: Record<string, Record<string, string | number>> } = {}
): Record<string, Record<string, string | number>> {
  const result: Record<string, Record<string, string | number>> = {};
  const modeFinex = (options.finexUi ?? finexUi)[mode];

  for (const [componentName, tokenMap] of Object.entries(antdComponentsMap)) {
    const componentTokens: Record<string, string | number> = {};
    for (const [componentToken, finexKey] of Object.entries(tokenMap)) {
      componentTokens[componentToken] = modeFinex[finexKey]!;
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

function resolveAntdTheme(
  mode: ThemeMode,
  options: CreateAntdThemeOptions & { modeTokens?: Record<string, string>; finexUi?: FinexUi } = {}
): AntdThemeConfig {
  const modeFinexUi = options.finexUi ?? finexUi;
  const token: Record<string, string | number> = {
    borderRadius: options.borderRadius ?? 8
  };

  for (const [antdToken, finexKey] of Object.entries(antdTokenMap)) {
    token[antdToken] = options.modeTokens?.[antdToken] ?? modeFinexUi[mode][finexKey]!;
  }

  if (options.overrides) {
    Object.assign(token, options.overrides);
  }

  const components = resolveAntdComponents(mode, { finexUi: modeFinexUi, overrides: options.components });
  return Object.keys(components).length > 0 ? { token, components } : { token };
}

/**
 * 主题包内置的 antd 主题配置（light/dark）。
 * - 只包含我们明确映射过的 token（见 `antdTokenMap/antdComponentsMap`）
 * - 其余 token 仍由 antd algorithm 派生
 */
export const antdTheme: Record<ThemeMode, AntdThemeConfig> = {
  light: resolveAntdTheme('light'),
  dark: resolveAntdTheme('dark')
};

export type ThemeBundle = {
  finexUi: FinexUi;
  tokens: MappedAntdTokensByMode;
  cssVars: CssVarsByMode;
  antdTheme: Record<ThemeMode, AntdThemeConfig>;
};

export type CreateThemeOptions = {
  finexUi?: FinexUi;
  /**
   * 项目级覆写（最常用的多项目能力）：
   * - key 是 antd token 名（例如 colorPrimary）
   * - value 是最终色值（建议用 hex / rgba）
   *
   * 覆写顺序：
   * - overrides 会影响 `tokens/cssVars/antdTheme` 的最终结果
   */
  overrides?: Partial<Record<ThemeMode, Partial<Record<string, string>>>>;
  /**
   * 透传给 antdTheme 生成逻辑（仅影响 antd 的 `ConfigProvider theme`）
   * - `overrides` 仍是第一优先级（先覆写映射后的 token，再注入给 antd）
   * - `antd.light/dark.overrides` 用于“最后一公里”覆盖（例如某些 antd token 必须和算法保持一致时）
   */
  antd?: Partial<Record<ThemeMode, CreateAntdThemeOptions>>;
};

export function createTheme(options: CreateThemeOptions = {}): ThemeBundle {
  const finex = options.finexUi ?? finexUi;

  const resolvedTokens: MappedAntdTokensByMode = {
    light: resolveModeTokens('light', { finexUi: finex, overrides: options.overrides?.light as Record<string, string> | undefined }),
    dark: resolveModeTokens('dark', { finexUi: finex, overrides: options.overrides?.dark as Record<string, string> | undefined })
  };

  const resolvedCssVars: CssVarsByMode = {
    light: resolveModeCssVars(resolvedTokens.light),
    dark: resolveModeCssVars(resolvedTokens.dark)
  };

  const resolvedAntdTheme: Record<ThemeMode, AntdThemeConfig> = {
    light: resolveAntdTheme('light', { ...options.antd?.light, modeTokens: resolvedTokens.light, finexUi: finex }),
    dark: resolveAntdTheme('dark', { ...options.antd?.dark, modeTokens: resolvedTokens.dark, finexUi: finex })
  };

  return {
    finexUi: finex,
    tokens: resolvedTokens,
    cssVars: resolvedCssVars,
    antdTheme: resolvedAntdTheme
  };
}

export const tailwindColors: Record<string, string> = (() => {
  const result: Record<string, string> = {};
  for (const token of mappedAntdTokens) {
    const varName = cssVarNames[token];
    const key = varName.replace(/^--farm-/, '');
    result[key] = `var(${varName})`;
  }
  return result;
})();

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        farm: tailwindColors
      }
    }
  }
} as const;
