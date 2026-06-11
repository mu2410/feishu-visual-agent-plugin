


// AIGC START
/**
 * 多维表格（Bitable）读写工具
 *
 * 职责：
 * - 解析当前选中行、读取/写入单元格
 * - 按标准列名自动映射字段 ID
 * - 规范化表格中的比例、尺寸、结果图像素等参数
 * - 下载生图结果并按指定像素缩放后写回「结果图」附件列
 */
import {
  bitable,
  FieldType,
  type IAttachmentField,
  type ISingleSelectField,
  type ITable,
  type ITextField,
} from '@lark-base-open/js-sdk';
import type { AspectRatio, ImageSize, RecordFieldMapping, RecordGenerateParams, RecordJobSnapshot, ResultImagePixels } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_RESULT_IMAGE_PIXELS, MAX_RESULT_IMAGE_PIXEL, MIN_RESULT_IMAGE_PIXEL, SUPPORTED_ASPECT_RATIOS } from '../constants';
import { resizeImageBlob } from './imageResize';

// ─── 记录与单元格读取 ─────────────────────────────────────────

/**
 * 获取当前应操作的 recordId
 * 边栏插件中 bitable.base.getSelection().recordId 常为空，故优先读视图选中行列表
 */
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

/**
 * 获取当前视图选中的全部 recordId（支持多选勾选行）
 * 若无多选 API，则退回 resolveActiveRecordId 的单条
 */
export async function resolveSelectedRecordIds(): Promise<string[]> {
  const ids: string[] = [];
  try {
    const table = await bitable.base.getActiveTable();
    const view = await table.getActiveView();
    const getSelected = (
      view as { getSelectedRecordIdList?: () => Promise<string[]> }
    ).getSelectedRecordIdList;
    if (getSelected) {
      const selected = await getSelected.call(view);
      if (selected.length > 0) {
        return [...new Set(selected)];
      }
    }
  } catch {
    /* ignore */
  }

  const single = await resolveActiveRecordId();
  if (single) ids.push(single);
  return ids;
}

/** 读取文本字段（Prompt 等） */
export async function readTextCell(
  table: ITable,
  fieldId: string,
  recordId: string,
): Promise<string> {
  const text = await table.getCellString(fieldId, recordId);
  return text?.trim() ?? '';
}

/**
 * 读取单选字段显示文本
 * getCellString 有时为空，降级读 getCellValue.text
 */
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

/** 写入单选字段（状态：生成中/成功/失败） */
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

/** 读取附件字段的全部 URL（结果图、参考图） */
export async function readAttachmentUrls(
  table: ITable,
  fieldId: string,
  recordId: string,
): Promise<string[]> {
  const field = await table.getField<IAttachmentField>(fieldId);
  const urls = await field.getAttachmentUrls(recordId);
  return urls ?? [];
}

/** 依次读取参考图1~5，合并为 API 所需的 images 数组 */
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

/** 写入文本字段 */
export async function writeTextCell(
  table: ITable,
  fieldId: string,
  recordId: string,
  value: string,
): Promise<void> {
  const field = await table.getField<ITextField>(fieldId);
  await field.setValue(recordId, value);
}

// ─── 参数规范化 ───────────────────────────────────────────────

/** Grsai API 支持的比例集合，用于校验表格单选值 */
const ASPECT_SET = new Set<string>(SUPPORTED_ASPECT_RATIOS);

/** 将表格「比例」列文本规范为 API 支持的 AspectRatio */
export function normalizeAspectRatio(raw: string): AspectRatio {
  const t = raw.trim().replace(/：/g, ':');
  if (ASPECT_SET.has(t)) return t as AspectRatio;
  const m = t.match(/(\d+\s*:\s*\d+|auto)/i);
  if (m) {
    const v = m[1].replace(/\s/g, '');
    if (ASPECT_SET.has(v)) return v as AspectRatio;
  }
  return DEFAULT_SETTINGS.aspectRatio;
}

/** 将表格「尺寸」列规范为 1K / 2K / 4K */
export function normalizeImageSize(raw: string): ImageSize {
  const u = raw.trim().toUpperCase();
  if (u === '1K' || u === '2K' || u === '4K') return u as ImageSize;
  if (raw.includes('4')) return '4K';
  if (raw.includes('1')) return '1K';
  return DEFAULT_SETTINGS.imageSize;
}

/** 将表格「模型」列规范为模型名，空则使用默认模型 */
export function normalizeModel(raw: string): string {
  const t = raw.trim();
  if (!t) return DEFAULT_SETTINGS.imageModel;
  return t;
}

/**
 * 从「结果图像素」列解析输出尺寸
 * 支持：1000*1792、1440*1440、1440（正方形）及 × / x 分隔符
 */
export function parseResultImagePixels(
  raw: string,
  fallback: ResultImagePixels = DEFAULT_RESULT_IMAGE_PIXELS,
): ResultImagePixels {
  const t = raw.trim().replace(/×/g, '*').replace(/[xX]/g, '*');
  if (!t) return fallback;

  const pair = t.match(/(\d{2,5})\s*\*\s*(\d{2,5})/);
  if (pair) {
    const width = parseInt(pair[1], 10);
    const height = parseInt(pair[2], 10);
    if (isValidResultImagePixel(width) && isValidResultImagePixel(height)) {
      return { width, height };
    }
  }

  const single = t.match(/^(\d{2,5})$/);
  if (single) {
    const n = parseInt(single[1], 10);
    if (isValidResultImagePixel(n)) return { width: n, height: n };
  }

  return fallback;
}

/** 校验单边像素是否在允许范围内 */
function isValidResultImagePixel(n: number): boolean {
  return n >= MIN_RESULT_IMAGE_PIXEL && n <= MAX_RESULT_IMAGE_PIXEL;
}

/** 格式化像素尺寸为 UI 展示字符串，如 1000×1792 */
export function formatResultImagePixels(pixels: ResultImagePixels): string {
  return `${pixels.width}×${pixels.height}`;
}

/** 是否为「失败」状态（重跑失败行用） */
export function isFailedStatusLabel(label: string): boolean {
  return label.trim() === '失败';
}

/**
 * 读取「结果图像素」列
 * 兼容文本、单选、数字三种字段类型
 */
export async function readPixelCell(
  table: ITable,
  fieldId: string,
  recordId: string,
): Promise<string> {
  const text = await readTextCell(table, fieldId, recordId);
  if (text) return text;
  const select = await readSelectCell(table, fieldId, recordId);
  if (select) return select;
  try {
    const val = await table.getCellValue(fieldId, recordId);
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(Math.round(val));
    }
  } catch {
    /* ignore */
  }
  return '';
}

// ─── 生图任务快照与字段映射 ───────────────────────────────────

/**
 * 从表格读取指定行的完整生图参数
 * 点击「生成图片」时调用，锁定该行数据，避免用户切换行后写错记录
 */
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
    resultImagePixels: DEFAULT_RESULT_IMAGE_PIXELS,
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
  if (mapping.resultImagePixelFieldId) {
    generateParams.resultImagePixels = parseResultImagePixels(
      await readPixelCell(table, mapping.resultImagePixelFieldId, recordId),
    );
  }
  if (mapping.statusFieldId) {
    generateParams.statusLabel = await readSelectCell(
      table,
      mapping.statusFieldId,
      recordId,
    );
  }

  return {
    recordId,
    prompt,
    referenceImageUrls,
    aspectRatio: generateParams.aspectRatio,
    imageSize: generateParams.imageSize,
    imageModel: generateParams.imageModel,
    resultImagePixels: generateParams.resultImagePixels,
    statusLabel: generateParams.statusLabel,
  };
}

/**
 * 按标准表结构列名自动匹配 fieldId
 * 列名约定：Prompt、参考图1~5、比例、尺寸、模型、状态、结果图、结果图像素
 */
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
    resultImageFieldId:
      byExact('结果图') ??
      metaList.find(
        (m) =>
          m.type === FieldType.Attachment && m.name.includes('结果图'),
      )?.id,
    resultImagePixelFieldId:
      byExact('结果图像素') ??
      byName(['结果图像素', '结果图尺寸', '输出像素']),
  };
}

/** 是否具备最低可用字段：Prompt + 结果图 */
export function isStandardTableMapping(mapping: RecordFieldMapping): boolean {
  return Boolean(mapping.promptFieldId && mapping.resultImageFieldId);
}

// ─── 生图结果写回 ─────────────────────────────────────────────

/** 从 Grsai 返回的图片 URL 下载二进制 */
async function downloadImageBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`下载生成图失败 (${res.status})`);
  }
  return res.blob();
}

/** 将 Blob 上传为附件并返回飞书 CDN URL */
async function uploadBlobToAttachmentField(
  table: ITable,
  fieldId: string,
  recordId: string,
  blob: Blob,
  filename: string,
): Promise<string[]> {
  const file = new File([blob], filename, {
    type: blob.type || 'image/jpeg',
  });
  const field = await table.getField<IAttachmentField>(fieldId);
  await field.setValue(recordId, file);
  const urls = await field.getAttachmentUrls(recordId);
  return urls ?? [];
}

/** 写回结果图的返回值 */
export interface WriteGeneratedImageResult {
  urls: string[];
}

/**
 * 下载生图结果，按「结果图像素」指定的宽×高缩放（cover 居中裁剪）后写入「结果图」
 */
export async function writeGeneratedImageResults(
  table: ITable,
  recordId: string,
  imageUrl: string,
  resultImageFieldId: string,
  outputPixels: ResultImagePixels = DEFAULT_RESULT_IMAGE_PIXELS,
): Promise<WriteGeneratedImageResult> {
  const blob = await downloadImageBlob(imageUrl);
  const { width, height } = outputPixels;
  const resized = await resizeImageBlob(blob, width, height, 'cover');
  const ts = Date.now();
  const urls = await uploadBlobToAttachmentField(
    table,
    resultImageFieldId,
    recordId,
    resized,
    `generated-${width}x${height}-${ts}.jpg`,
  );
  return { urls };
}

/** @deprecated 请使用 writeGeneratedImageResults */
export async function writeGeneratedImageToField(
  table: ITable,
  fieldId: string,
  recordId: string,
  imageUrl: string,
): Promise<string[]> {
  const { urls } = await writeGeneratedImageResults(
    table,
    recordId,
    imageUrl,
    fieldId,
  );
  return urls;
}
// AIGC END
