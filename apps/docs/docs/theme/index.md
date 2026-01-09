---
title: 主题
order: 1
nav:
  title: 主题
  order: 3
group:
  title: 使用
  order: 1
toc: content
---

# 主题（@farm-design-system/theme）

`@farm-design-system/theme` 的目标是把设计侧的 **Finex Token**（来自 Figma/Token Studio）统一落到一套主题体系里，让：

- `@farm-design-system/ui` 组件库能直接使用（随主题变化）
- 业务样式能直接使用（CSS 变量 / Tailwind）
- antd 能直接使用（`ConfigProvider theme`）

核心策略：**以 antd token 作为语义层**（不再维护 Farm 自己的一套语义 token），业务组件与 UI 组件统一复用 antd token，减少维护成本。

## 概念速览

### Finex Token（设计侧）

- 设计稿/Token Studio 导出的命名，例如 `Brand-Color-Brand-2`
- 只用于维护映射与对照设计，不建议业务直接消费

### antd token（语义层 + 消费端）

- antd 全局 token：例如 `colorPrimary`、`colorBgContainer`
- antd 组件级 token：例如 `Button.defaultActiveBg`
- 主题包通过映射把 finex key 注入给 antd（以及输出同名 CSS 变量）

### CSS 变量（基于 antd token）

默认变量命名：

- `colorPrimary` -> `--farm-color-primary`
- `colorText` -> `--farm-color-text`

## 推荐用法（应用侧组合）

主题包主入口保持无副作用（避免默认强绑定 React/运行时逻辑），推荐在应用里自行组合：

```tsx
import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { antdTheme as farmAntdTheme, createTokensCss, cssVars } from '@farm-design-system/theme';
import { Button } from '@farm-design-system/ui';

export default function App() {
  const mode: 'light' | 'dark' = 'light';

  return (
    <ConfigProvider
      theme={{
        ...farmAntdTheme[mode],
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
      }}
    >
      {/* 注入基于 antd token 的 CSS 变量（供业务样式/Tailwind 使用） */}
      <style>{createTokensCss({ vars: cssVars })}</style>

      {/* 让变量选择器命中（默认选择器包含 [data-theme="light|dark"]） */}
      <div data-theme={mode}>
        <Button type="primary">Hello</Button>
      </div>
    </ConfigProvider>
  );
}
```

要点：

- `farmAntdTheme[mode]` 只提供 token/components 覆写；`algorithm` 由应用决定
- `createTokensCss()` 只生成 CSS 变量定义，不会引入任何组件样式

## 推荐：使用 FarmProvider（React 入口）

`FarmProvider` 由主题包提供（`@farm-design-system/theme/react`），用于把：

- antd `ConfigProvider` 的主题注入
- 基于 antd token 的 CSS 变量注入（可关闭）
- `data-theme`（light/dark）切换

统一封装在一起。`@farm-design-system/ui` 只负责组件实现与导出。

最简单用法只需要传入 `mode`：

```tsx | pure
import React from 'react';
import { FarmProvider } from '@farm-design-system/theme/react';
import { Button } from '@farm-design-system/ui';

export default function App() {
  const mode: 'light' | 'dark' = 'light';

  return (
    <FarmProvider mode={mode}>
      <Button type="primary">Hello</Button>
    </FarmProvider>
  );
}
```

## 多项目换肤（覆写 antd token）

多项目最推荐的方式：只覆写 antd token 的最终值：

```ts
import { createTheme } from '@farm-design-system/theme';

const theme = createTheme({
  overrides: {
    light: {
      // 项目 A 的品牌主色
      colorPrimary: '#00b96b'
    },
    dark: {
      colorPrimary: '#00b96b'
    }
  }
});

// theme.tokens / theme.cssVars / theme.antdTheme 会一起跟着变
```

配合 `FarmProvider`：

```tsx | pure
import React from 'react';
import { createTheme, createTokensCss } from '@farm-design-system/theme';
import { FarmProvider } from '@farm-design-system/theme/react';
import { Button } from '@farm-design-system/ui';

export default function App() {
  const mode: 'light' | 'dark' = 'light';

  const theme = createTheme({
    overrides: {
      light: { colorPrimary: '#00b96b' }
    }
  });

  return (
    <FarmProvider mode={mode} tokensCss={createTokensCss({ vars: theme.cssVars })} antdTheme={theme.antdTheme[mode]}>
      <Button type="primary">Hello</Button>
    </FarmProvider>
  );
}
```

## Tailwind 用法

主题包会输出 Tailwind preset（同时支持 CJS/ESM），把映射过的 antd token 暴露成 `colors.farm.*`：

```ts
// tailwind.config.(js|cjs)
module.exports = {
  presets: [require('@farm-design-system/theme/tailwind')],
};
```

使用示例：

```html
<div class="bg-farm-color-bg-base text-farm-color-text">...</div>
```

本质上它会落到 `var(--farm-xxx)`（变量名基于 antd token），最终由 `createTokensCss()` 注入的 CSS 变量驱动。

## 维护：从 Figma 同步 token

如果你在维护主题（而不是仅消费主题），请按下面流程：

1. Token Studio 导出覆盖 `packages/theme/scripts/finex-ui.json`
2. 执行 `pnpm --filter @farm-design-system/theme sync:assets`
3. 执行 `pnpm --filter @farm-design-system/theme check:antd:coverage`
4. 如需调整映射规则：改 `packages/theme/scripts/finex-to-antd-map.ts`（不要手改 JSON）

更完整的维护手册见：[`packages/theme/MAINTENANCE.md`](/theme/maintenance)。

