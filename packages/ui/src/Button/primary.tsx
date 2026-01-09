'use client';

import React from 'react';

import { Button, type ButtonProps } from './button';
import { useButtonStyles } from './style';

export type PrimaryButtonProps = ButtonProps;

export function PrimaryButton(props: PrimaryButtonProps) {
  const { styles, cx } = useButtonStyles();
  const { className, ...rest } = props;

  return <Button {...rest} type="primary" className={cx(styles.primary, className)} />;
}

