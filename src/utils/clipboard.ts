// AIGC START
/** 飞书 iframe 内 clipboard API 常被限制，需降级方案 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new Error('没有可复制的内容');
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* 继续尝试降级 */
    }
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }

  if (!ok) {
    throw new Error('复制失败，请手动选中 Prompt 文本后 Ctrl+C');
  }
}
// AIGC END
