import { useMemo } from 'react';
import { previewFor } from '../lib/previews.js';

function toSrc(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Bước 1: danh sách loại biểu đồ kèm ảnh demo, bấm để xem lớn rồi bấm "Tạo biểu đồ"
export default function ChartGallery({ charts, selectedId, onSelect, onCreate }) {
  const srcs = useMemo(
    () => Object.fromEntries(charts.map((c) => [c.id, toSrc(previewFor(c))])),
    [charts]
  );
  const selected = charts.find((c) => c.id === selectedId);

  return (
    <div>
      <div className="gallery">
        {charts.map((c) => (
          <button
            key={c.id}
            className={c.id === selectedId ? 'gallery-card selected' : 'gallery-card'}
            onClick={() => onSelect(c.id)}
          >
            <div className="thumb">
              <img src={srcs[c.id]} alt={c.label} />
            </div>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="gallery-preview">
          <h3 className="section-title">Ví dụ: {selected.label}</h3>
          <div className="big-preview">
            <img src={srcs[selected.id]} alt={`Ví dụ ${selected.label}`} />
          </div>
          <div className="actions">
            <button onClick={onCreate}>Tạo biểu đồ</button>
          </div>
        </div>
      ) : (
        <p className="hint">Chọn một loại để xem ví dụ.</p>
      )}
    </div>
  );
}
