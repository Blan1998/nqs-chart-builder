import { useMemo, useState } from 'react';
import ChartGallery from './ChartGallery.jsx';
import catImg from '../assets/cat.png';
import { CHART_GUIDE } from '../lib/chartGuide.js';

export default function Home({ charts, selectedId, onSelect, onCreate }) {
  const [ai, setAi] = useState({ status: 'idle' });
  const [keyInput, setKeyInput] = useState('');

  const chartList = useMemo(
    () => charts.map((c) => ({ id: c.id, label: c.label, desc: CHART_GUIDE[c.id] ?? '' })),
    [charts]
  );

  async function advise() {
    if (!window.aiApi) {
      setAi({ status: 'error', error: 'Chức năng này chỉ hoạt động trong app desktop.' });
      return;
    }
    setAi({ status: 'loading' });
    try {
      const res = await window.aiApi.advise(chartList);
      if (res.cancelled) return setAi({ status: 'idle' });
      if (!res.ok && res.error === 'NO_KEY') return setAi({ status: 'needKey' });
      if (!res.ok) return setAi({ status: 'error', error: res.error });
      setAi({ status: 'done', ...res });
    } catch (e) {
      setAi({ status: 'error', error: e.message });
    }
  }

  async function saveKeyAndRetry() {
    const key = keyInput.trim();
    if (!key) return;
    await window.aiApi.setKey(key);
    setKeyInput('');
    advise();
  }

  const label = (id) => charts.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="home">
      <div className="hero">
        <div className="hero-text">
          <h1>Chào cưng,</h1>
          <h2>Hôm nay cưng muốn vẽ chart gì nào ?</h2>
          <div className="hero-actions">
            <button className="upload-btn" onClick={advise} disabled={ai.status === 'loading'}>
              Upload file Excel
            </button>
            <button className="link-btn" onClick={advise} disabled={ai.status === 'loading'}>
              Tôi chưa biết thuộc loại gì, nhờ tư vấn cho tôi
            </button>
          </div>

          {ai.status === 'loading' && <p className="ai-note">Đang đọc file và hỏi ý kiến trợ lý...</p>}

          {ai.status === 'needKey' && (
            <div className="ai-box">
              <p>Cần nhập API key Gemini một lần để dùng tính năng tư vấn.</p>
              <div className="key-row">
                <input
                  type="password"
                  placeholder="AIza..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
                <button onClick={saveKeyAndRetry}>Lưu và tiếp tục</button>
              </div>
            </div>
          )}

          {ai.status === 'error' && <div className="ai-box error">{ai.error}</div>}

          {ai.status === 'done' && (
            <div className="ai-box">
              <p className="ai-file">
                File <b>{ai.fileName}</b>: {ai.columns.length} cột, {ai.rowCount} dòng dữ liệu.
              </p>
              {ai.suggestions.length === 0 ? (
                <p>Trợ lý chưa tìm được loại phù hợp. Bạn chọn trong danh sách bên dưới.</p>
              ) : (
                <>
                  <p className="ai-title">Gợi ý cho dữ liệu này:</p>
                  <div className="suggest-list">
                    {ai.suggestions.map((s) => (
                      <div key={s.id} className={s.id === selectedId ? 'suggest-row selected' : 'suggest-row'}>
                        <button className="suggest" onClick={() => onSelect(s.id)}>
                          <b>{label(s.id)}</b>
                          <span>{s.reason}</span>
                        </button>
                        <button className="suggest-create" onClick={() => { onSelect(s.id); onCreate(); }}>
                          Tạo ngay
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {ai.note && <p className="ai-note">{ai.note}</p>}
            </div>
          )}
        </div>
        <img className="hero-cat" src={catImg} alt="" />
      </div>

      <p className="or-line">Hoặc chọn các chart dưới đây</p>

      <div className="card">
        <h2>Chọn loại biểu đồ</h2>
        <p className="hint-line">Bấm vào một loại để xem ví dụ, rồi bấm "Tạo biểu đồ" để sang bước tùy chọn.</p>
        <ChartGallery charts={charts} selectedId={selectedId} onSelect={onSelect} onCreate={onCreate} />
      </div>
    </div>
  );
}
