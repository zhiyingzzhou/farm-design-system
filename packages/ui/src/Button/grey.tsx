'use client';

import React from 'react';

import { Button, type ButtonProps } from './button';
import { useButtonStyles } from './style';

export type GreyButtonProps = ButtonProps;

export function GreyButton(props: GreyButtonProps) {
  const { styles, cx } = useButtonStyles();
  const { className, ...rest } = props;

  return (
    <Button
      {...rest}
      color="default"
      variant="filled"
      className={cx(styles.grey, className)}
    />
  );
}

