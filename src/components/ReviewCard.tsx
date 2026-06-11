// AIGC START
/**
 * 成图预览卡片
 * 展示当前选中行「结果图」列的第一张附件
 */

interface Props {
  imageUrl: string | null;
  onView?: () => void;
}

export function ImagePreview({ imageUrl, onView }: Props) {
  return (
    <section className="va-card">
      <div className="va-card__title-row">
        <h3 className="va-card__title">成图预览</h3>
        {imageUrl && onView && (
          <button type="button" className="va-btn va-btn--text" onClick={onView}>
            查看
          </button>
        )}
      </div>
      <div className="va-review">
        {imageUrl ? (
          <img src={imageUrl} alt="生成图" className="va-review__img" />
        ) : (
          <div className="va-review__empty">
            生图成功后将预览，并写入「结果图」列
          </div>
        )}
      </div>
    </section>
  );
}
// AIGC END
