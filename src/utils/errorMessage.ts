// AIGC START
/** 将运行时/API 英文报错转为中文提示 */
export function toChineseError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const msg = raw.trim();
  if (!msg) return '操作失败，请稍后重试';

  const rules: [RegExp | string, string][] = [
    [
      /Cannot read properties of null \(reading 'map'\)/i,
      '读取表格数据失败，请刷新插件或重新选择记录',
    ],
    [/Cannot read properties of null/i, '数据尚未加载完成，请点击「刷新」重试'],
    [/Cannot read properties of undefined/i, '数据格式异常，请检查字段绑定'],
    [/network|failed to fetch|NetworkError/i, '网络异常，请检查网络或生图节点地址'],
    [/401|403|unauthorized/i, 'API 密钥无效或已过期，请在设置中检查'],
    [/429|rate limit/i, '请求过于频繁，请稍后再试'],
    [/timeout|timed out/i, '请求超时，请稍后重试'],
    [/CORS|cross-origin/i, '图片无法写回表格（跨域限制），请在成图列手动上传'],
    [/generate failed/i, '生图失败，请检查提示词或 API 配额'],
    [/violation/i, '内容未通过审核，请修改提示词后重试'],
  ];

  for (const [pattern, text] of rules) {
    if (typeof pattern === 'string' ? msg.includes(pattern) : pattern.test(msg)) {
      return text;
    }
  }

  if (/[\u4e00-\u9fff]/.test(msg)) return msg;
  return `操作失败：${msg}`;
}
// AIGC END
