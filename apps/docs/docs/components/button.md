---
title: Button
order: 1
group:
  title: 通用
  order: 1
toc: content
---

# Button

## 基础用法

```tsx
import React from 'react';
import { Button } from '@farm-design-system/ui';

export default () => <Button type="primary">Hello</Button>;
```

## 预设样式

```tsx
import React from 'react';
import { CancelButton, GreyButton, PrimaryButton } from '@farm-design-system/ui';

export default () => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
    <PrimaryButton>Primary</PrimaryButton>
    <CancelButton>Cancel</CancelButton>
    <GreyButton>Grey</GreyButton>
  </div>
);
```

