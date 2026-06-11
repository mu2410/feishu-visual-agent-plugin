// AIGC START
/**
 * Grsai nano-banana 生图 API 封装
 * 文档见项目根目录 api规范操作.md
 */
import type { AspectRatio, GenerateStatus, ImageSize, PluginSettings } from '../types';

/** 调用 /v1/api/generate 的请求体 */
export interface GenerateRequest {
  prompt: string;
  images?: string[];
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}

/** API 同步 JSON 响应结构 */
export interface GenerateResponse {
  id: string;
  status: GenerateStatus;
  progress?: number;
  results?: { url: string }[];
  error?: string;
}

/**
 * 调用 Grsai 生图接口（每条记录仅调用一次）
 * 比例/尺寸/模型优先使用表格行参数，settings 为兜底
 */
export async function generateImage(
  settings: PluginSettings,
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const base = settings.grsaiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/v1/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.grsaiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.imageModel,
      prompt: req.prompt,
      images: req.images ?? [],
      aspectRatio: req.aspectRatio ?? settings.aspectRatio,
      imageSize: req.imageSize ?? settings.imageSize,
      replyType: 'json',
    }),
  });

  const data = (await res.json()) as GenerateResponse;

  // HTTP 层错误
  if (!res.ok) {
    const err = data.error ?? '';
    if (err.includes('violation')) {
      throw new Error('内容未通过审核，请修改提示词后重试');
    }
    if (err.includes('failed') || err.includes('generate')) {
      throw new Error('生图失败，请检查提示词、参考图或 API 配额');
    }
    throw new Error(err ? `生图接口错误：${err}` : `生图失败（HTTP ${res.status}）`);
  }

  // 业务层失败状态
  if (data.status === 'failed') {
    throw new Error(data.error ? `生图失败：${data.error}` : '生图失败');
  }
  if (data.status === 'violation') {
    throw new Error('内容未通过审核，请修改提示词后重试');
  }

  return data;
}
// AIGC END
