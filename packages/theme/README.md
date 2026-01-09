# @farm-design-system/theme

该包将 **Finex 设计 Token**（`finex-ui.json`）映射为：

- **Ant Design Token**（用于 `ConfigProvider` 定制主题；业务组件与 `@farm-design-system/ui` 统一复用 antd token）
- **CSS 变量 / Tailwind 颜色**（变量名同样基于 antd token，便于在样式层直接复用）

## 用法（推荐）

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

默认变量命名：

- `colorPrimary` -> `--farm-color-primary`
- `colorText` -> `--farm-color-text`

## 支持不同项目（覆写 antd token）

```ts
import { createTheme } from '@farm-design-system/theme';

const theme = createTheme({
  overrides: {
    light: {
      // 项目 A 的品牌主色
      colorPrimary: '#00b96b'
    }
  }
});

// theme.antdTheme.light / theme.cssVars.light / theme.tokens.light
```

## 维护：同步 Figma/Token Studio 导出

1. 用 Token Studio 导出覆盖 `packages/theme/scripts/finex-ui.json`
2. 运行 `pnpm --filter @farm-design-system/theme sync:assets` 生成：
   - `packages/theme/src/finex-ui.json`
   - `packages/theme/src/adapters/antd-token-map.json`
   - `packages/theme/src/adapters/antd-components-map.json`
3. 运行 `pnpm --filter @farm-design-system/theme check:antd:coverage` 查看是否有 finex key 未被 antd 侧消费到
4. 如需调整映射规则：改 `packages/theme/scripts/finex-to-antd-map.ts`

更多维护说明见 `packages/theme/MAINTENANCE.md`。

