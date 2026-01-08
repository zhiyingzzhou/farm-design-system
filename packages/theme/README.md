# @farm-design-system/theme

该包将 **Finex 设计 Token**（`finex-ui.json`）统一映射为：

- **Farm Token**（用于业务组件 / UI 组件库 / Tailwind / CSS 变量）
- **Ant Design Token**（用于 `ConfigProvider` 定制主题）

## 用法（推荐）

```tsx
import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { antdTheme as farmAntdTheme, createTokensCss, cssVars } from '@farm-design-system/theme';
import { Button } from '@farm-design-system/ui';

export default function App() {
  const appearance = 'light';

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

## 更底层用法（自行组合）

```tsx
import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { createTheme, createTokensCss } from '@farm-design-system/theme';

export default function App() {
  const appearance = 'dark';
  const theme = createTheme({
    overrides: {
      light: {
        // 不同项目品牌色示例
        'brand-color-brand-2': '#00b96b'
      }
    }
  });

  return (
    <ConfigProvider
      theme={{
        ...theme.antdTheme[appearance],
        algorithm: appearance === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
      }}
    >
      <style>{createTokensCss({ vars: theme.cssVars })}</style>
      {/* ... */}
    </ConfigProvider>
  );
}
```

## 支持不同项目（覆写 Farm Token）

```ts
import { createTheme } from '@farm-design-system/theme';

const theme = createTheme({
  overrides: {
    light: {
      'brand-color-brand-2': '#00b96b'
    }
  }
});

// theme.antdTheme.light / theme.cssVars.light / theme.tokens.light
```

## 维护：同步 Figma/Token Studio 导出

1. 用 Token Studio 导出覆盖 `packages/theme/scripts/finex-ui.json`
2. 运行 `pnpm --filter @farm-design-system/theme sync:assets` 生成：
   - `packages/theme/src/finex-ui.json`
   - `packages/theme/src/adapters/farm-token-map.json`
   - `packages/theme/src/adapters/antd-token-map.json`
   - `packages/theme/src/adapters/antd-components-map.json`
3. 如需调整 antd 覆盖范围或组件细化规则，改 `packages/theme/scripts/sync-src-assets.ts`

更多维护说明见 `packages/theme/MAINTENANCE.md`。
