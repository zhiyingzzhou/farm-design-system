import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ConfigProviderProps } from 'antd';
import { useStyleRegister, type CSSObject } from '@ant-design/cssinjs';
import type { GlobalToken } from 'antd/es/theme/interface';

import { antdTheme as farmAntdTheme, createTokensCss, type ThemeMode } from './tokens';

export type FarmThemeMode = ThemeMode;
export type FarmThemeScope = 'wrap' | 'document';
export type Theme = GlobalToken;
export type { CSSObject };

export type FarmProviderProps = {
  /** light/dark；用于驱动主题切换（默认：light）。 */
  mode?: FarmThemeMode;
  /**
   * mode 生效范围：
   * - wrap：用一个 div 包裹 children，并设置 `data-theme`
   * - document：设置到 `document.documentElement`（不额外包裹 DOM）
   *
   * 默认：document
   */
  scope?: FarmThemeScope;
  /**
   * CSS 变量声明文本（通常来自 `createTokensCss()` 或 `createTheme().cssVars`）。
   * - 默认会注入 `createTokensCss()` 的结果（同时包含 light/dark 两套选择器）
   * - 传空字符串可关闭注入
   */
  tokensCss?: string;
  /**
   * 透传给 antd 的 `ConfigProvider` 的主题配置（通常来自 `antdTheme[mode]` 或 `createTheme().antdTheme[mode]`）。
   * - 默认会注入 `antdTheme[mode]`，并按 mode 自动选择 antd algorithm
   * - 传入时会与默认值做合并（token/components 以传入为准）
   */
  antdTheme?: ConfigProviderProps['theme'];
  /** 透传给 antd `ConfigProvider` 的其它参数（locale/prefixCls/componentSize 等）。 */
  antdConfig?: Omit<ConfigProviderProps, 'children' | 'theme'>;
  children?: React.ReactNode;
};

type ClassNameValue = string | undefined | null | false;

export function cx(...classNames: ClassNameValue[]): string {
  return classNames.filter(Boolean).join(' ');
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'number' || valueType === 'boolean') return String(value);
  if (valueType !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function hashString(input: string): string {
  // djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function safeClassNamePart(input: string): string {
  return input.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
}

export function useTheme(): Theme {
  return antdTheme.useToken().token;
}

export function createStyles<Styles extends Record<string, CSSObject>>(stylesFn: (theme: Theme) => Styles): () => {
  styles: { [K in keyof Styles]: string };
  cx: typeof cx;
  theme: Theme;
};

export function createStyles<Params, Styles extends Record<string, CSSObject>>(
  stylesFn: (theme: Theme, params: Params) => Styles
) : (params: Params) => {
  styles: { [K in keyof Styles]: string };
  cx: typeof cx;
  theme: Theme;
};

export function createStyles<Params, Styles extends Record<string, CSSObject>>(
  stylesFn: (theme: Theme, params: Params) => Styles
) {
  return function useStyles(params?: Params): {
    styles: { [K in keyof Styles]: string };
    cx: typeof cx;
    theme: Theme;
  } {
    const { theme: cssinjsTheme, token, hashId } = antdTheme.useToken();

    const computed = React.useMemo(() => stylesFn(token, params as Params), [token, params]);

    const classNames = React.useMemo(() => {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(computed)) {
        const suffix = hashString(stableStringify(value));
        result[key] = `farm-${safeClassNamePart(key)}-${suffix}`;
      }
      return result as { [K in keyof Styles]: string };
    }, [computed]);

    useStyleRegister(
      {
        theme: cssinjsTheme,
        token,
        hashId,
        path: ['@farm-design-system/theme', 'createStyles'],
        order: 1
      },
      () => {
        const rules: Record<string, CSSObject> = {};
        for (const [key, style] of Object.entries(computed)) {
          rules[`.${classNames[key as keyof Styles]}`] = style;
        }
        return rules;
      }
    );

    return { styles: classNames, cx, theme: token };
  };
}

function useDocumentThemeMode(scope: FarmThemeScope, mode: FarmThemeMode): void {
  React.useEffect(() => {
    if (scope !== 'document') return;
    if (typeof document === 'undefined') return;

    const el = document.documentElement;
    const prev = el.getAttribute('data-theme');
    el.setAttribute('data-theme', mode);

    return () => {
      if (prev === null) el.removeAttribute('data-theme');
      else el.setAttribute('data-theme', prev);
    };
  }, [scope, mode]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeAntdTheme(
  base: ConfigProviderProps['theme'],
  override: ConfigProviderProps['theme']
): ConfigProviderProps['theme'] {
  if (!override) return base;
  if (!base) return override;

  const baseObj = base as unknown;
  const overrideObj = override as unknown;
  if (!isRecord(baseObj) || !isRecord(overrideObj)) return { ...(baseObj as object), ...(overrideObj as object) };

  const merged: Record<string, unknown> = { ...baseObj, ...overrideObj };

  const baseToken = baseObj.token;
  const overrideToken = overrideObj.token;
  if (isRecord(baseToken) || isRecord(overrideToken)) {
    merged.token = { ...(isRecord(baseToken) ? baseToken : {}), ...(isRecord(overrideToken) ? overrideToken : {}) };
  }

  const baseComponents = baseObj.components;
  const overrideComponents = overrideObj.components;
  if (isRecord(baseComponents) || isRecord(overrideComponents)) {
    const result: Record<string, unknown> = {
      ...(isRecord(baseComponents) ? baseComponents : {}),
      ...(isRecord(overrideComponents) ? overrideComponents : {})
    };

    if (isRecord(baseComponents) && isRecord(overrideComponents)) {
      for (const [componentName, overrideValue] of Object.entries(overrideComponents)) {
        const baseValue = baseComponents[componentName];
        if (isRecord(baseValue) && isRecord(overrideValue)) {
          result[componentName] = { ...baseValue, ...overrideValue };
        }
      }
    }

    merged.components = result;
  }

  return merged as ConfigProviderProps['theme'];
}

export function FarmProvider(props: FarmProviderProps) {
  const {
    mode = 'light',
    scope = 'document',
    tokensCss,
    antdTheme: antdThemeOverrides,
    antdConfig,
    children
  } = props;

  useDocumentThemeMode(scope, mode);

  const resolvedTokensCss = React.useMemo(() => {
    if (tokensCss !== undefined) return tokensCss;
    return createTokensCss();
  }, [tokensCss]);

  const resolvedAntdTheme = React.useMemo<ConfigProviderProps['theme']>(() => {
    const base: ConfigProviderProps['theme'] = {
      ...farmAntdTheme[mode],
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
    };

    return antdThemeOverrides ? mergeAntdTheme(base, antdThemeOverrides) : base;
  }, [mode, antdThemeOverrides]);

  const content = scope === 'wrap' ? <div data-theme={mode}>{children}</div> : <>{children}</>;

  return (
    <ConfigProvider {...antdConfig} theme={resolvedAntdTheme}>
      {resolvedTokensCss ? <style>{resolvedTokensCss}</style> : null}
      {content}
    </ConfigProvider>
  );
}
