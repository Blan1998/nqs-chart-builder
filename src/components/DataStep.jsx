import { useState, useEffect, useRef } from 'react';
import { validateRows } from '../lib/dataUtils.js';
import { CHART_GUIDE } from '../lib/chartGuide.js';
import { newSeriesId } from '../lib/wide.js';

// Các loại nhiều chuỗi cho chọn từng chuỗi là Cột hoặc Đường
const KIND_CHARTS = ['groupedBar', 'combo', 'stackedBar'];

// Bước 4: nhập dữ liệu trực tiếp. Với bảng ngang (series != null) có thêm, đổi tên, xóa cột chuỗi.
export default function DataStep({ spec, rows, onRowsChange, series, onSeriesChange, settings, onSettingsChange }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const errors = validateRows(spec, rows);
  const wide = !!series;

  const errorAt = (i, key) => errors.find((e) => e.row === i && e.key === key);

  function setCell(i, key, value) {
    onRowsChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    onRowsChange([...rows, {}]);
  }

  function removeRow(i) {
    onRowsChange(rows.filter((_, idx) => idx !== i));
  }

  // Bỏ mọi dấu chấm và dấu phẩy trong các cột số (không đụng tên danh mục, khu vực)
  function stripSeparators() {
    const numericKeys = spec.columns.filter((c) => c.type === 'number').map((c) => c.key);
    let changed = 0;
    const next = rows.map((r) => {
      const copy = { ...r };
      numericKeys.forEach((k) => {
        const v = r[k];
        if (v !== undefined && v !== null && /[.,]/.test(String(v))) {
          copy[k] = String(v).replace(/[.,]/g, '');
          changed++;
        }
      });
      return copy;
    });
    if (changed === 0) {
      setMessage('Không có dấu . hoặc , nào trong các cột số.');
      return;
    }
    if (!window.confirm(`Bỏ ${changed} dấu . và , trong các cột số? Thao tác này không hoàn tác được.`)) return;
    onRowsChange(next);
    setMessage(`Đã bỏ dấu ở ${changed} ô.`);
  }

  // Bật Dùng Logo: tìm logo khớp với các danh mục (khớp chính xác, sau đó nhờ AI cho các tên gần đúng)
  async function toggleLogo(on) {
    if (!on) {
      onSettingsChange({ ...settings, useLogo: false });
      return;
    }
    if (!window.logoApi) return setMessage('Chức năng này chỉ hoạt động trong app desktop.');
    const cats = [...new Set(rows.map((r) => String(r.category ?? '').trim()).filter(Boolean))];
    setBusy(true);
    setMessage('Đang tìm logo cho các danh mục...');
    try {
      const res = await window.logoApi.match(cats);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      onSettingsChange({
        ...settings,
        useLogo: true,
        logoAliases: { ...(settings.logoAliases || {}), ...res.aliases },
      });
      const found = Object.keys(res.aliases).length;
      const miss = res.missing.length ? ` Chưa có logo: ${res.missing.join(', ')} (sẽ hiện bằng chữ).` : '';
      setMessage(`Đã gán logo cho ${found}/${cats.length} danh mục.${miss}`);
    } catch (e) {
      setMessage(`Lỗi tìm logo: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    if (rows.length && window.confirm('Xóa toàn bộ dữ liệu của loại biểu đồ này?')) {
      onRowsChange([]);
    }
  }

  function renameSeries(id, name) {
    onSeriesChange(series.map((s) => (s.id === id ? { ...s, name } : s)), rows);
  }

  function changePct(id, pct) {
    onSeriesChange(series.map((s) => (s.id === id ? { ...s, pct } : s)), rows);
  }

  function changeKind(id, kind) {
    onSeriesChange(series.map((s) => (s.id === id ? { ...s, kind } : s)), rows);
  }

  function addSeries() {
    onSeriesChange([...series, { id: newSeriesId(), name: `Chuỗi ${series.length + 1}` }], rows);
  }

  function removeSeries(id) {
    const hasValues = rows.some((r) => r[id] !== undefined && String(r[id]).trim() !== '');
    if (hasValues && !window.confirm('Xóa cột này và toàn bộ giá trị trong cột?')) return;
    const nextRows = rows.map((r) => {
      const copy = { ...r };
      delete copy[id];
      return copy;
    });
    onSeriesChange(series.filter((s) => s.id !== id), nextRows);
  }

  // Dán từ Excel/Sheets: tab phân cột, xuống dòng phân dòng, bắt đầu từ ô (i, j).
  // - Dán ở bất kỳ ô nào: ô dữ liệu, ô tên chuỗi (tiêu đề cột), hoặc chỗ trống ngoài bảng.
  // - Dòng đầu là tiêu đề thì được nhận làm tên chuỗi (bảng ngang) hoặc bỏ qua (bảng cố định cột).
  // - Bảng ngang: vùng dán rộng hơn bảng thì tự thêm chuỗi.
  function applyPaste(text, i, j, fromHeader = false) {
    const lines = text.replace(/\r/g, '').split('\n').map((l) => l.split('\t').map((v) => v.trim()));
    while (lines.length && lines[lines.length - 1].every((v) => v === '')) lines.pop();
    if (!lines.length) return;

    const looksNum = (v) => /\d/.test(v) && /^[-+]?[\d.,\s]+%?$/.test(v);
    const isYear = (v) => /^(19|20)\d{2}$/.test(v);
    const first = lines[0];
    const second = lines[1];
    let hasHeader = false;
    if (i === 0) {
      if (fromHeader) hasHeader = lines.length > 1 || !first.some(looksNum);
      else if (second) {
        const allText = first.every((v) => !looksNum(v));
        const yearRow = wide && ['barRace', 'lineRank'].includes(spec.id) && first.length > 1 &&
          first.slice(1).every(isYear) && !second.slice(1).every(isYear);
        hasHeader = (allText && second.some(looksNum)) || yearRow;
      }
      if (fromHeader && lines.length === 1 && first.some(looksNum)) hasHeader = false;
    }
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const columns = spec.columns;
    const width = Math.max(...lines.map((l) => l.length));
    let nextSeries = series;
    let cols = columns.map((c) => c.key);
    let seriesChanged = false;

    // Bảng ngang: thêm chuỗi cho phần vùng dán nằm ngoài các cột hiện có
    if (wide && j + width > cols.length) {
      const added = [];
      for (let c = cols.length; c < j + width; c++) {
        const name = hasHeader && first[c - j] ? first[c - j] : `Chuỗi ${series.length + added.length + 1}`;
        added.push({ id: newSeriesId(), name, ...(KIND_CHARTS.includes(spec.id) ? { kind: 'bar' } : {}) });
      }
      nextSeries = [...series, ...added];
      cols = [...cols, ...added.map((s) => s.id)];
      seriesChanged = true;
    }

    // Tên chuỗi từ dòng tiêu đề (cột đầu là Danh mục, không đổi tên)
    if (wide && hasHeader) {
      nextSeries = nextSeries.map((s) => {
        const c = cols.indexOf(s.id);
        const v = c >= j && c - j < first.length ? first[c - j] : '';
        if (c < 1 || !v || v === s.name) return s;
        seriesChanged = true;
        return { ...s, name: v };
      });
    }

    const next = rows.map((r) => ({ ...r }));
    dataLines.forEach((line, k) => {
      const r = i + k;
      while (next.length <= r) next.push({});
      line.forEach((val, dj) => {
        const c = j + dj;
        if (c < cols.length) next[r][cols[c]] = val;
      });
    });

    if (seriesChanged) onSeriesChange(nextSeries, next);
    else onRowsChange(next);
  }

  function handlePaste(e, i, j, fromHeader = false) {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    applyPaste(text, i, j, fromHeader);
  }

  // Dán khi không đang chọn ô nào (ví dụ bảng đang trống): dán vào từ ô đầu tiên
  const pasteRef = useRef(null);
  pasteRef.current = applyPaste;
  useEffect(() => {
    function onDocPaste(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const text = e.clipboardData && e.clipboardData.getData('text');
      if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
      e.preventDefault();
      pasteRef.current(text, 0, 0);
    }
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, []);

  // Nhập tự động: AI nhận diện cột danh mục và cột chuỗi từ tiêu đề và dữ liệu mẫu
  async function importAuto() {
    if (!window.excelApi) {
      setMessage('Chức năng này chỉ hoạt động trong app desktop.');
      return;
    }
    if (rows.length && !window.confirm('Nhập file sẽ thay thế toàn bộ cột và dữ liệu hiện tại. Tiếp tục?')) return;
    setBusy(true);
    setMessage('Đang phân tích file Excel...');
    try {
      const res = await window.excelApi.analyze({ id: spec.id, label: spec.label, desc: CHART_GUIDE[spec.id] ?? '' });
      if (res.cancelled) {
        setMessage('Đã hủy nhập.');
        return;
      }
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      const { category, series: seriesCols, kinds } = res.mapping;

      // Loại một cột giá trị (Cột đơn, Thanh ngang, Tròn): danh mục + giá trị
      if (!wide) {
        const valueCol = seriesCols[0];
        const newRows = res.rows.map((r) => ({
          category: category === null ? '' : (r[category] ?? ''),
          value: valueCol === undefined ? '' : (r[valueCol] ?? ''),
        }));
        onRowsChange(newRows);
        const catName = category === null ? 'không có' : res.header[category];
        const valName = valueCol === undefined ? 'không có' : res.header[valueCol];
        const parts = [
          `Đã nhập ${newRows.length} dòng. Cột danh mục: ${catName}. Cột giá trị: ${valName}.`,
          `(${res.source === 'ai' ? 'AI' : 'tự động'} nhận diện)`,
        ];
        if (res.note) parts.push(`Ghi chú: ${res.note}`);
        setMessage(parts.join(' '));
        return;
      }
      const newSeries = seriesCols.map((ci) => ({
        id: newSeriesId(),
        name: res.header[ci],
        ...(KIND_CHARTS.includes(spec.id) ? { kind: kinds[ci] ?? 'bar' } : {}),
        pct: (res.percent ?? []).includes(ci),
      }));
      const idOf = {};
      seriesCols.forEach((ci, k) => { idOf[ci] = newSeries[k].id; });
      const newRows = res.rows.map((r) => {
        const obj = { category: category === null ? '' : (r[category] ?? '') };
        seriesCols.forEach((ci) => { obj[idOf[ci]] = r[ci] ?? ''; });
        if (res.mapping.meta) {
          const m = res.mapping.meta;
          if (m.region != null) obj.region = r[m.region] ?? '';
          if (m.flag != null) obj.flag = r[m.flag] ?? '';
        }
        return obj;
      });
      onSeriesChange(newSeries, newRows);
      const catName = category === null ? 'không có' : res.header[category];
      const parts = [
        `Đã nhập ${newRows.length} dòng, ${newSeries.length} chuỗi: ${newSeries.map((s) => s.name).join(', ')}.`,
        `Cột mốc/danh mục: ${catName}. (${res.source === 'ai' ? 'AI' : 'tự động'} nhận diện)`,
      ];
      if (res.note) parts.push(`Ghi chú: ${res.note}`);
      setMessage(parts.join(' '));
    } catch (e) {
      setMessage(`Nhập thất bại: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function importExcel() {
    if (!window.excelApi) {
      setMessage('Chức năng này chỉ hoạt động trong app desktop.');
      return;
    }
    if (rows.length && !window.confirm('Nhập file sẽ thay thế dữ liệu hiện tại. Tiếp tục?')) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await window.excelApi.importFile(spec);
      if (!res.ok) {
        setMessage('Đã hủy nhập.');
      } else if (res.error) {
        setMessage(res.error);
      } else {
        onRowsChange(res.rows);
        const note = res.skippedSamples ? ` (bỏ qua ${res.skippedSamples} dòng ví dụ)` : '';
        setMessage(`Đã nhập ${res.rows.length} dòng${note}.`);
      }
    } catch (e) {
      setMessage(`Nhập thất bại: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const extraCols = wide ? 3 : 2;

  return (
    <div>
      <div className="toolbar">
        <label className="check-field logo-toggle">
          <input type="checkbox" checked={!!(settings && settings.useLogo)} disabled={busy || !onSettingsChange}
            onChange={(e) => toggleLogo(e.target.checked)} />
          <span>Dùng Logo</span>
        </label>
        <button onClick={addRow}>+ Thêm dòng</button>
        <button onClick={clearAll}>Xóa hết</button>
        <button onClick={stripSeparators} disabled={busy || rows.length === 0}>Bỏ dấu . và ,</button>
        <button onClick={wide || ['pie', 'bar', 'rankBar'].includes(spec.id) ? importAuto : importExcel} disabled={busy}>Nhập từ file Excel</button>
      </div>

      <p className="hint">
        {wide
          ? 'Mỗi cột sau "Danh mục" là một chuỗi so sánh. Copy cả bảng từ Excel/Google Sheets (kèm dòng tiêu đề) rồi dán (Ctrl+V) vào bất kỳ ô nào: tên cột và số cột tự cập nhật. Cũng có thể bấm "+ Thêm cột" và sửa tên trên tiêu đề cột.'
          : 'Nhập trực tiếp vào bảng, hoặc copy vùng dữ liệu từ Excel/Google Sheets (có thể kèm dòng tiêu đề) rồi dán (Ctrl+V) vào bất kỳ ô nào.'}
        {' '}Số thập phân dùng dấu chấm hoặc dấu phẩy. Cột có dấu * là bắt buộc.
      </p>

      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th className="row-num">#</th>
              {spec.columns.map((c, j) => {
                if (!wide || j === 0 || c.type === 'text') {
                  return <th key={c.key}>{c.label}{c.required ? ' *' : ''}</th>;
                }
                const s = series.find((x) => x.id === c.key);
                return (
                  <th key={c.key} className="series-th">
                    <div className="series-head">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => renameSeries(s.id, e.target.value)}
                        onPaste={(e) => handlePaste(e, 0, j, true)}
                      />
                      {['groupedBar', 'combo', 'stackedBar'].includes(spec.id) && (
                        <select value={s.kind ?? 'bar'} onChange={(e) => changeKind(s.id, e.target.value)}>
                          <option value="bar">Cột</option>
                          <option value="line">Đường</option>
                        </select>
                      )}
                      {['combo', 'barRace', 'lineRank'].includes(spec.id) && (
                        <select value={s.pct ? 'pct' : 'num'} onChange={(e) => changePct(s.id, e.target.value === 'pct')}>
                          <option value="num">Số</option>
                          <option value="pct">%</option>
                        </select>
                      )}
                      <button className="row-del" title="Xóa cột" onClick={() => removeSeries(s.id)}>×</button>
                    </div>
                  </th>
                );
              })}
              {wide && (
                <th>
                  <button className="add-col" onClick={addSeries}>+ Thêm cột</button>
                </th>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={spec.columns.length + extraCols} className="empty">
                  Chưa có dòng nào. Bấm "+ Thêm dòng" hoặc dán dữ liệu từ Excel (Ctrl+V) ở bất kỳ đâu trong trang này.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="row-num">{i + 1}</td>
                {spec.columns.map((c, j) => {
                  const err = errorAt(i, c.key);
                  return (
                    <td key={c.key} className={err ? (err.level === 'error' ? 'has-error' : 'has-warn') : ''} title={err ? err.message : ''}>
                      <input
                        type="text"
                        value={r[c.key] ?? ''}
                        onChange={(e) => setCell(i, c.key, e.target.value)}
                        onPaste={(e) => handlePaste(e, i, j)}
                      />
                    </td>
                  );
                })}
                {wide && <td></td>}
                <td>
                  <button className="row-del" onClick={() => removeRow(i)} title="Xóa dòng">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length === 0 ? (
        <p className="ok-msg">Dữ liệu hợp lệ.</p>
      ) : (
        <div className={errors.some((e) => e.level === 'error') ? 'error-box' : 'warn-box'}>
          <b>{errors.length} điểm cần lưu ý:</b>
          <ul>
            {errors.slice(0, 30).map((e, k) => (
              <li key={k}>{e.row >= 0 ? `Dòng ${e.row + 1}: ` : ''}{e.message}</li>
            ))}
          </ul>
          {errors.length > 30 && <p>Và {errors.length - 30} lỗi khác.</p>}
        </div>
      )}

      {message && <p className="status-inline">{message}</p>}
    </div>
  );
}
