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

`@farm-design-system/theme` 的目标是把设计侧的 **Finex Token**（来自 Figma/Token Studio）统一落到一套**可复用、可多项目覆写**的主题体系里，让：

- `@farm-design-system/ui` 组件库能直接使用（随主题变化）
- 业务样式能直接使用（CSS 变量 / Tailwind）
- antd 能直接使用（`ConfigProvider theme`）

核心原则：业务侧尽量只依赖 **Farm Token**（我们自己的语义层），不要直接绑定 antd token 名称。

## 概念速览

### Finex Token（设计侧）

- 设计稿/Token Studio 导出的命名，例如 `Brand-Color-Brand-2`
- 只用于对照设计与生成 Farm Token，不建议业务直接消费

### Farm Token（主题包对外语义层）

- 主题包对外的稳定入口，例如 `brand-color-brand-2`
- 业务组件、`@farm-design-system/ui`、CSS 变量、Tailwind 都应尽量只用这一层

### antd token（消费端）

- antd 的 Seed/Map/Alias token，例如 `colorPrimary`、`colorBgContainer`
- antd 的组件级 token，例如 `Button.colorPrimary`
- 主题包通过映射把 Farm Token 注入给 antd，而不是让业务直接写 antd token

## 推荐用法（应用侧组合）

主题包主入口保持无副作用（避免默认强绑定 React/运行时逻辑），推荐在应用里自行组合：

```tsx
import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { antdTheme as farmAntdTheme, createTokensCss, cssVars } from '@farm-design-system/theme';
import { Button } from '@farm-design-system/ui';

export default function App() {
  const appearance: 'light' | 'dark' = 'light';

  return (
    <ConfigProvider
      theme={{
        ...farmAntdTheme[appearance],
        algorithm: appearance === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
      }}
    >
      {/* 注入 Farm Token 的 CSS 变量（供业务样式/Tailwind 使用） */}
      <style>{createTokensCss({ vars: cssVars })}</style>

      {/* 让变量选择器命中（默认选择器包含 [data-theme="light|dark"]） */}
      <div data-theme={appearance}>
        <Button type="primary">Hello</Button>
      </div>
    </ConfigProvider>
  );
}
```

要点：

- `farmAntdTheme[mode]` 只提供 token 覆写；`algorithm` 由应用决定
- `createTokensCss()` 只生成 CSS 变量定义，不会引入任何组件样式

## 推荐：使用 FarmProvider（React 入口）

`FarmProvider` 由主题包提供（`@farm-design-system/theme/react`），用于把：

- antd `ConfigProvider` 的主题注入
- Farm Token 的 CSS 变量注入
- `data-theme`（light/dark）切换

统一封装在一起。`@farm-design-system/ui` 只负责组件实现与导出。

它默认会使用 `@farm-design-system/theme` 的内置配置：

- 自动注入 `tokensCss`（两套 light/dark 选择器都会生成）
- 自动注入 `antdTheme[mode]`，并按 mode 选择 antd algorithm

因此最简单用法只需要传入 `mode`：

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

多项目换肤（覆写 Farm Token）时，把生成结果透传给 `FarmProvider`：

```tsx | pure
import React from 'react';
import { createTheme, createTokensCss } from '@farm-design-system/theme';
import { FarmProvider } from '@farm-design-system/theme/react';
import { Button } from '@farm-design-system/ui';

export default function App() {
  const mode: 'light' | 'dark' = 'light';

  const theme = createTheme({
    overrides: {
      light: {
        'brand-color-brand-2': '#00b96b'
      }
    }
  });

  return (
    <FarmProvider mode={mode} tokensCss={createTokensCss({ vars: theme.cssVars })} antdTheme={theme.antdTheme[mode]}>
      <Button type="primary">Hello</Button>
    </FarmProvider>
  );
}
```

不需要主题时，不要使用 `FarmProvider` 包裹即可：

```tsx
import React from 'react';
import { Button } from '@farm-design-system/ui';

export default function Demo() {
  return <Button type="primary">No theme</Button>;
}
```

## 多项目换肤（覆写 Farm Token）

多项目最推荐的方式：只覆写 Farm Token（而不是直接覆写 antd token）。

```ts
import { createTheme } from '@farm-design-system/theme';

const theme = createTheme({
  overrides: {
    light: {
      // 项目 A 的品牌主色
      'brand-color-brand-2': '#00b96b'
    },
    dark: {
      // 项目 A 的暗色品牌主色
      'brand-color-brand-2': '#00b96b'
    }
  }
});

// theme.tokens / theme.cssVars / theme.antdTheme 会一起跟着变
```

为什么要这样做：

- 同一份覆写能同时驱动 antd + CSS 变量 + Tailwind，避免三端割裂

## 进阶：只在 antd 做“最后一公里”修正

少数场景你可能需要直接覆写 antd token（例如某个组件的派生色阶与设计不一致）：

```ts
import { createTheme } from '@farm-design-system/theme';

const theme = createTheme({
  antd: {
    light: {
      borderRadius: 10,
      overrides: {
        // 直接覆写 antd token（不建议常用）
        // 例如：让某些容器背景保持一致
        colorBgContainer: '#ffffff'
      },
      components: {
        // 直接覆写 antd 组件 token（不建议常用）
        Button: {
          colorPrimary: '#5856d7'
        }
      }
    }
  }
});
```

建议：

- 优先用 `overrides` 覆写 Farm Token；只有在“必须直接改 antd token”时才用这里

## Tailwind 用法

主题包会输出 Tailwind preset（同时支持 CJS/ESM），把所有 Farm Token 暴露成 `colors.farm.*`：

```ts
// tailwind.config.(js|cjs)
module.exports = {
  presets: [require('@farm-design-system/theme/tailwind')],
};
```

使用时直接写：

```html
<div class="bg-farm-bg-color-bg-1 text-farm-text-color-text-1">...</div>
```

本质上它会落到 `var(--farm-xxx)`，最终由 `createTokensCss()` 注入的 CSS 变量驱动。

## 维护：从 Figma 同步 token

如果你在维护主题（而不是仅消费主题），请按下面流程：

1. Token Studio 导出覆盖 `packages/theme/scripts/finex-ui.json`
2. 执行 `pnpm --filter @farm-design-system/theme sync:assets`
3. 执行 `pnpm --filter @farm-design-system/theme check:antd:coverage`
4. 如需调整映射规则，只改 `packages/theme/scripts/sync-src-assets.ts`

更完整的维护手册见：[`packages/theme/MAINTENANCE.md`](/theme/maintenance)。
