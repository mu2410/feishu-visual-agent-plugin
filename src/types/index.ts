// AIGC START
export type ThemeMode = 'LIGHT' | 'DARK';

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

export type ImageSize = '1K' | '2K' | '4K';

export type GenerateStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'violation';

export interface PluginSettings {
  grsaiApiKey: string;
  grsaiBaseUrl: string;
  imageModel: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
}

/** 与多维表格列一一对应 */
export interface RecordFieldMapping {
  promptFieldId?: string;
  referenceImageFieldIds: string[];
  aspectRatioFieldId?: string;
  imageSizeFieldId?: string;
  modelFieldId?: string;
  statusFieldId?: string;
  resultImageFieldId?: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

/** 从表格单选列读出的生图参数 */
export interface RecordGenerateParams {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imageModel: string;
  statusLabel: string;
}

/** 单次生图任务快照（点击时锁定，避免切换行写错记录） */
export interface RecordJobSnapshot {
  recordId: string;
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imageModel: string;
}

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
  /** 正在读取表格 */
  loading: boolean;
  message: string;
  /** 正在生图的 recordId 列表 */
  generatingRecordIds: string[];
}
// AIGC END
