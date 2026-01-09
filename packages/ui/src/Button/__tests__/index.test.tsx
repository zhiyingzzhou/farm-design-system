import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

afterEach(() => cleanup());

vi.mock('antd', async () => {
  const React = (await import('react')).default;
  return {
    ConfigProvider: (props: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, props.children),
    Button: (props: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (() => {
        const { autoInsertSpace: _autoInsertSpace, ...rest } = props as any;
        return React.createElement('button', { 'data-testid': 'antd-button', ...rest }, rest.children);
      })(),
    theme: {
      useToken: () => ({ theme: {}, token: {}, hashId: 'test-hash', cssVar: {} }),
      darkAlgorithm: {},
      defaultAlgorithm: {}
    }
  };
});

const React = (await import('react')).default;
const { Button, CancelButton, GreyButton, PrimaryButton } = await import('../index');

describe('Button', () => {
  it('透传 props 到 antd Button', () => {
    const { getByTestId } = render(React.createElement(Button, { type: 'primary', disabled: true }, 'Hello'));
    const el = getByTestId('antd-button');
    expect(el).toHaveAttribute('type', 'primary');
    expect(el).toBeDisabled();
  });

  it('PrimaryButton 默认 type=primary', () => {
    const { getByTestId } = render(React.createElement(PrimaryButton, null, 'Hello'));
    expect(getByTestId('antd-button')).toHaveAttribute('type', 'primary');
  });

  it('CancelButton 默认 color=default variant=filled', () => {
    const { getByTestId } = render(React.createElement(CancelButton, null, 'Hello'));
    const el = getByTestId('antd-button');
    expect(el).toHaveAttribute('color', 'default');
    expect(el).toHaveAttribute('variant', 'filled');
  });

  it('GreyButton 默认 color=default variant=filled', () => {
    const { getByTestId } = render(React.createElement(GreyButton, null, 'Hello'));
    const el = getByTestId('antd-button');
    expect(el).toHaveAttribute('color', 'default');
    expect(el).toHaveAttribute('variant', 'filled');
  });
});
