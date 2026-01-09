'use client';

import React from 'react';

import { Button, type ButtonProps } from './button';
import { useButtonStyles } from './style';

export type CancelButtonProps = ButtonProps;

export function CancelButton(props: CancelButtonProps) {
  const { styles, cx } = useButtonStyles();
  const { className, ...rest } = props;

  return (
    <Button
      {...rest}
      color="default"
      variant="filled"
      className={cx(styles.cancel, className)}
    />
  );
}

