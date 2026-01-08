# farm-design-system

一个基于 **pnpm + Turborepo** 的组件库 Monorepo 骨架，集成 **dumi + father + Storybook**。

## 目录结构

```text
.
├── apps/
│   ├── docs/                 # dumi 站点（独立应用）
│   └── playground/           # Storybook 沙箱
├── packages/
│   ├── ui/                   # 核心组件库（father 打包）
│   ├── theme/                # 设计 Token
│   └── utils/                # 共享工具函数
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## 快速开始

```bash
pnpm install
pnpm dev:docs
```

其他常用命令：

```bash
pnpm build
pnpm storybook
pnpm dev
```

