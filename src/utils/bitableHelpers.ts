// AIGC START
import {
  bitable,
  FieldType,
  type IAttachmentField,
  type ISingleSelectField,
  type ITable,
  type ITextField,
} from '@lark-base-open/js-sdk';
import type { AspectRatio, ImageSize, RecordFieldMapping, RecordGenerateParams, RecordJobSnapshot } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

/** 边栏插件中 getSelection().recordId 常为空，优先读当前视图选中行 */
export async function resolveActiveRecordId(): Promise<string | null> {
  try {
    const table = await bitable.base.getActiveTable();
    const view = await table.getActiveView();
    const getSelected = (
      view as { getSelectedRecordIdList?: () => Promise<string[]> }
    ).getSelectedRecordIdList;
    if (getSelected) {
      const ids = await getSelected.call(view);
      if (ids.length > 0) return ids[0];
    }
  } catch {
    /* 非表格视图或无选中行 */
  }

  try {
    const selection = await bitable.base.getSelection();
    if (selection.recordId) return selection.recordId;
  } catch {
    /* ignore */
  }

  return null;
}

export async function readTextCell(
  table: ITable,
  fieldId: string,
  recordId: string,
): Promise<string> {
  const text = await table.getCellString(fieldId, recordId);
  return text?.trim() ?? '';
}

export async function readSelectCell(
  table: ITable,
  fieldId: string,
  recordId: string,
): Promise<string> {
  const text = await table.getCellString(fieldId, recordId);
  if (text?.trim()) return text.trim();
  try {
    const val = await table.getCellValue(fieldId, recordId);
    if (val && typeof val === 'object' && 'text' in val) {
      return String((val as { text: string }).text).trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function writeSelectCell(
  table: ITable,
  fieldId: string,
  recordId: string,
  optionText: string,
): Promise<void> {
  if (!optionText) return;
  const field = await table.getField<ISingleSelectField>(fieldId);
  await field.setValue(recordId, optionText);
}

export async function readAttachmentUrls(
  table: ITable,
  fieldId: string,
  recordId: string,
): Promise<string[]> {
  const field = await table.getField<IAttachmentField>(fieldId);
  const urls = await field.getAttachmentUrls(recordId);
  return urls ?? [];
}

export async function readAllReferenceUrls(
  table: ITable,
  fieldIds: string[],
  recordId: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (const fieldId of fieldIds) {
    if (!fieldId) continue;
    try {
      urls.push(...(await readAttachmentUrls(table, fieldId, recordId)));
    } catch {
      /* 单列读取失败跳过 */
    }
  }
  return urls;
}

export async function writeTextCell(
  table: ITable,
  fieldId: string,
  recordId: string,
  value: string,
): Promise<void> {
  const field = await table.getField<ITextField>(fieldId);
  await field.setValue(recordId, value);
}

const ASPECT_SET = new Set<string>([
  'auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3',
  '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1',
]);

export function normalizeAspectRatio(raw: string): AspectRatio {
  const t = raw.trim();
  if (ASPECT_SET.has(t)) return t as AspectRatio;
  const m = t.match(/(\d+\s*:\s*\d+|auto)/i);
  if (m) {
    const v = m[1].replace(/\s/g, '');
    if (ASPECT_SET.has(v)) return v as AspectRatio;
  }
  return DEFAULT_SETTINGS.aspectRatio;
}

export function normalizeImageSize(raw: string): ImageSize {
  const u = raw.trim().toUpperCase();
  if (u === '1K' || u === '2K' || u === '4K') return u as ImageSize;
  if (raw.includes('4')) return '4K';
  if (raw.includes('1')) return '1K';
  return DEFAULT_SETTINGS.imageSize;
}

export function normalizeModel(raw: string): string {
  const t = raw.trim();
  if (!t) return DEFAULT_SETTINGS.imageModel;
  return t;
}

/** 从表格读取指定行的完整生图参数（不依赖 UI 当前状态） */
export async function readRecordSnapshot(
  recordId: string,
  mapping: RecordFieldMapping,
): Promise<RecordJobSnapshot> {
  const table = await bitable.base.getActiveTable();
  const generateParams: RecordGenerateParams = {
    aspectRatio: DEFAULT_SETTINGS.aspectRatio,
    imageSize: DEFAULT_SETTINGS.imageSize,
    imageModel: DEFAULT_SETTINGS.imageModel,
    statusLabel: '',
  };

  let prompt = '';
  let referenceImageUrls: string[] = [];

  if (mapping.promptFieldId) {
    prompt = await readTextCell(table, mapping.promptFieldId, recordId);
  }
  if (mapping.referenceImageFieldIds.length) {
    referenceImageUrls = await readAllReferenceUrls(
      table,
      mapping.referenceImageFieldIds,
      recordId,
    );
  }
  if (mapping.aspectRatioFieldId) {
    generateParams.aspectRatio = normalizeAspectRatio(
      await readSelectCell(table, mapping.aspectRatioFieldId, recordId),
    );
  }
  if (mapping.imageSizeFieldId) {
    generateParams.imageSize = normalizeImageSize(
      await readSelectCell(table, mapping.imageSizeFieldId, recordId),
    );
  }
  if (mapping.modelFieldId) {
    generateParams.imageModel = normalizeModel(
      await readSelectCell(table, mapping.modelFieldId, recordId),
    );
  }

  return {
    recordId,
    prompt,
    referenceImageUrls,
    aspectRatio: generateParams.aspectRatio,
    imageSize: generateParams.imageSize,
    imageModel: generateParams.imageModel,
  };
}

/** 按当前表标准字段名自动映射 */
export function guessFieldMapping(
  metaList: { id: string; name: string; type: FieldType }[],
): RecordFieldMapping {
  const byExact = (name: string) =>
    metaList.find((m) => m.name === name)?.id;

  const byName = (keywords: string[]) =>
    metaList.find((m) =>
      keywords.some((k) => m.name.toLowerCase().includes(k.toLowerCase())),
    )?.id;

  const referenceImageFieldIds = [1, 2, 3, 4, 5]
    .map((i) => byExact(`参考图${i}`))
    .filter((id): id is string => Boolean(id));

  return {
    promptFieldId: byExact('Prompt') ?? byName(['prompt', '提示词']),
    referenceImageFieldIds,
    aspectRatioFieldId: byExact('比例'),
    imageSizeFieldId: byExact('尺寸'),
    modelFieldId: byExact('模型'),
    statusFieldId: byExact('状态'),
    resultImageFieldId: byExact('结果图') ?? byName(['结果图', '成图']),
  };
}

export function isStandardTableMapping(mapping: RecordFieldMapping): boolean {
  return Boolean(mapping.promptFieldId && mapping.resultImageFieldId);
}

/** 将 API 返回的图片 URL 下载后写入「结果图」附件列 */
export async function writeGeneratedImageToField(
  table: ITable,
  fieldId: string,
  recordId: string,
  imageUrl: string,
): Promise<string[]> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`下载生成图失败 (${res.status})`);
  }
  const blob = await res.blob();
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  const file = new File([blob], `generated-${Date.now()}.${ext}`, {
    type: blob.type || 'image/jpeg',
  });
  const field = await table.getField<IAttachmentField>(fieldId);
  await field.setValue(recordId, file);
  const urls = await field.getAttachmentUrls(recordId);
  return urls ?? [];
}
// AIGC END
