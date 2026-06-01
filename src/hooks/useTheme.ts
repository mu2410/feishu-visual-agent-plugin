// AIGC START
import { useEffect, useState } from 'react';
import { bitable } from '@lark-base-open/js-sdk';
import type { ThemeMode } from '../types';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('LIGHT');

  useEffect(() => {
    let disposed = false;

    const apply = (mode: ThemeMode) => {
      document.documentElement.dataset.theme = mode === 'DARK' ? 'dark' : 'light';
      setTheme(mode);
    };

    (async () => {
      try {
        const current = await bitable.bridge.getTheme();
        if (!disposed) apply(current as ThemeMode);
      } catch {
        apply('LIGHT');
      }
    })();

    const off = bitable.bridge.onThemeChange((ev) => {
      apply(ev.data.theme as ThemeMode);
    });

    return () => {
      disposed = true;
      off();
    };
  }, []);

  return theme;
}
// AIGC END
