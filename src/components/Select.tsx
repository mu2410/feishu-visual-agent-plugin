// AIGC START
/**
 * 通用下拉选择组件
 * 用于设置面板等表单场景
 */
import type { SelectHTMLAttributes } from 'react';

interface Option {
  label: string;
  value: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function Select({ label, options, value, onChange, ...rest }: Props) {
  const safeOptions = options ?? [];
  return (
    <label className="va-field">
      <span className="va-field__label">{label}</span>
      <select
        className="va-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      >
        {safeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
// AIGC END
