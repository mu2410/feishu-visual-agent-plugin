// AIGC START
import type { AspectRatio, ImageSize, ResultImagePixels } from './types';

export const PLUGIN_TITLE = '视觉Agent';

export const IMAGE_MODELS = [
  { label: 'nano-banana-2', value: 'nano-banana-2' },
  { label: 'nano-banana-2-4k-cl', value: 'nano-banana-2-4k-cl' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-pro', value: 'nano-banana-pro' },
];

export const SUPPORTED_ASPECT_RATIOS: AspectRatio[] = [
  'auto',
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
  '1:4',
  '4:1',
  '1:8',
  '8:1',
];

export const ASPECT_RATIOS: { label: string; value: AspectRatio }[] =
  SUPPORTED_ASPECT_RATIOS.map((value) => ({ label: value, value }));

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

/** 结果图默认输出尺寸（未填「结果图像素」时使用） */
export const DEFAULT_RESULT_IMAGE_PIXELS: ResultImagePixels = {
  width: 1440,
  height: 1440,
};

export const MIN_RESULT_IMAGE_PIXEL = 64;
export const MAX_RESULT_IMAGE_PIXEL = 8192;
// AIGC END
