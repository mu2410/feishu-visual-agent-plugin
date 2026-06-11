// AIGC START
/**
 * API 设置面板（可折叠）
 * 配置 Grsai API Key 与国内/全球节点
 */
import { GRSai_NODES } from '../constants';
import type { PluginSettings } from '../types';
import { Select } from './Select';

interface Props {
  open: boolean;
  settings: PluginSettings;
  onChange: (s: PluginSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ open, settings, onChange, onClose }: Props) {
  if (!open) return null;

  const patch = (partial: Partial<PluginSettings>) =>
    onChange({ ...settings, ...partial });

  return (
    <div className="va-settings">
      <div className="va-settings__head">
        <strong>API 设置</strong>
        <button type="button" className="va-btn va-btn--text" onClick={onClose}>
          收起
        </button>
      </div>
      <label className="va-field">
        <span className="va-field__label">Grsai API Key</span>
        <input
          className="va-input"
          type="password"
          placeholder="sk-..."
          value={settings.grsaiApiKey}
          onChange={(e) => patch({ grsaiApiKey: e.target.value })}
        />
      </label>
      <Select
        label="生图节点"
        value={settings.grsaiBaseUrl}
        options={GRSai_NODES}
        onChange={(v) => patch({ grsaiBaseUrl: v })}
      />
      <p className="va-hint">密钥仅保存在浏览器 localStorage，不会写入表格。</p>
    </div>
  );
}
// AIGC END
