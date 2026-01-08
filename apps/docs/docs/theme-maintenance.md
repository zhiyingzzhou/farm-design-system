---
title: 主题维护手册
order: 2
toc: content
---

# 主题维护手册（@farm-design-system/theme）

> 本页由脚本从 `packages/theme/MAINTENANCE.md` 同步生成，请勿直接编辑。
> 如需修改内容，请编辑 `packages/theme/MAINTENANCE.md`，再运行 `pnpm --filter docs sync:theme-docs`（或 `pnpm --filter docs build`）。

本文面向维护者，目标是让你在**不打开 Figma** 的情况下，也能理解这套主题的“数据从哪来、怎么落地、改哪里最安全”。

## 1. 这包解决什么问题

一句话：把设计侧的 Finex Token（来自 Figma/Token Studio）变成一套**稳定、可复用、可多项目覆写**的主题能力，供：

- `@farm-design-system/ui` 组件库使用
- 业务组件/业务样式使用（CSS 变量 / Tailwind）
- antd 使用（通过 `ConfigProvider theme` 注入）

这里的核心约束是：**业务不直接依赖 antd token 名称**。业务只依赖 Farm Token（我们自己的语义层），antd 只是“消费端之一”。

## 2. 目录与文件（哪些能改，哪些别动）

### 2.1 设计源（输入）

- `packages/theme/scripts/finex-ui.json`
  - Token Studio 从 Figma 导出的原始 JSON。
  - 特点：包含 `base/base` + `xxx/Light` + `xxx/Dark`，并且可能存在 `{Grey.18}` 这种引用。
  - **维护方式：直接用新的导出覆盖它。**

### 2.2 运行时资产（会被源码 import）

这些文件由脚本生成，源码会直接 import，**不要手改**：

- `packages/theme/src/finex-ui.json`
  - `{ light, dark }` 的扁平结构（key 是 finex 命名，value 是最终色值）
  - 已经把 `{xxx}` 引用展开，运行时不会再做深度解析
- `packages/theme/src/adapters/farm-token-map.json`
  - Farm Token -> finex key
- `packages/theme/src/adapters/antd-token-map.json`
  - antd 全局 token -> Farm Token
- `packages/theme/src/adapters/antd-components-map.json`
  - antd 组件级 token -> Farm Token

### 2.3 脚本（唯一真相）

你要改映射规则，请改这里：

- `packages/theme/scripts/sync-src-assets.ts`
  - 从 `scripts/finex-ui.json` 解析并生成 `src/finex-ui.json` + `src/adapters/*.json`
  - 里面的 `buildAntdTokenMap/buildAntdComponentsMap` 是映射策略的唯一真相
- `packages/theme/scripts/build-assets.ts`
  - 构建 `dist`：CSS 变量、Tailwind preset、以及 adapters/json 的复制
- `packages/theme/scripts/check-antd-coverage.ts`
  - 检查 Farm Token 是否“被 antd 消费到”（全局 + 组件级）

### 2.4 主题逻辑（运行时合成）

- `packages/theme/src/tokens.ts`
  - 对外导出的核心逻辑：`tokens/cssVars/createTokensCss/createTheme/antdTheme/tailwindPreset`
  - 这里不包含任何 UI 组件样式，仅做 token 的解析与拼装

## 3. 名词解释（别混）

### 3.1 Finex key（设计侧命名）

示例：`Brand-Color-Brand-2`

- 这是从 Token Studio 的路径计算出来的稳定 key（见 `toFinexKey`）
- 只用于“和设计对照”与“生成 Farm Token”

### 3.2 Farm Token（主题包对外语义层）

示例：`brand-color-brand-2`

设计原则：

- **业务只认 Farm Token**（包括 `@farm-design-system/ui`）
- 允许未来扩展为分段结构（`a.b.c`），但目前设计稿给的 token 以 kebab-case 为主

### 3.3 antd token（消费端）

示例：`colorPrimary`、`colorBgContainerDisabled`、`Button.colorPrimary`

antd 的 token 分两类：

- 全局 token：放在 `ConfigProvider theme.token`
- 组件级 token：放在 `ConfigProvider theme.components.Button`

我们通过 `src/adapters/antd-token-map.json` + `src/adapters/antd-components-map.json` 控制“注入哪些、怎么注入”。

## 4. 数据流（从 Figma 到运行时）

按顺序：

1. Figma/Token Studio 导出 -> 覆盖 `packages/theme/scripts/finex-ui.json`
2. 运行 `pnpm --filter @farm-design-system/theme sync:assets`
   - 解析引用、扁平化
   - 生成 `packages/theme/src/finex-ui.json`
   - 生成 `packages/theme/src/adapters/*.json`
3. 业务侧运行时使用：
   - `createTheme()`：生成“多项目覆写后”的 `tokens/cssVars/antdTheme`
   - `createTokensCss()`：生成 CSS 变量文本并注入（或写成静态文件）
   - `antdTheme[mode]`：交给 `ConfigProvider`
4. 发布/构建（可选）：
   - `pnpm --filter @farm-design-system/theme build`
   - 输出 `dist/tokens.css|scss|less`、`dist/tailwind-preset`、`dist/finex-ui.json`、`dist/adapters/*`

## 5. 覆写与优先级（多项目怎么实现）

业务要“同一套组件，不同项目皮肤”，只改 Farm Token：

- `createTheme({ overrides })` 的 overrides 是最终色值（建议 hex/rgba）
- 优先级（从低到高）：
  1. `finexUi[mode]`（设计原值）
  2. `farm-token-map.json`（把设计 key 映射到 Farm Token）
  3. `overrides`（项目覆写，最终生效）
  4. `antd.light/dark.overrides`（极少数情况，最后一公里覆盖 antd token）

换句话说：**先覆写 Farm Token，再映射到 antd**，这样 UI/业务/antd 三端一致。

## 6. antd 映射怎么维护（最容易踩坑的地方）

### 6.1 原则

- 全局 token（`buildAntdTokenMap`）只覆盖“能明确从设计稿落地”的颜色类 token
  - 覆盖太多会把 antd 的派生算法“锁死”，维护成本会直线上升
- 组件级 token（`buildAntdComponentsMap`）只做“状态色细化”
  - 例如 Button 的 hover/active/disabled 背景、边框、文字
  - 避免把 Button 的局部差异污染到 Input/Select

### 6.2 推荐工作流（新增/调整 token）

1. 更新设计稿 -> 覆盖 `scripts/finex-ui.json`
2. `pnpm --filter @farm-design-system/theme sync:assets`
3. `pnpm --filter @farm-design-system/theme check:antd:coverage`
   - 看看有没有新增的 Farm Token 没被 antd 消费到
4. 如果确实需要 antd 也吃到：
   - 去改 `sync-src-assets.ts` 的映射规则（不要改 JSON）
   - 再跑一次 `sync:assets`
5. `pnpm --filter @farm-design-system/theme build` 确认能出产物

### 6.3 覆盖率脚本的“预期未覆盖”

不是所有 Farm Token 都应该映射到 antd，例如：

- 只服务业务按钮体系的状态色（antd 没有对应语义）
- Light/Dark 同值的 token（注入到 antd 可能破坏 dark 的层级）

这类 token 可以放进 `scripts/check-antd-coverage.ts` 的 `expectedUnusedFarmTokens`，并写清原因。

## 7. 常见问题

### 7.1 我可以手改 `src/adapters/*.json` 吗？

不建议。

原因：

- 这些文件是脚本产物，手改会被下一次 `sync:assets` 覆盖
- 更重要的是：手改很难保证 “light/dark 都一致” 和 “token 名拼写一致”

正确做法：改 `sync-src-assets.ts`。

### 7.2 为什么要把 `dist` 先清掉再 build？

避免残留旧产物（比如曾经的 `dist/react`）导致发布包里带垃圾文件。

### 7.3 为什么业务不直接用 antd token？

因为 antd token 名称/语义是 antd 的内部体系，业务一旦绑定：

- 未来换组件库或升级大版本时迁移成本高
- 同一套设计语义无法稳定跨 UI 体系复用

Farm Token 是我们自己的语义层，维护成本更可控。
