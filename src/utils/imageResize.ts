// AIGC START
/**
 * 浏览器端图片缩放工具
 * 使用 Canvas 将 Blob 缩放到指定宽×高，供写回「结果图」前处理
 */
/**
 * 将图片 Blob 缩放为固定尺寸
 * @param mode cover = 居中裁剪铺满；contain = 完整显示并留白
 */
export async function resizeImageBlob(
  blob: Blob,
  width: number,
  height: number,
  mode: 'cover' | 'contain' = 'cover',
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('无法创建画布进行缩放');
  }

  if (mode === 'cover') {
    // 取较大缩放比，裁剪源图中心区域以填满目标尺寸
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const sw = width / scale;
    const sh = height / scale;
    const sx = (bitmap.width - sw) / 2;
    const sy = (bitmap.height - sh) / 2;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  } else {
    // 取较小缩放比，完整显示图片，空白处填白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.drawImage(bitmap, dx, dy, dw, dh);
  }

  bitmap.close();

  // 输出 JPEG，质量 0.92
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('图片缩放失败'));
      },
      'image/jpeg',
      0.92,
    );
  });
}
// AIGC END
