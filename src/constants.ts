// AIGC START
/**
 * 插件常量配置
 * 包含：模型列表、支持的比例/尺寸、Grsai 节点、默认值、结果图像素范围
 */
import type { AspectRatio, ImageSize, ResultImagePixels } from './types';

/** 插件标题（显示在边栏顶部） */
export const PLUGIN_TITLE = '视觉Agent';

/** 可选生图模型（表格「模型」列也可自定义） */
export const IMAGE_MODELS = [
  { label: 'nano-banana-2', value: 'nano-banana-2' },
  { label: 'nano-banana-2-4k-cl', value: 'nano-banana-2-4k-cl' },
  { label: 'nano-banana-fast', value: 'nano-banana-fast' },
  { label: 'nano-banana-pro', value: 'nano-banana-pro' },
];

/** Grsai API 支持的全部比例（与 api规范操作.md 一致） */
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

/** 比例下拉选项（label = value） */
export const ASPECT_RATIOS: { label: string; value: AspectRatio }[] =
  SUPPORTED_ASPECT_RATIOS.map((value) => ({ label: value, value }));

/** 分辨率档位选项 */
export const IMAGE_SIZES: { label: string; value: ImageSize }[] = [
  { label: '2K', value: '2K' },
  { label: '1K', value: '1K' },
  { label: '4K', value: '4K' },
];

/** Grsai API 节点地址 */
export const GRSai_NODES = [
  { label: '国内节点', value: 'https://grsai.dakka.com.cn' },
  { label: '全球节点', value: 'https://grsaiapi.com' },
];

/** 插件设置默认值（表格未填参数时的兜底） */
export const DEFAULT_SETTINGS = {
  grsaiApiKey: '',
  grsaiBaseUrl: 'https://grsai.dakka.com.cn',
  imageModel: 'nano-banana-2',
  aspectRatio: '9:16' as AspectRatio,
  imageSize: '2K' as ImageSize,
};

/** localStorage 中插件设置的键名 */
export const SETTINGS_STORAGE_KEY = 'visual-agent-plugin-settings-v2';

/** 结果图默认输出尺寸（「结果图像素」列为空时使用） */
export const DEFAULT_RESULT_IMAGE_PIXELS: ResultImagePixels = {
  width: 1440,
  height: 1440,
};

/** 结果图单边像素允许的最小/最大值 */
export const MIN_RESULT_IMAGE_PIXEL = 64;
export const MAX_RESULT_IMAGE_PIXEL = 8192;

/** 单条任务失败后额外自动重试次数（总尝试 = 1 + 此值；仅重试写回，不重复调生图 API） */
export const JOB_AUTO_RETRY_COUNT = 2;

/** 任务级重试间隔（毫秒） */
export const JOB_RETRY_DELAY_MS = 3000;
// AIGC END
