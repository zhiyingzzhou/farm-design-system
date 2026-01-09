---
title: 主题维护手册
order: 2
group:
  title: 维护
  order: 2
toc: content
---

# 主题维护手册（@farm-design-system/theme）

> 本页由脚本从 `packages/theme/MAINTENANCE.md` 同步生成，请勿直接编辑。
> 如需修改内容，请编辑 `packages/theme/MAINTENANCE.md`，再运行 `pnpm --filter docs sync:theme-docs`（或 `pnpm --filter docs build`）。

本文面向维护者，目标是让你在**不打开 Figma** 的情况下，也能理解这套主题的“数据从哪来、怎么落地、改哪里最安全”。

## 1. 这包解决什么问题

一句话：把设计侧的 Finex Token（来自 Figma/Token Studio）变成一套**可复用、可多项目覆写**的主题能力，供：

- `@farm-design-system/ui` 组件库使用
- 业务组件/业务样式使用（CSS 变量 / Tailwind）
- antd 使用（通过 `ConfigProvider theme` 注入）

本仓库当前策略是：**不再维护 Farm 自己的语义化 token**，而是把 **antd token 作为稳定语义层**。好处是业务与 UI 组件能直接复用同一套 token（少一套 token、少一份 map），维护成本更低；代价是语义层绑定 antd（升级 antd 大版本时需要评估 token 变更）。

## 2. 目录与文件（哪些能改，哪些别动）

### 2.1 设计源（输入）

- `packages/theme/scripts/finex-ui.json`
  - Token Studio 从 Figma 导出的原始 JSON。
  - 特点：包含 `base/base` + `xxx/Light` + `xxx/Dark`，并且可能存在 `{Grey.18}` 这种引用。
  - **维护方式：直接用新的导出覆盖它。**

### 2.2 映射真源（唯一要手改的映射文件）

- `packages/theme/scripts/finex-to-antd-map.ts`
  - **单一真源**：维护 “antd token -> finex key（设计侧命名）” 的对应关系
  - 支持候选 key：当设计侧改名时，把新旧 key 作为候选列表即可（脚本会取第一个存在于当前 finex-ui 的 key）

### 2.3 运行时资产（会被源码 import）

这些文件由脚本生成，源码会直接 import，**不要手改**：

- `packages/theme/src/finex-ui.json`
  - `{ light, dark }` 的扁平结构（key 是 finex 命名，value 是最终色值）
  - 已经把 `{xxx}` 引用展开，运行时不会再做深度解析
- `packages/theme/src/adapters/antd-token-map.json`
  - antd 全局 token -> finex key
- `packages/theme/src/adapters/antd-components-map.json`
  - antd 组件级 token -> finex key

### 2.4 脚本（生成与校验）

- `packages/theme/scripts/sync-src-assets.ts`
  - 从 `scripts/finex-ui.json` 解析并生成 `src/finex-ui.json` + `src/adapters/*.json`
  - 里面只做“解析 + 选择候选 key + 写产物”，映射规则来自 `finex-to-antd-map.ts`
- `packages/theme/scripts/check-antd-coverage.ts`
  - 检查 finex key 是否“被 antd 消费到”（全局 + 组件级）
  - 输出“未被使用的 finex key”，并在严格模式下对“非预期未使用”设失败退出码
- `packages/theme/scripts/build-assets.ts`
  - 构建 `dist`：输出 `tokens.css|scss|less`、`tailwind-preset`、以及 adapters/json 的复制

### 2.5 主题逻辑（运行时合成）

- `packages/theme/src/tokens.ts`
  - 对外导出的核心逻辑：`tokens/cssVars/createTokensCss/createTheme/antdTheme/tailwindPreset`
  - 这里不包含任何 UI 组件样式，仅做 token 的解析与拼装
- `packages/theme/src/react.tsx`
  - React 侧接入封装：`FarmProvider`、`createStyles`、`useTheme`

## 3. 名词解释（别混）

### 3.1 Finex key（设计侧命名）

示例：`Brand-Color-Brand-2`

- 这是从 Token Studio 的路径计算出来的稳定 key（见 `toFinexKey`）
- 主要用于：
  - 维护映射规则（`finex-to-antd-map.ts`）
  - 方便你对照设计侧 token 命名

### 3.2 antd token（语义层 + 消费端）

示例：`colorPrimary`、`colorBgContainerDisabled`、`Button.defaultActiveBg`

antd token 分两类：

- 全局 token：放在 `ConfigProvider theme.token`
- 组件级 token：放在 `ConfigProvider theme.components.Button`

我们通过 `src/adapters/antd-token-map.json` + `src/adapters/antd-components-map.json` 控制“注入哪些、怎么注入”。

### 3.3 CSS 变量命名

主题包输出的 CSS 变量命名基于 antd token：

- `colorPrimary` -> `--farm-color-primary`
- `blue6` -> `--farm-blue-6`

Tailwind preset 也复用同一套 key（去掉 `--farm-` 前缀）：

- `text-farm-color-primary`
- `bg-farm-blue-6`

## 4. 数据流（从 Figma 到运行时）

按顺序：

1. Figma/Token Studio 导出 -> 覆盖 `packages/theme/scripts/finex-ui.json`
2. 运行 `pnpm --filter @farm-design-system/theme sync:assets`
   - 解析引用、扁平化（只同步 color token）
   - 生成 `packages/theme/src/finex-ui.json`
   - 基于 `finex-to-antd-map.ts` 生成 `packages/theme/src/adapters/*.json`
3. 业务侧运行时使用：
   - `antdTheme[mode]`：交给 antd `ConfigProvider`
   - `createTokensCss()`：生成 CSS 变量文本并注入（或写成静态文件）
   - `createTheme({ overrides })`：多项目覆写（覆写的是 antd token 的最终值）
4. 发布/构建（可选）：
   - `pnpm --filter @farm-design-system/theme build`
   - 输出 `dist/tokens.css|scss|less`、`dist/tailwind-preset`、`dist/finex-ui.json`、`dist/adapters/*`

## 5. 覆写与优先级（多项目怎么实现）

业务要“同一套组件，不同项目皮肤”，推荐只改 antd token 的最终值：

- `createTheme({ overrides })` 的 overrides 是最终色值（建议 hex/rgba）
- 优先级（从低到高）：
  1. `finexUi[mode]`（设计原值）
  2. `antd-token-map.json`（把 finex key 映射到 antd token）
  3. `overrides`（项目覆写，最终生效）
  4. `antd.light/dark.overrides`（极少数情况，最后一公里覆盖 antd token）

## 6. 映射怎么维护（最容易踩坑的地方）

### 6.1 原则

- 全局 token（`antdTokenFinexMap`）只覆盖“能明确从设计稿落地”的颜色类 token
  - 覆盖太多会把 antd 的派生算法“锁死”，维护成本会上升
- 组件级 token（`antdComponentTokenFinexMap`）用于“状态色/局部差异”
  - 例如 Button 的 hover/active/disabled 背景、边框、文字
  - 避免把某个组件的局部差异污染到全局 token

### 6.2 推荐工作流（新增/调整 token）

1. 更新设计稿 -> 覆盖 `scripts/finex-ui.json`
2. `pnpm --filter @farm-design-system/theme sync:assets`
3. `pnpm --filter @farm-design-system/theme check:antd:coverage`
   - 看看有没有新增的 finex key 没被 antd 消费到
4. 如果确实需要被 antd 消费：
   - 改 `scripts/finex-to-antd-map.ts`（不要手改 JSON）
   - 再跑一次 `sync:assets`
5. `pnpm --filter @farm-design-system/theme build` 确认能出产物

### 6.3 覆盖率脚本的“预期未覆盖”

不是所有 finex key 都应该映射到 antd，例如：

- 只服务业务按钮体系的状态色（antd 没有对应语义）
- Light/Dark 同值的 token（注入到 antd 可能破坏 dark 的层级）

这类 key 可以放进 `scripts/check-antd-coverage.ts` 的 `expectedUnusedFinexKeys`，并写清原因。

## 7. 常见问题

### 7.1 我可以手改 `src/adapters/*.json` 吗？

不建议。

原因：

- 这些文件是脚本产物，手改会被下一次 `sync:assets` 覆盖
- 更重要的是：手改很难保证 “light/dark 都一致” 和 “key 拼写一致”

正确做法：改 `scripts/finex-to-antd-map.ts`，再执行 `sync:assets`。

### 7.2 为什么要把 `dist` 先清掉再 build？

避免残留旧产物导致发布包里带垃圾文件。
