import { useEffect, useMemo, useState } from 'react';
import { buildSvgDocument, colorTargets, slugify, nqsUrl, embedCode } from '../lib/svgBuilder.js';
import { PRESETS, GRADIENT_PRESETS, hexToRgb, rgbToHex, normalizeHex } from '../lib/color.js';
import ColorPicker from './ColorPicker.jsx';
import { normalizeKey } from '../lib/logo.js';
import { brandColorsOf } from '../lib/logoColor.js';

// Mã giờ-phút-giây và 4 ký tự ngẫu nhiên: hai người xuất cùng lúc vẫn không trùng tên
function makeUniqueCode() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`;
}

function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Bước 5: xem trước bên trái, màu sắc bên phải; bên dưới là màu chữ, cỡ chữ và xuất file
export default function SvgStep({ spec, settings, options, rows, errors, colors, onColorsChange, onSettingsChange, onOptionChange }) {
  const [date, setDate] = useState(todayIso);
  const [fileName, setFileName] = useState(`bieu-do-${spec.id}`);
  const [message, setMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [author, setAuthor] = useState('');
  const [useUnique, setUseUnique] = useState(true);
  const [uniqueCode, setUniqueCode] = useState(makeUniqueCode);

  const valid = !errors.some((e) => e.level === 'error');
  const [logos, setLogos] = useState({});

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!settings.useLogo || !window.logoApi) {
        setLogos({});
        return;
      }
      const cats = [...new Set(rows.map((r) => String(r.category ?? '').trim()).filter(Boolean))];
      const keyOf = (c) => (settings.logoAliases && settings.logoAliases[c]) || normalizeKey(c);
      const found = await window.logoApi.resolve(cats.map(keyOf));
      const out = {};
      cats.forEach((c) => { if (found[keyOf(c)]) out[c] = found[keyOf(c)]; });
      if (alive) setLogos(out);
    }
    load().catch(() => alive && setLogos({}));
    return () => { alive = false; };
  }, [settings.useLogo, settings.logoAliases, rows]);
  // Màu thương hiệu của từng logo (màu nổi bật nhất trong ảnh), tính khi logo thay đổi
  const [brand, setBrand] = useState({});
  useEffect(() => {
    let alive = true;
    if (!Object.keys(logos).length) {
      setBrand({});
      return undefined;
    }
    brandColorsOf(logos).then((b) => alive && setBrand(b)).catch(() => alive && setBrand({}));
    return () => { alive = false; };
  }, [logos]);
  const brandCount = Object.keys(brand).length;

  const targets = useMemo(() => colorTargets(spec, rows), [spec, rows]);
  const svg = useMemo(
    () => (valid ? buildSvgDocument(spec, settings, options, rows, colors, logos, brand) : ''),
    [valid, spec, settings, options, rows, colors, logos, brand]
  );

  if (!valid) {
    return <p>Cần nhập dữ liệu ở bước 4 trước khi tạo SVG.</p>;
  }

  const active = targets.find((t) => t.key === selectedKey) ?? targets[0];
  const defaultOf = (t) => {
    const end = t.fallbackEnd ?? t.fallback;
    return { start: t.fallback, end, gradient: end !== t.fallback };
  };
  const current = active ? colors[active.key] ?? defaultOf(active) : null;

  const baseSlug = slugify(fileName) || `bieu-do-${spec.id}`;
  const authorPart = slugify(author);
  const slug = [baseSlug, authorPart, useUnique ? uniqueCode : ''].filter(Boolean).join('-');
  const url = nqsUrl(date, slug);
  const embed = embedCode(url);
  const previewDoc = `<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`;

  function setColorFor(key, next) {
    onColorsChange({ ...colors, [key]: next });
  }

  function applyPreset(p) {
    if (!active) return;
    setColorFor(active.key, { start: p.start, end: p.end, gradient: true, dir: colors[active.key]?.dir });
  }

  async function saveSvg() {
    if (!window.svgApi) {
      setMessage('Chức năng này chỉ hoạt động trong app desktop.');
      return;
    }
    try {
      const res = await window.svgApi.save(svg, `${slug}.svg`);
      setMessage(res.ok ? `Đã lưu: ${res.filePath}` : 'Đã hủy lưu.');
    } catch (e) {
      setMessage(`Lưu thất bại: ${e.message}`);
    }
  }

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embed);
      setMessage('Đã sao chép mã nhúng.');
    } catch (e) {
      setMessage('Không sao chép được. Hãy chọn và copy thủ công ô bên dưới.');
    }
  }

  return (
    <div>
      <div className="preview-block">
        <h3 className="section-title">Xem trước</h3>
        <div className="svg-preview">
          <iframe
            title="Xem trước biểu đồ"
            sandbox="allow-scripts"
            srcDoc={previewDoc}
            style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
          />
        </div>
        <p className="hint">Rê chuột để xem tooltip, bấm chú giải để bật/tắt chuỗi.</p>
      </div>

      <div className="box">
        <h3 className="section-title">Màu sắc danh mục / chuỗi</h3>
        <div className="brand-box">
          <label className="check-field">
            <input
              type="checkbox"
              checked={!!(settings.useLogo && settings.useBrandColor)}
              disabled={!settings.useLogo || brandCount === 0}
              onChange={(e) => onSettingsChange({ ...settings, useBrandColor: e.target.checked })}
            />
            <span>Dùng màu thương hiệu của logo</span>
          </label>
          <p className="hint">
            {!settings.useLogo
              ? 'Bật "Dùng Logo" ở bước 4 để dùng tùy chọn này.'
              : brandCount === 0
                ? 'Chưa tìm thấy logo nào khớp với danh mục.'
                : settings.useBrandColor
                  ? `Mỗi cột lấy màu từ logo của danh mục (${brandCount} logo). Chuỗi thứ 2, 3 nhạt dần; chuỗi dạng đường giữ màu riêng. Mục nào tự chọn màu bên dưới thì giữ màu đã chọn.`
                  : 'Tick để mỗi cột lấy màu từ logo của danh mục.'}
          </p>
        </div>
        <div className="chip-row">
          {targets.map((t) => {
            const c = colors[t.key] ?? defaultOf(t);
            const bg = c.gradient ? `linear-gradient(to top, ${c.start}, ${c.end})` : c.start;
            return (
              <button
                key={t.key}
                className={active && t.key === active.key ? 'target selected' : 'target'}
                onClick={() => setSelectedKey(t.key)}
              >
                <span className="swatch" style={{ background: bg }} />
                <span>{t.name}</span>
              </button>
            );
          })}
        </div>
        <div className="box-actions">
          <button className="reset-btn" onClick={() => onColorsChange({})}>Đặt lại màu mặc định</button>
        </div>
        {spec.options.some((o) => o.key === 'lineWidth') && (
          <LineStyleControls options={options} onChange={onOptionChange} />
        )}
        <p className="sub-title">Gradient có sẵn</p>
        <div className="grad-grid">
          {GRADIENT_PRESETS.map((p) => (
            <button
              key={p.name}
              className="grad-card"
              title={`${p.name}: bấm để áp cho mục đang chọn`}
              onClick={() => applyPreset(p)}
            >
              <span className="grad-bar" style={{ background: `linear-gradient(to top, ${p.start}, ${p.end})` }} />
              <span className="grad-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="color-boxes">
        <div className="box">
          <h3 className="section-title">Bảng chọn màu</h3>
          {current && (
            <ColorPicker wide={false} value={current} presets={PRESETS} onChange={(next) => setColorFor(active.key, next)} />
          )}
        </div>

        <div className="box">
          <h3 className="section-title">Màu số liệu</h3>
          <HexRow
            label="Tiêu đề, nhãn trục và số liệu bên ngoài"
            value={settings.textColor || settings.titleColor}
            fallback="#334155"
            resetLabel="Mặc định"
            onColor={(v) => onSettingsChange({ ...settings, textColor: v, titleColor: v })}
          />
          <HexRow
            label="Số liệu bên trong cột/khúc"
            value={settings.insideColor}
            fallback="#FFFFFF"
            resetLabel="Tự động"
            onColor={(v) => onSettingsChange({ ...settings, insideColor: v })}
          />
          {spec.options.some((o) => o.key === 'lineWidth') && (
            <HexRow
              label="Số liệu trên đường (Line, Kết hợp)"
              value={settings.lineLabelColor}
              fallback="#334155"
              resetLabel="Mặc định"
              onColor={(v) => onSettingsChange({ ...settings, lineLabelColor: v })}
            />
          )}
          {spec.options.some((o) => o.key === 'labelInside') && (
            <label className="check-field">
              <input type="checkbox" checked={!!options.labelInside}
                onChange={(e) => onOptionChange('labelInside', e.target.checked)} />
              <span>Số liệu nằm trong cột (tự đổi màu theo nền)</span>
            </label>
          )}
        </div>
      </div>

      <h3 className="section-title">Cỡ chữ</h3>
      <div className="size-row">
        <SizeField label="Tiêu đề" value={settings.titleSize} fallback={26}
          onSize={(v) => onSettingsChange({ ...settings, titleSize: v })} />
        <SizeField label="Nhãn trục" value={settings.labelSize} fallback={14}
          onSize={(v) => onSettingsChange({ ...settings, labelSize: v })} />
        <SizeField label="Số liệu" value={settings.dataSize} fallback={15}
          onSize={(v) => onSettingsChange({ ...settings, dataSize: v })} />
      </div>

      <h3 className="section-title">Xuất file</h3>
      <div className="options-grid">
        <Field label="Tên file SVG">
          <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </Field>
        <Field label="Mã người làm (tùy chọn, ví dụ: tuan)">
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label="Ngày tải lên (theo cấu trúc nqs.1cdn.vn)">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="unique-row">
        <label className="check-field">
          <input type="checkbox" checked={useUnique} onChange={(e) => setUseUnique(e.target.checked)} />
          <span>Thêm mã duy nhất vào tên file (tránh trùng khi nhiều người cùng dùng)</span>
        </label>
        <button type="button" className="reset-mini" onClick={() => setUniqueCode(makeUniqueCode())}>
          Tạo mã mới
        </button>
      </div>
      <p className="url-line">Đường dẫn: <code>{url}</code></p>
      <div className="actions">
        <button onClick={saveSvg}>Xuất file SVG</button>
        <button onClick={copyEmbed}>Sao chép mã nhúng</button>
      </div>
      <h3 className="section-title">Mã nhúng</h3>
      <textarea readOnly value={embed} rows={2} className="embed-box" />
      {message && <p className="status-inline">{message}</p>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

// Một dòng chọn màu: RGB, HEX, Mặc định
function ColorRow({ label, value, fallback, onColor, resetLabel = 'Mặc định' }) {
  const hex = value || fallback;
  const rgb = hexToRgb(hex);
  const [draft, setDraft] = useState(null);
  const [hexDraft, setHexDraft] = useState(null);

  const shown = (k) => (draft ? draft[k] : String(rgb[k]));

  function editChannel(k, v) {
    setDraft({ r: shown('r'), g: shown('g'), b: shown('b'), [k]: v });
  }

  function commitChannels() {
    if (draft) {
      const n = {};
      ['r', 'g', 'b'].forEach((k) => {
        n[k] = Math.min(255, Math.max(0, Math.round(Number(draft[k]) || 0)));
      });
      onColor(rgbToHex(n));
    }
    setDraft(null);
  }

  function commitHex() {
    if (hexDraft !== null) {
      const h = normalizeHex(hexDraft);
      if (h) onColor(h);
    }
    setHexDraft(null);
  }

  return (
    <tr>
      <td className="text-name">{label}</td>
      <td>
        <div className="rgb-row">
          <input type="color" className="swatch-input" value={hex} onChange={(e) => onColor(e.target.value)} />
          {[['r', 'R'], ['g', 'G'], ['b', 'B']].map(([key, name]) => (
            <label key={key} className="rgb-cell">
              <span>{name}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={shown(key)}
                onChange={(e) => editChannel(key, e.target.value)}
                onBlur={commitChannels}
                onKeyDown={(e) => { if (e.key === 'Enter') commitChannels(); }}
              />
            </label>
          ))}
          <input
            className="hex-small"
            value={hexDraft ?? hex}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
          />
          <button type="button" className="reset-mini" onClick={() => onColor(null)} disabled={!value}>
            {resetLabel}
          </button>
        </div>
      </td>
    </tr>
  );
}

// Một dòng chọn cỡ chữ (8–48 px)
function SizeRow({ label, value, fallback, onSize }) {
  const [draft, setDraft] = useState(null);

  function commit() {
    if (draft !== null) {
      onSize(Math.min(48, Math.max(8, Math.round(Number(draft) || fallback))));
    }
    setDraft(null);
  }

  return (
    <tr>
      <td className="text-name">{label}</td>
      <td>
        <input
          type="number"
          className="size-input"
          min={8}
          max={48}
          value={draft ?? (value ?? fallback)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
      </td>
    </tr>
  );
}

const SHAPES = [
  { key: 'circle', label: 'Tròn', icon: <circle cx="12" cy="12" r="5" /> },
  { key: 'square', label: 'Vuông', icon: <rect x="7" y="7" width="10" height="10" /> },
  { key: 'diamond', label: 'Thoi', icon: <polygon points="12,5 19,12 12,19 5,12" /> },
  { key: 'triangle', label: 'Tam giác', icon: <polygon points="12,5 19,18 5,18" /> },
  { key: 'star', label: 'Ngôi sao', icon: <polygon points="12,3 14.6,9.1 21.2,9.6 16.2,13.9 17.8,20.3 12,16.9 6.2,20.3 7.8,13.9 2.8,9.6 9.4,9.1" /> },
];

// Độ đậm đường, kiểu và kích cỡ điểm đánh dấu (cho biểu đồ Line và Kết hợp)
function LineStyleControls({ options, onChange }) {
  const width = options.lineWidth ?? 2.5;
  const shape = options.markerShape ?? 'circle';
  const size = options.markerSize ?? 4;
  return (
    <div className="line-style">
      <p className="sub-title">Đường và điểm đánh dấu</p>
      <label className="ls-row">
        <span>Độ đậm đường: <b>{width}</b></span>
        <input type="range" min={0.5} max={10} step={0.5} value={width}
          onChange={(e) => onChange('lineWidth', Number(e.target.value))} />
      </label>
      <div className="ls-shapes">
        {SHAPES.map((sh) => (
          <button key={sh.key} type="button" title={sh.label}
            className={shape === sh.key ? 'shape-btn on' : 'shape-btn'}
            onClick={() => onChange('markerShape', sh.key)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">{sh.icon}</svg>
          </button>
        ))}
      </div>
      <label className="ls-row">
        <span>Kích cỡ điểm: <b>{size}</b></span>
        <input type="range" min={0} max={14} step={1} value={size}
          onChange={(e) => onChange('markerSize', Number(e.target.value))} />
      </label>
    </div>
  );
}

// Một ô cỡ chữ trong hàng ngang
function SizeField({ label, value, fallback, onSize }) {
  const [draft, setDraft] = useState(null);

  function commit() {
    if (draft !== null) {
      onSize(Math.min(48, Math.max(8, Math.round(Number(draft) || fallback))));
    }
    setDraft(null);
  }

  return (
    <div className="size-field">
      <label>{label}</label>
      <input
        type="number"
        className="size-input"
        min={8}
        max={48}
        value={draft ?? (value ?? fallback)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      />
    </div>
  );
}

// Một dòng màu số liệu: ô màu và mã HEX dạng #123456
function HexRow({ label, value, fallback, resetLabel, onColor }) {
  const hex = (value || fallback).toUpperCase();
  const [draft, setDraft] = useState(null);

  function commit() {
    if (draft !== null) {
      const h = normalizeHex(draft);
      if (h) onColor(h);
    }
    setDraft(null);
  }

  return (
    <div className="hex-row">
      <span className="hex-label">{label}</span>
      <div className="hex-controls">
        <input type="color" className="swatch-input" value={hex} onChange={(e) => onColor(e.target.value)} />
        <input
          className="hex-input"
          value={draft ?? hex}
          placeholder="#123456"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        />
        <button type="button" className="reset-mini" onClick={() => onColor(null)} disabled={!value}>
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
