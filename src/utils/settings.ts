// AIGC START
/**
 * 插件设置 localStorage 读写
 * 仅存 API Key、节点等，不写多维表格
 */
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../constants';
import type { PluginSettings } from '../types';

/** 从 localStorage 加载设置，缺失字段用 DEFAULT_SETTINGS 补齐 */
export function loadSettings(): PluginSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 持久化插件设置 */
export function saveSettings(settings: PluginSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
// AIGC END
