// AIGC START
/**
 * 表格字段匹配状态面板
 * 展示各标准列是否已成功映射，以及当前行读到的参数值
 */
import type { RecordFieldMapping, RecordGenerateParams } from '../types';
import { formatResultImagePixels } from '../utils/bitableHelpers';

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
    {
      label: mapping.resultImagePixelFieldId
        ? `结果图像素 ${formatResultImagePixels(generateParams.resultImagePixels)}`
        : '结果图像素',
      ok: Boolean(mapping.resultImagePixelFieldId),
    },
    {
      label: mapping.resultImageFieldId
        ? `结果图 ${formatResultImagePixels(generateParams.resultImagePixels)}`
        : '结果图',
      ok: Boolean(mapping.resultImageFieldId),
    },
  ];

  return (
    <section className="va-card va-card--compact">
      <h3 className="va-card__title">表格字段（自动匹配）</h3>
      <p className="va-hint">
        比例、尺寸、模型、结果图像素请在表格对应列修改；生图后会更新「状态」，并按所选像素（如
        1000*1792、1440*1440）缩放后写入「结果图」列（未填时默认 1440×1440）。
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
