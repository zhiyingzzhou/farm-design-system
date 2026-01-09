import { createStyles } from '@farm-design-system/theme/react';

const PRIMARY_HEIGHT = 48;
const PRIMARY_PADDING_INLINE = 24;
const PRIMARY_FONT_SIZE = 16;

const CANCEL_HEIGHT = 52;
const CANCEL_PADDING_INLINE = 32;
const CANCEL_FONT_SIZE = 16;

const GREY_HEIGHT = 48;
const GREY_PADDING_INLINE = 24;
const GREY_FONT_SIZE = 16;

const BORDER_RADIUS = 6;
const FONT_WEIGHT = 500;

const disabledSelector = '&:disabled, &.ant-btn-disabled';
const enabledHoverSelector = '&:not(:disabled):not(.ant-btn-disabled):hover';
const enabledActiveSelector = '&:not(:disabled):not(.ant-btn-disabled):active';

export const useButtonStyles = createStyles((theme) => {
  return {
    primary: {
      height: PRIMARY_HEIGHT,
      paddingInline: PRIMARY_PADDING_INLINE,
      fontSize: PRIMARY_FONT_SIZE,
      borderRadius: BORDER_RADIUS,
      fontWeight: FONT_WEIGHT,
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '2px'
      }
    },
    cancel: {
      height: CANCEL_HEIGHT,
      paddingInline: CANCEL_PADDING_INLINE,
      fontSize: CANCEL_FONT_SIZE,
      borderRadius: BORDER_RADIUS,
      fontWeight: FONT_WEIGHT,
      borderColor: 'transparent',
      boxShadow: 'none',
      backgroundColor: theme.controlItemBgHover,
      color: theme.colorText,
      [enabledHoverSelector]: {
        backgroundColor: theme.colorBgTextHover
      },
      [enabledActiveSelector]: {
        backgroundColor: theme.colorBgTextHover
      },
      [disabledSelector]: {
        backgroundColor: theme.colorBgTextHover,
        color: theme.colorTextDisabled
      },
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '2px'
      }
    },
    grey: {
      height: GREY_HEIGHT,
      paddingInline: GREY_PADDING_INLINE,
      fontSize: GREY_FONT_SIZE,
      borderRadius: BORDER_RADIUS,
      fontWeight: FONT_WEIGHT,
      borderColor: 'transparent',
      boxShadow: 'none',
      backgroundColor: theme.colorBgSolid,
      color: theme.colorTextSecondary,
      [enabledHoverSelector]: {
        backgroundColor: theme.colorBgSolidHover
      },
      [enabledActiveSelector]: {
        backgroundColor: theme.colorBgSolidActive
      },
      [disabledSelector]: {
        backgroundColor: theme.colorBgContainerDisabled,
        color: theme.colorTextDisabled
      },
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '2px'
      }
    }
  };
});
