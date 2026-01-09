import { createStyles } from '@farm-design-system/theme/react';

export type ModalStyleParams = {
  borderRadius: number;
  padding: number;
  paddingX: number;
  titleAlign: 'left' | 'center' | 'right';
};

export const useModalStyles = createStyles((theme, params: ModalStyleParams) => {
  const { borderRadius, padding, paddingX, titleAlign } = params;

  return {
    container: {
      borderRadius,
      padding: 0,
    },
    header: {
      background: 'transparent',
      borderBottom: 'none',
      marginBottom: 0,
      padding: `${padding}px ${paddingX}px 0`,
    },
    body: {
      padding: `${Math.max(16, Math.floor(padding / 2))}px ${paddingX}px`,
    },
    footer: {
      background: 'transparent',
      borderTop: 'none',
      marginTop: 0,
      padding: `0 ${paddingX}px ${padding}px`,
    },

    titleBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 32,
    },
    titleText: {
      flex: 1,
      minWidth: 0,
      margin: 0,
      fontSize: 18,
      fontWeight: 600,
      color: theme.colorText,
      textAlign: titleAlign,
    },
    closeButton: {
      width: 32,
      height: 32,
      padding: 0,
      border: 0,
      borderRadius: 8,
      background: 'transparent',
      cursor: 'pointer',
      color: theme.colorTextTertiary,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      lineHeight: 1,
      transition: 'background-color 0.15s ease, color 0.15s ease',
      '&:hover': {
        background: theme.colorFillQuaternary,
        color: theme.colorText,
      },
      '&:active': {
        background: theme.colorFillTertiary,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colorPrimary}`,
        outlineOffset: 2,
      },
    },

    footerActions: {
      display: 'flex',
      justifyContent: 'center',
      gap: 12,
      paddingTop: 18,
    },
    footerButton: {
      minWidth: 160,
    },
  };
});
