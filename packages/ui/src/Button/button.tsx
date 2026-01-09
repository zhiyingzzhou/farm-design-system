'use client';

import React from 'react';
import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';

export type ButtonProps = AntButtonProps;

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>((props, ref) => {
  const { autoInsertSpace = false, ...rest } = props;
  return <AntButton ref={ref} autoInsertSpace={autoInsertSpace} {...rest} />;
});

Button.displayName = 'Button';

