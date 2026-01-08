import { useIntl, usePrefersColor, useSiteData } from 'dumi';
import React from 'react';
import './index.less';

type ColorMode = 'light' | 'dark' | 'auto';

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 18.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5Zm0-10.5a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5ZM12 2.5a1 1 0 0 1 1 1v1.25a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1Zm0 17.75a1 1 0 0 1 1 1V22.5a1 1 0 1 1-2 0v-1.25a1 1 0 0 1 1-1Zm9.5-9.25a1 1 0 0 1-1 1h-1.25a1 1 0 1 1 0-2h1.25a1 1 0 0 1 1 1Zm-17.75 0a1 1 0 0 1-1 1H1.5a1 1 0 1 1 0-2h1.25a1 1 0 0 1 1 1Zm14.308-6.058a1 1 0 0 1 0 1.414l-.884.884a1 1 0 1 1-1.414-1.414l.884-.884a1 1 0 0 1 1.414 0ZM8.245 16.76a1 1 0 0 1 0 1.414l-.884.884a1 1 0 1 1-1.414-1.414l.884-.884a1 1 0 0 1 1.414 0ZM6.346 4.942a1 1 0 0 1 0 1.414l-.884.884a1 1 0 1 1-1.414-1.414l.884-.884a1 1 0 0 1 1.414 0Zm11.458 11.458a1 1 0 0 1 0 1.414l-.884.884a1 1 0 1 1-1.414-1.414l.884-.884a1 1 0 0 1 1.414 0Z" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.83 3.1a1 1 0 0 1 .88 1.12 7.75 7.75 0 0 0 8.07 8.07 1 1 0 0 1 .27 1.96A9.75 9.75 0 1 1 9.75 1.95a1 1 0 0 1 1.96.27c-.01.14-.02.29-.02.44 0 .15.01.3.02.44a1 1 0 0 1-.88 1.12A7.75 7.75 0 1 0 19.78 13.15a1 1 0 0 1 1.12-.88c.29.03.58.04.88.04.15 0 .3-.01.44-.02a1 1 0 0 1 1.12.88 1 1 0 0 1-.88 1.12 9.75 9.75 0 1 1-9.64-11.7Z" />
    </svg>
  );
}

function IconAuto() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.25c5.385 0 9.75 4.365 9.75 9.75S17.385 21.75 12 21.75 2.25 17.385 2.25 12 6.615 2.25 12 2.25Zm0 2a7.75 7.75 0 1 0 0 15.5V4.25Z" />
    </svg>
  );
}

const ICONS: Record<ColorMode, React.ComponentType> = {
  light: IconSun,
  dark: IconMoon,
  auto: IconAuto
};

/**
 * 自定义主题切换器（替换默认 select UI）：
 * - 仍然使用 dumi 内置的 `usePrefersColor()`，保持与 dumi 的存储/同步机制一致
 * - UI 参考 arco.design 的“图标按钮组”风格：更紧凑、可一眼识别当前模式
 *
 * 注意：
 * - dumi 会把最终生效的模式写到 `html[data-prefers-color]` 上；
 * - 样式层只需要基于这个 attribute 做 dark 覆盖即可。
 */
export default function ColorSwitch() {
  const intl = useIntl();
  const { themeConfig } = useSiteData();
  const defaultColor = themeConfig.prefersColor?.default ?? 'auto';

  const [, prefersColor = defaultColor, setPrefersColor] = usePrefersColor();

  const modes: ColorMode[] = ['light', 'dark', 'auto'];

  return (
    <div
      className="farm-docs-color-switch"
      role="group"
      aria-label={intl.formatMessage({ id: 'farm.docs.color.group' })}
    >
      {modes.map((mode) => {
        const Icon = ICONS[mode];
        const isActive = prefersColor === mode;
        return (
          <button
            key={mode}
            type="button"
            className="farm-docs-color-switch__btn"
            data-active={isActive || undefined}
            aria-pressed={isActive}
            aria-label={intl.formatMessage({ id: `header.color.mode.${mode}` })}
            data-dumi-tooltip={intl.formatMessage({ id: `header.color.mode.${mode}` })}
            data-dumi-tooltip-bottom
            onClick={(e) => {
              // Header 的移动端菜单会监听 click 关闭，这里阻止冒泡，避免切换主题时把菜单关掉。
              e.stopPropagation();
              setPrefersColor(mode);
            }}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
