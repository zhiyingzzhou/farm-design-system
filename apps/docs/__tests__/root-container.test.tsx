import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

vi.mock('antd', async () => {
  const React = (await import('react')).default;
  return {
    ConfigProvider: (props: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(React.Fragment, null, (props as any).children),
    theme: {
      defaultAlgorithm: 'default',
      darkAlgorithm: 'dark'
    }
  };
});

const React = (await import('react')).default;
const { rootContainer } = await import('../.dumi/app');

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-prefers-color');
});

describe('docs rootContainer', () => {
  it('会跟随 html[data-prefers-color] 在 light/dark 间切换', async () => {
    document.documentElement.setAttribute('data-prefers-color', 'dark');

    render(rootContainer(React.createElement('div', { 'data-testid': 'content' })));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));

    document.documentElement.setAttribute('data-prefers-color', 'light');
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
  });
});
