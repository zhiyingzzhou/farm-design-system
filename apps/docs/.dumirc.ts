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
   * - 这里通过 Umi 的 `theme` 变量覆写“基础视觉”（颜色/布局尺寸），让默认组件整体更接近 VitePress 风格
   * - 细节再由 `apps/docs/.dumi/global.less` 与少量 slot 覆盖完成
   */
  theme: {
    // Colors
    // 设计稿品牌色：Light = #5856d7，Dark = #6a66f6（与 @farm-design-system/theme 的 Brand-2 一致）
    '@c-primary': '#5856d7',
    '@c-primary-dark': '#6a66f6',
    // VitePress 的 Light 背景更偏白，边框与文本更克制
    '@c-site-bg': '#ffffff',
    '@c-text': '#3c3c43',
    '@c-text-secondary': '#5d5d68',
    '@c-text-note': '#8f8f99',
    '@c-border': '#e2e2e3',
    '@c-border-light': '#f1f1f2',

    // Layout
    // 对齐 farm-design-docs：内容容器更克制（max-w-7xl ≈ 1280px），侧栏 280px
    '@s-content-width': '1280px',
    '@s-sidebar-width': '280px',
    '@s-header-height': '64px',
    '@s-header-height-m': '56px'
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
