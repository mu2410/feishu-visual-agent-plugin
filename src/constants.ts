// AIGC START
import type { AspectRatio, ImageSize } from './types';

export const PLUGIN_TITLE = '视觉Agent';

export const IMAGE_MODELS = [
  { label: 'nano-banana-2', value: 'nano-banana-2' },
  { label: 'nano-banana-2-4k-cl', value: 'nano-banana-2-4k-cl' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-pro', value: 'nano-banana-pro' },
];

export const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: 'auto', value: 'auto' },
];

export const IMAGE_SIZES: { label: string; value: ImageSize }[] = [
  { label: '2K', value: '2K' },
  { label: '1K', value: '1K' },
  { label: '4K', value: '4K' },
];

export const GRSai_NODES = [
  { label: '国内节点', value: 'https://grsai.dakka.com.cn' },
  { label: '全球节点', value: 'https://grsaiapi.com' },
];

export const DEFAULT_SETTINGS = {
  grsaiApiKey: '',
  grsaiBaseUrl: 'https://grsai.dakka.com.cn',
  imageModel: 'nano-banana-2',
  aspectRatio: '9:16' as AspectRatio,
  imageSize: '2K' as ImageSize,
};

export const SETTINGS_STORAGE_KEY = 'visual-agent-plugin-settings-v2';

/** 结果图列输出边长（生图后缩放为 1440×1440） */
export const RESULT_IMAGE_1440_SIZE = 1440;
// AIGC END
