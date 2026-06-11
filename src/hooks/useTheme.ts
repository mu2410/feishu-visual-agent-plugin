// AIGC START
/**
 * 同步飞书多维表格主题（明/暗）
 * 通过 data-theme 属性驱动 CSS 变量切换
 */
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

    // 读取当前主题
    (async () => {
      try {
        const current = await bitable.bridge.getTheme();
        if (!disposed) apply(current as ThemeMode);
      } catch {
        apply('LIGHT');
      }
    })();

    // 监听用户切换飞书主题
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
