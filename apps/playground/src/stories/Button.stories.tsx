import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@farm-design-system/ui';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Hello'
  }
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Basic: Story = {};

