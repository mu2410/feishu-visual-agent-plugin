// AIGC START
/**
 * 全局 TypeScript 类型定义
 * 涵盖：插件设置、表格字段映射、生图参数、UI 状态等
 */

/** 飞书多维表格主题模式 */
export type ThemeMode = 'LIGHT' | 'DARK';

/** Grsai nano-banana API 支持的图像比例 */
export type AspectRatio =
  | 'auto'
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '5:4'
  | '4:5'
  | '21:9'
  | '1:4'
  | '4:1'
  | '1:8'
  | '8:1';

/** Grsai API 输出分辨率档位 */
export type ImageSize = '1K' | '2K' | '4K';

/** 结果图输出尺寸（宽×高，单位像素） */
export interface ResultImagePixels {
  width: number;
  height: number;
}

/** 生图 API / UI 任务状态 */
export type GenerateStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'violation';

/** 插件全局设置（存 localStorage，不写表格） */
export interface PluginSettings {
  grsaiApiKey: string;
  grsaiBaseUrl: string;
  imageModel: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

/**
 * 表格列 fieldId 映射
 * 由 guessFieldMapping 自动推断，也可从 localStorage 覆盖
 */
export interface RecordFieldMapping {
  promptFieldId?: string;
  referenceImageFieldIds: string[];
  aspectRatioFieldId?: string;
  imageSizeFieldId?: string;
  modelFieldId?: string;
  statusFieldId?: string;
  resultImageFieldId?: string;
  /** 结果图像素列，如单选 1000*1792、1440*1440 */
  resultImagePixelFieldId?: string;
}

/** 下拉选项通用结构 */
export interface FieldOption {
  label: string;
  value: string;
}

/** 从当前选中行读出的生图参数（用于 UI 展示） */
export interface RecordGenerateParams {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imageModel: string;
  statusLabel: string;
  /** 结果图输出尺寸，默认 1440×1440 */
  resultImagePixels: ResultImagePixels;
}

/**
 * 单次生图任务快照
 * 点击「生成图片」时从表格锁定，防止切换行导致 prompt/参数写错行
 */
export interface RecordJobSnapshot {
  recordId: string;
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imageModel: string;
  resultImagePixels: ResultImagePixels;
  /** 表格「状态」列当前值，用于批量重跑失败行 */
  statusLabel: string;
}

/** useBitableRecord 管理的插件 UI 状态 */
export interface VisualAgentState {
  recordId: string | null;
  recordTitle: string;
  prompt: string;
  resultImageUrl: string | null;
  referenceImageUrls: string[];
  generateParams: RecordGenerateParams;
  status: GenerateStatus;
  progress: number;
  error: string | null;
  /** 正在从表格读取数据 */
  loading: boolean;
  message: string;
  /** 正在后台生图的 recordId 列表（防重复点击） */
  generatingRecordIds: string[];
  /** 表格当前视图选中的 recordId 列表（含多选） */
  selectedRecordIds: string[];
}
// AIGC END
