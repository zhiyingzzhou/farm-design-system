import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

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
    Modal: (props: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (() => {
        const { open, title, footer, children } = props as any;
        if (!open) return null;
        return React.createElement(
          'div',
          { 'data-testid': 'antd-modal' },
          React.createElement('div', { 'data-testid': 'antd-modal-title' }, title),
          React.createElement('div', { 'data-testid': 'antd-modal-body' }, children),
          footer === null
            ? null
            : React.createElement('div', { 'data-testid': 'antd-modal-footer' }, footer),
        );
      })(),
    theme: {
      useToken: () => ({ theme: {}, token: {}, hashId: 'test-hash', cssVar: {} }),
      darkAlgorithm: {},
      defaultAlgorithm: {},
    },
  };
});

const React = (await import('react')).default;
const { Modal } = await import('../index');

describe('Modal', () => {
  it('trigger 点击后打开，点击关闭按钮后关闭', async () => {
    const { getByText, queryByTestId, getByRole } = render(
      React.createElement(
        Modal,
        {
          title: '标题',
          trigger: React.createElement('button', null, '打开'),
        },
        React.createElement('div', null, '内容'),
      ),
    );

    expect(queryByTestId('antd-modal')).not.toBeInTheDocument();
    fireEvent.click(getByText('打开'));
    await waitFor(() => expect(queryByTestId('antd-modal')).toBeInTheDocument());

    fireEvent.click(getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(queryByTestId('antd-modal')).not.toBeInTheDocument());
  });

  it('disabled 时 trigger 不生效', async () => {
    const { getByText, queryByTestId } = render(
      React.createElement(
        Modal,
        {
          disabled: true,
          trigger: React.createElement('button', null, '打开'),
        },
        React.createElement('div', null, '内容'),
      ),
    );

    fireEvent.click(getByText('打开'));
    await waitFor(() => expect(queryByTestId('antd-modal')).not.toBeInTheDocument());
  });

  it('onOk 返回 false 时不关闭', async () => {
    const { getByText, queryByTestId } = render(
      React.createElement(Modal, {
        trigger: React.createElement('button', null, '打开'),
        title: '标题',
        onOk: () => false,
      }),
    );

    fireEvent.click(getByText('打开'));
    await waitFor(() => expect(queryByTestId('antd-modal')).toBeInTheDocument());

    fireEvent.click(getByText('确定'));
    await waitFor(() => expect(queryByTestId('antd-modal')).toBeInTheDocument());
  });

  it('children 函数可收到 onClose/isOpen', async () => {
    const { getByText, queryByTestId } = render(
      React.createElement(Modal, {
        trigger: React.createElement('button', null, '打开'),
        children: ({ onClose, isOpen }) =>
          React.createElement('button', { onClick: onClose }, `inside-close-${String(isOpen)}`),
      }),
    );

    fireEvent.click(getByText('打开'));
    await waitFor(() => expect(queryByTestId('antd-modal')).toBeInTheDocument());

    expect(getByText('inside-close-true')).toBeInTheDocument();
    fireEvent.click(getByText('inside-close-true'));
    await waitFor(() => expect(queryByTestId('antd-modal')).not.toBeInTheDocument());
  });
});

