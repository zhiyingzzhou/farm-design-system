export type FinexKeyCandidates = string | string[];

/**
 * 单一真源：Finex key -> antd token 的“桥接规则”。
 *
 * 设计目标：
 * - 不再维护 Farm 自己的语义化 token（减少一套 token 体系与 1 份 map 文件）
 * - 以 antd token 作为稳定语义层：业务组件与 @farm-design-system/ui 统一复用 antd token
 * - 设计侧（Figma/Token Studio）命名变动时，只需要改这里的候选 key
 *
 * 输出产物（由 `scripts/sync-src-assets.ts` 生成，禁止手改）：
 * - `src/adapters/antd-token-map.json`：antd 全局 token -> finex key
 * - `src/adapters/antd-components-map.json`：antd 组件级 token -> finex key
 */

/**
 * antd 全局 token -> finex key（或候选列表）。
 * - key：antd token 名（Seed/Map/Alias）
 * - value：Finex key（字符串）或候选数组（优先取第一个存在于 finex-ui 的 key）
 */
export const antdTokenFinexMap: Record<string, FinexKeyCandidates> = {
  colorPrimary: 'Brand-Color-Brand-2',
  colorPrimaryHover: 'Neutral-Color-Neutral-2',
  colorPrimaryActive: 'Button-Color-Main-button-Press',
  colorPrimaryBg: 'Brand-Color-Brand-3',
  colorPrimaryBgHover: 'Button-Color-Main-button-Disable',
  colorPrimaryBorder: 'Brand-Color-Brand-2',
  colorPrimaryBorderHover: 'Neutral-Color-Neutral-2',
  colorPrimaryText: 'Text-Color-Text-4',
  colorPrimaryTextHover: 'Text-Color-Text-4',
  colorPrimaryTextActive: 'Text-Color-Text-13',
  colorLink: 'Text-Color-Text-4',
  colorLinkHover: 'Neutral-Color-Neutral-2',
  colorLinkActive: 'Text-Color-Text-13',
  colorInfo: 'Tips-Blue',
  colorInfoText: 'Tips-Blue',
  colorInfoTextHover: 'Tips-Blue',
  colorInfoTextActive: 'Tips-Blue',
  colorSuccess: 'Pump_Dump-Color-PD-2',
  colorSuccessBg: 'Pump_Dump-Color-PD-4',
  colorSuccessText: 'Pump_Dump-Color-PD-2',
  colorSuccessBorder: 'Pump_Dump-Color-PD-2',
  colorSuccessHover: 'Pump_Dump-Color-PD-2',
  colorSuccessActive: 'Pump_Dump-Color-PD-2',
  colorSuccessTextHover: 'Pump_Dump-Color-PD-2',
  colorSuccessTextActive: 'Pump_Dump-Color-PD-2',
  colorWarning: 'Tips-Orange',
  colorWarningBg: 'Ohter-Color-Ohter-2',
  colorWarningBgHover: 'Ohter-Color-Other-5',
  colorWarningBorder: 'Ohter-Color-Other-1',
  colorWarningBorderHover: 'Ohter-Color-Other-1',
  colorWarningHover: 'Ohter-Color-Other-1',
  colorWarningActive: 'Text-Color-Text-14',
  colorWarningText: 'Text-Color-Text-14',
  colorWarningTextHover: 'Text-Color-Text-14',
  colorWarningTextActive: 'Text-Color-Text-14',
  colorError: 'Pump_Dump-Color-PD-1',
  colorErrorBg: 'Pump_Dump-Color-PD-3',
  colorErrorBgHover: 'Pump_Dump-Color-PD-3',
  colorErrorBorder: 'Pump_Dump-Color-PD-1',
  colorErrorBorderHover: 'Text-Color-Text-8',
  colorErrorHover: 'Text-Color-Text-8',
  colorErrorActive: 'Text-Color-Text-8',
  colorErrorText: 'Text-Color-Text-11',
  colorErrorTextHover: 'Text-Color-Text-8',
  colorErrorTextActive: 'Text-Color-Text-8',
  colorBgBase: 'Bg-Color-Bg-1',
  colorBgLayout: 'Bg-group-Color-2',
  colorBgContainer: 'Neutral-Color-Neutral-4',
  colorBgElevated: 'Ohter-Color-Ohter-4',
  colorBgMask: 'Mask-Color-Mask',
  colorBgContainerDisabled: 'Button-Color-gray-button-Disable',
  colorBgSpotlight: 'Neutral-Color-Neutral-3',
  colorBgBlur: 'Bg-Color-Bg-3',
  colorBgSolid: 'Button-Color-gray-button-normal',
  colorBgSolidHover: 'Button-Color-gray-button-Press',
  colorBgSolidActive: 'Button-Color-gray-button-Press',
  colorFill: 'Divider-Color-Divider-1',
  colorFillSecondary: 'Divider-Color-Divider-2',
  colorFillTertiary: 'Divider-Color-Divider-3',
  colorFillQuaternary: 'Divider-Color-Divider-4',
  colorFillContent: 'Divider-Color-Divider-4',
  colorFillContentHover: 'Divider-Color-Divider-3',
  colorFillAlter: 'Divider-Color-Divider-4',
  colorBgTextHover: 'Button-Color-Secondary-Grey-button-Disable',
  colorBgTextActive: 'Divider-Color-Divider-3',
  colorBorderBg: 'Divider-Color-Divider-4',
  controlItemBgHover: 'Button-Color-Secondary-Grey-button-normal',
  controlItemBgActive: 'Neutral-Color-Neutral-1',
  controlItemBgActiveHover: 'Neutral-Color-Neutral-5',
  controlItemBgActiveDisabled: 'Neutral-Color-Neutral-6',
  controlOutline: 'Text-Color-Text-12',
  colorWarningOutline: 'Ohter-Color-Other-5',
  colorErrorOutline: 'Text-Color-Text-10',
  controlTmpOutline: 'Text-Color-Text-7',
  blue6: 'Tips-Blue',
  cyan6: 'Tips-Cyan',
  green6: 'Tips-Green',
  red6: 'Tips-Red',
  yellow6: 'Tips-Yellow',
  magenta6: 'Tips-Purple Red',
  pink6: 'Tips-Bright Red',
  purple6: 'Tips-Dark purple',
  red1: 'Text-Color-Text-9',
  red3: 'Text-Color-Text-10',
  orange6: 'Tips-Orange',
  orange1: 'Ohter-Color-Ohter-2',
  purple1: 'Brand-Color-Brand-3',
  colorTextBase: 'Text-Color-Text-1',
  colorText: 'Text-Color-Text-1',
  colorTextSecondary: 'Text-Color-Text-2',
  colorTextTertiary: 'Text-Color-Text-3',
  colorTextQuaternary: 'Text-Color-Text-6',
  colorTextLightSolid: 'Text-Color-Text-5',
  colorTextHeading: 'Brand-Color-Brand-1',
  colorTextLabel: 'Text-Color-Text-2',
  colorTextDescription: 'Text-Color-Text-3',
  colorTextPlaceholder: 'Text-Color-Text-3',
  colorTextDisabled: 'Text-Color-Text-6',
  colorIcon: 'Text-Color-Text-2',
  colorIconHover: 'Text-Color-Text-1',
  colorBorder: 'Divider-Color-Divider-1',
  colorBorderSecondary: 'Divider-Color-Divider-2',
  colorBorderDisabled: 'Divider-Color-Divider-3',
  colorSplit: 'Divider-Color-Divider-2'
};

/**
 * antd 组件级 token -> finex key（或候选列表）。
 * - key：antd 组件名（例如 Button）
 * - value：该组件的 token 映射表
 */
export const antdComponentTokenFinexMap: Record<string, Record<string, FinexKeyCandidates>> = {
  Button: {
    colorPrimary: 'Button-Color-Main-button-normal',
    colorPrimaryHover: 'Button-Color-Main-button-normal',
    colorPrimaryActive: 'Button-Color-Main-button-Press',
    colorBgContainer: 'Button-Color-Secondary-White-button-normal',
    colorBgContainerDisabled: 'Button-Color-gray-button-Disable',
    primaryColor: 'Text-Color-Text-5',
    defaultHoverBg: 'Button-Color-Secondary-White-button-Press',
    defaultActiveBg: 'Button-Color-Secondary-Grey-button-Press',
    defaultBorderColor: 'Divider-Color-Divider-2',
    defaultHoverBorderColor: 'Brand-Color-Brand-2',
    defaultActiveBorderColor: 'Button-Color-Main-button-Press',
    defaultColor: 'Text-Color-Text-1',
    defaultHoverColor: 'Brand-Color-Brand-2',
    defaultActiveColor: 'Button-Color-Main-button-Press',
    textHoverBg: 'Divider-Color-Divider-4'
  },
  Input: {
    addonBg: 'Bg-Color-Bg-2',
    hoverBorderColor: 'Brand-Color-Brand-2',
    activeBorderColor: 'Button-Color-Main-button-Press',
    hoverBg: 'Bg-group-Color-1',
    activeBg: 'Bg-group-Color-1'
  },
  Select: {
    selectorBg: 'Bg-group-Color-1',
    clearBg: 'Bg-group-Color-1',
    hoverBorderColor: 'Brand-Color-Brand-2',
    activeBorderColor: 'Button-Color-Main-button-Press',
    activeOutlineColor: 'Brand-Color-Brand-3',
    optionSelectedColor: 'Text-Color-Text-1',
    optionSelectedBg: 'Brand-Color-Brand-3',
    optionActiveBg: 'Divider-Color-Divider-4',
    multipleItemBg: 'Divider-Color-Divider-4',
    multipleItemBorderColor: 'Divider-Color-Divider-2',
    multipleSelectorBgDisabled: 'Button-Color-gray-button-Disable',
    multipleItemColorDisabled: 'Text-Color-Text-6',
    multipleItemBorderColorDisabled: 'Divider-Color-Divider-3'
  },
  Tabs: {
    cardBg: 'Bg-group-Color-1',
    inkBarColor: 'Brand-Color-Brand-2',
    itemColor: 'Text-Color-Text-2',
    itemHoverColor: 'Brand-Color-Brand-2',
    itemActiveColor: 'Brand-Color-Brand-2',
    itemSelectedColor: 'Brand-Color-Brand-2'
  },
  Modal: {
    headerBg: 'Bg-group-Color-3',
    contentBg: 'Bg-group-Color-3',
    footerBg: 'Bg-group-Color-3',
    titleColor: 'Text-Color-Text-1'
  }
};

