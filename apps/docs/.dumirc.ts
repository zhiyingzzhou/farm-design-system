import { defineConfig } from 'dumi';
import path from 'node:path';

const repoRoot = path.join(__dirname, '../..');

export default defineConfig({
  themeConfig: {
    name: 'Farm Design System',
    logo: false,
    // docs 站支持 light/dark/auto 三种模式；切换结果会写入 localStorage，并同步到 html[data-prefers-color]。
    prefersColor: { default: 'auto', switch: true }
  },
  /**
   * dumi 默认主题基于 less 变量组织样式：
   * - 这里通过 Umi 的 `theme` 变量覆写“基础视觉”（颜色/布局尺寸），让默认组件整体更接近 arco 风格
   * - 细节再由 `apps/docs/.dumi/global.less` 与少量 slot 覆盖完成
   */
  theme: {
    // Colors
    // 设计稿品牌色：Light = #5856d7，Dark = #6a66f6（与 @farm-design-system/theme 的 Brand-2 一致）
    '@c-primary': '#5856d7',
    '@c-primary-dark': '#6a66f6',
    '@c-site-bg': '#f5f7fa',
    '@c-text': '#1d2129',
    '@c-text-secondary': '#4e5969',
    '@c-text-note': '#86909c',
    '@c-border': '#e5e6eb',
    '@c-border-light': '#f2f3f5',

    // Layout
    '@s-sidebar-width': '240px',
    '@s-header-height': '64px',
    '@s-header-height-m': '52px'
  },
  alias: {
    '@farm-design-system/ui': path.join(repoRoot, 'packages/ui/src'),
    '@farm-design-system/utils': path.join(repoRoot, 'packages/utils/src'),
    '@farm-design-system/theme': path.join(repoRoot, 'packages/theme/src')
  },
  resolve: {
    atomDirs: [{ type: 'component', dir: path.join(repoRoot, 'packages/ui/src') }]
  }
});
