import { Button as AntButton } from 'antd';
import type { ButtonProps as AntButtonProps } from 'antd';

export type ButtonProps = AntButtonProps;

export function Button(props: ButtonProps) {
  return <AntButton {...props} />;
}

