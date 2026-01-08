---
title: Farm Design System
hero:
  title: Farm Design System
  description: pnpm + Turborepo + dumi + father + Storybook
  actions:
    - text: 主题使用
      link: /theme
    - text: 主题维护
      link: /theme-maintenance
---

## 快速开始

```bash
pnpm install
pnpm dev:docs
```

## Button

```tsx
import React from 'react';
import { Button } from '@farm-design-system/ui';

export default () => <Button type="primary">Hello</Button>;
```

## 主题

- 主题体系说明：`@farm-design-system/theme`（见「[主题](/theme)」）
