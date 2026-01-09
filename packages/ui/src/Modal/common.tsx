'use client';

import React from 'react';

import { Modal, type ModalProps, type ModalRef } from './modal';

export type CommonModalProps = ModalProps;

export const CommonModal = React.forwardRef<ModalRef, Readonly<CommonModalProps>>((props, ref) => {
  const { width, titleAlign, ...restProps } = props;

  return (
    <Modal
      ref={ref}
      width={width ?? 380}
      titleAlign={titleAlign ?? 'left'}
      footer={null}
      {...restProps}
    />
  );
});

CommonModal.displayName = 'CommonModal';
