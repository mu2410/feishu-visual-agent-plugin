// AIGC START
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 审核/密钥类错误不做任务级重试 */
export function isNonRetryableJobError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /审核|违规|密钥|401|403|Prompt|提示词|配额/.test(msg);
}
// AIGC END
