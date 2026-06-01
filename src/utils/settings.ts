// AIGC START
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../constants';
import type { PluginSettings } from '../types';

export function loadSettings(): PluginSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PluginSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
// AIGC END
