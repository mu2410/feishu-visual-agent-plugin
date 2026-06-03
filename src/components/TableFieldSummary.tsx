// AIGC START
import type { RecordFieldMapping, RecordGenerateParams } from '../types';

interface Props {
  mapping: RecordFieldMapping;
  generateParams: RecordGenerateParams;
  referenceCount: number;
}

export function TableFieldSummary({
  mapping,
  generateParams,
  referenceCount,
}: Props) {
  const items = [
    { label: 'Prompt', ok: Boolean(mapping.promptFieldId) },
    {
      label: `参考图 ${referenceCount}/5`,
      ok: mapping.referenceImageFieldIds.length > 0,
    },
    { label: `比例 ${generateParams.aspectRatio}`, ok: Boolean(mapping.aspectRatioFieldId) },
    { label: `尺寸 ${generateParams.imageSize}`, ok: Boolean(mapping.imageSizeFieldId) },
    { label: `模型 ${generateParams.imageModel}`, ok: Boolean(mapping.modelFieldId) },
    {
      label: mapping.statusFieldId
        ? `状态 ${generateParams.statusLabel || '—'}`
        : '状态',
      ok: Boolean(mapping.statusFieldId),
    },
    { label: '结果图（1440×1440）', ok: Boolean(mapping.resultImageFieldId) },
  ];

  return (
    <section className="va-card va-card--compact">
      <h3 className="va-card__title">表格字段（自动匹配）</h3>
      <p className="va-hint">
        比例、尺寸、模型请在表格对应列修改；生图后会更新「状态」，并将 1440×1440 图片写入「结果图」列。
      </p>
      <ul className="va-field-list">
        {items.map((item) => (
          <li key={item.label} className={item.ok ? 'va-field-list__ok' : 'va-field-list__miss'}>
            {item.ok ? '✓' : '○'} {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
// AIGC END
