/**
 * @farm-design-system/theme 公共入口
 *
 * 设计原则：
 * - 这里只导出“token 数据与生成函数”，不做任何运行时副作用（不注入样式、不操作 DOM）
 * - 业务侧可以按自己的工程习惯选择：
 *   - `createTokensCss()` 生成 CSS 变量并注入
 *   - `antdTheme`/`createTheme().antdTheme` 交给 antd `ConfigProvider`
 *   - `tailwindPreset` 作为 Tailwind presets 引入
 * - 如需 React 侧的统一接入封装，请使用 `@farm-design-system/theme/react`（可选入口）
 *
 * 维护说明见：`packages/theme/MAINTENANCE.md`
 */
export {
  antdComponentsMap,
  antdTheme,
  antdTokenMap,
  createTheme,
  createTokensCss,
  cssVarName,
  cssVarNames,
  cssVars,
  farmTokenMap,
  finexUi,
  getToken,
  tailwindColors,
  tailwindPreset,
  tokens,
  type CreateAntdThemeOptions,
  type CreateThemeOptions,
  type AntdThemeConfig,
  type AntdTokenName,
  type CssVarsByMode,
  type FinexUi,
  type FarmToken,
  type FarmTokensByMode,
  type FinexTokenKey,
  type ThemeBundle,
  type ThemeMode,
  type TokensCssOptions
} from './tokens';
