import React from 'react';
import { FarmProvider, type FarmThemeMode } from '@farm-design-system/theme/react';

function useDumiPrefersColorMode(): FarmThemeMode {
  const readMode = React.useCallback((): FarmThemeMode => {
    if (typeof document === 'undefined') return 'light';
    const value = document.documentElement.getAttribute('data-prefers-color');
    if (value === 'dark') return 'dark';
    if (value === 'light') return 'light';

    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const [mode, setMode] = React.useState<FarmThemeMode>(() => readMode());

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;

    const update = () => setMode(readMode());
    update();

    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['data-prefers-color'] });

    if (typeof window === 'undefined' || !window.matchMedia) {
      return () => observer.disconnect();
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqlChange = () => {
      const value = el.getAttribute('data-prefers-color');
      if (!value || value === 'auto') update();
    };

    mql.addEventListener('change', onMqlChange);

    return () => {
      observer.disconnect();
      mql.removeEventListener('change', onMqlChange);
    };
  }, [readMode]);

  return mode;
}

function DocsThemeProvider(props: { children: React.ReactNode }) {
  const mode = useDumiPrefersColorMode();
  return <FarmProvider mode={mode}>{props.children}</FarmProvider>;
}

export function rootContainer(container: React.ReactNode) {
  return <DocsThemeProvider>{container}</DocsThemeProvider>;
}
