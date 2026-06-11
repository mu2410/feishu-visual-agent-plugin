// AIGC START
/**
 * 剪贴板工具
 * 飞书 iframe 内 navigator.clipboard 常被权限策略拦截，需 textarea + execCommand 降级
 */

/** 复制文本到系统剪贴板 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new Error('没有可复制的内容');
  }

  // 优先使用现代 Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* 继续尝试降级 */
    }
  }

  // 降级：隐藏 textarea + document.execCommand('copy')
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
