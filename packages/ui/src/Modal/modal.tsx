'use client';

import React from 'react';
import { Modal as AntdModal } from 'antd';
import type { ModalProps as AntdModalProps } from 'antd';
import { isFunction, isUndefined } from 'es-toolkit';
import { twMerge } from 'tailwind-merge';

import { CancelButton, PrimaryButton } from '../Button';
import { useModalStyles } from './style';

export interface ModalRef {
  open: () => void;
  close: () => void;
}

interface ChildrenParams {
  onClose: () => void;
  isOpen: boolean;
}

export interface ModalProps extends Omit<AntdModalProps, 'open' | 'onCancel' | 'onOk' | 'children'> {
  /**
   * 用于触发 Modal 打开的节点。
   * - 提供 trigger 来减少 state 的使用
   * - 如需完全控制，可使用 `open` + `onOpenChange`
   */
  trigger?: React.ReactElement;
  /** 受控打开状态 */
  open?: boolean;
  /** 打开状态变化 */
  onOpenChange?: (open: boolean) => void;
  /** 关闭回调（来自：关闭按钮 / 取消按钮 / 点击遮罩 / Esc） */
  onCancel?: () => void;
  /**
   * 点击确定按钮回调：
   * - 未传入时：默认关闭
   * - 返回 `false`：不关闭
   * - 其它返回值：关闭
   */
  onOk?: (e: React.MouseEvent<HTMLButtonElement>) => void | boolean | Promise<void | boolean>;
  /** 是否禁用 trigger */
  disabled?: boolean;

  /** Modal 圆角（默认：20） */
  borderRadius?: number;
  /** 内容垂直内边距（默认：30） */
  padding?: number;
  /** 内容水平内边距（默认：24） */
  paddingContentHorizontalLG?: number;

  /** 是否显示取消按钮（默认：true） */
  cancelButtonVisible?: boolean;
  /** 是否显示确定按钮（默认：true） */
  okButtonVisible?: boolean;

  /** 标题对齐（默认：left） */
  titleAlign?: 'left' | 'center' | 'right';
  /** 自定义关闭图标；传 `false/null` 可隐藏 */
  closeIcon?: React.ReactNode | false | null;
  /** 关闭按钮额外 className */
  closeIconClassName?: string;

  /** 是否启用遮罩模糊 */
  blurBackdrop?: boolean;
  /** 自定义标题渲染 */
  titleRender?: (params: { closeIcon: React.ReactNode; title: React.ReactNode }) => React.ReactNode;
  /** children 支持函数式注入 */
  children?: ((params: ChildrenParams) => React.ReactNode) | React.ReactElement | React.ReactNode;
}

const DEFAULT_BORDER_RADIUS = 20;
const DEFAULT_PADDING_Y = 30;
const DEFAULT_PADDING_X = 24;

function getDefaultContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.getElementById('appModal') ?? document.body;
}

export const Modal = React.forwardRef<ModalRef, ModalProps>((props, ref) => {
  const {
    trigger,
    disabled = false,

    open: controlledOpen,
    onOpenChange,
    onCancel,
    onOk,

    borderRadius = DEFAULT_BORDER_RADIUS,
    padding = DEFAULT_PADDING_Y,
    paddingContentHorizontalLG = DEFAULT_PADDING_X,

    cancelButtonVisible = true,
    okButtonVisible = true,

    titleAlign = 'left',
    closeIcon,
    closeIconClassName,
    blurBackdrop = false,
    titleRender,

    title,
    footer,
    okText,
    cancelText,
    confirmLoading,
    okButtonProps,
    cancelButtonProps,

    classNames: userClassNames,
    styles: userStyles,
    maskStyle,
    bodyStyle,
    getContainer,

    children,
    ...restProps
  } = props;

  const isControlled = !isUndefined(controlledOpen);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = isControlled ? Boolean(controlledOpen) : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const openModal = React.useCallback(() => setOpen(true), [setOpen]);
  const closeModal = React.useCallback(() => {
    setOpen(false);
    onCancel?.();
  }, [onCancel, setOpen]);

  React.useImperativeHandle(
    ref,
    () => ({
      open: openModal,
      close: closeModal,
    }),
    [closeModal, openModal],
  );

  const onTriggerClick = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      openModal();
      trigger?.props?.onClick?.(e);
    },
    [disabled, openModal, trigger],
  );

  const handleCancel = React.useCallback(() => {
    closeModal();
  }, [closeModal]);

  const handleOk = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onOk) {
        closeModal();
        return;
      }

      try {
        const res = await onOk(e);
        if (res !== false) closeModal();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Modal onOk error:', err);
      }
    },
    [closeModal, onOk],
  );

  const shouldShowCloseIcon = closeIcon !== false && closeIcon !== null;

  const styleParams = React.useMemo(
    () => ({
      borderRadius,
      padding,
      paddingX: paddingContentHorizontalLG,
      titleAlign,
    }),
    [borderRadius, padding, paddingContentHorizontalLG, titleAlign],
  );

  const { styles } = useModalStyles(styleParams);

  const closeButtonNode = React.useMemo(() => {
    if (!shouldShowCloseIcon) return null;
    return (
      <button
        type="button"
        className={twMerge(styles.closeButton, closeIconClassName)}
        onClick={handleCancel}
        aria-label="关闭"
      >
        {closeIcon === undefined ? '×' : closeIcon}
      </button>
    );
  }, [closeIcon, closeIconClassName, handleCancel, shouldShowCloseIcon, styles.closeButton]);

  const resolvedTitle = React.useMemo(() => {
    if (!title && !closeButtonNode) return null;

    const defaultTitle = (
      <div className={styles.titleBar}>
        <div className={styles.titleText}>{title}</div>
        {closeButtonNode}
      </div>
    );

    return titleRender ? titleRender({ title, closeIcon: closeButtonNode }) : defaultTitle;
  }, [closeButtonNode, styles.titleBar, styles.titleText, title, titleRender]);

  const resolvedFooter = React.useMemo(() => {
    if (!isUndefined(footer)) return footer;
    if (!cancelButtonVisible && !okButtonVisible) return null;

    const okProps = okButtonProps ?? {};
    const cancelProps = cancelButtonProps ?? {};

    const resolvedOkText = okText ?? '确定';
    const resolvedCancelText = cancelText ?? '取消';

    const onCancelClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      cancelProps.onClick?.(e);
      handleCancel();
    };

    const onOkClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      okProps.onClick?.(e);
      await handleOk(e);
    };

    return (
      <div className={styles.footerActions}>
        {cancelButtonVisible ? (
          <CancelButton
            {...cancelProps}
            onClick={onCancelClick}
            className={twMerge(styles.footerButton, cancelProps.className)}
          >
            {resolvedCancelText}
          </CancelButton>
        ) : null}

        {okButtonVisible ? (
          <PrimaryButton
            {...okProps}
            loading={okProps.loading ?? confirmLoading}
            onClick={onOkClick}
            className={twMerge(styles.footerButton, okProps.className)}
          >
            {resolvedOkText}
          </PrimaryButton>
        ) : null}
      </div>
    );
  }, [
    cancelButtonProps,
    cancelButtonVisible,
    cancelText,
    confirmLoading,
    footer,
    handleCancel,
    handleOk,
    okButtonProps,
    okButtonVisible,
    okText,
    styles.footerActions,
    styles.footerButton,
  ]);

  const mergedClassNames = React.useMemo(() => {
    return {
      ...userClassNames,
      container: twMerge(styles.container, userClassNames?.container),
      header: twMerge(styles.header, userClassNames?.header),
      body: twMerge(styles.body, userClassNames?.body),
      footer: twMerge(styles.footer, userClassNames?.footer),
    } satisfies AntdModalProps['classNames'];
  }, [
    styles.body,
    styles.container,
    styles.footer,
    styles.header,
    userClassNames,
  ]);

  const mergedStyles = React.useMemo(() => {
    const blurMask = blurBackdrop
      ? {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        }
      : {};

    return {
      ...userStyles,
      mask: {
        ...blurMask,
        ...(maskStyle ?? {}),
        ...(userStyles?.mask ?? {}),
      },
      body: {
        ...(bodyStyle ?? {}),
        ...(userStyles?.body ?? {}),
      },
    } satisfies AntdModalProps['styles'];
  }, [blurBackdrop, bodyStyle, maskStyle, userStyles]);

  const resolvedGetContainer = React.useMemo(() => {
    if (!isUndefined(getContainer)) return getContainer;
    return () => getDefaultContainer();
  }, [getContainer]);

  const renderedChildren = React.useMemo(() => {
    if (isFunction(children)) {
      return (children as (params: ChildrenParams) => React.ReactNode)({ onClose: closeModal, isOpen: open });
    }

    const child = children ?? null;
    if (!React.isValidElement(child)) return child;
    if (typeof child.type === 'string') return child;

    try {
      return React.cloneElement(child as React.ReactElement, {
        onClose: closeModal,
        isOpen: open,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Modal: failed to clone children with injected props:', err);
      return child;
    }
  }, [children, closeModal, open]);

  return (
    <>
      {trigger && React.isValidElement(trigger)
        ? React.cloneElement(trigger as React.ReactElement, { onClick: onTriggerClick })
        : null}

      <AntdModal
        {...restProps}
        destroyOnClose={restProps.destroyOnClose ?? true}
        closeIcon={null}
        centered={restProps.centered ?? true}
        open={open}
        title={resolvedTitle}
        footer={resolvedFooter}
        onCancel={handleCancel}
        onOk={handleOk}
        classNames={mergedClassNames}
        styles={mergedStyles}
        getContainer={resolvedGetContainer}
      >
        {renderedChildren}
      </AntdModal>
    </>
  );
});

Modal.displayName = 'Modal';
