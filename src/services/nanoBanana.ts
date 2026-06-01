// AIGC START
import type { AspectRatio, GenerateStatus, ImageSize, PluginSettings } from '../types';

export interface GenerateRequest {
  prompt: string;
  images?: string[];
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}

export interface GenerateResponse {
  id: string;
  status: GenerateStatus;
  progress?: number;
  results?: { url: string }[];
  error?: string;
}

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
  if (data.status === 'failed') {
    throw new Error(data.error ? `生图失败：${data.error}` : '生图失败');
  }
  if (data.status === 'violation') {
    throw new Error('内容未通过审核，请修改提示词后重试');
  }
  return data;
}
// AIGC END
