import { useEffect, useRef, useState } from 'react';
import { normalizeHex, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from '../lib/color.js';

const HUE_GRADIENT = 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';

// Kéo chuột/bút trong một vùng, trả về tọa độ 0–1
function startDrag(e, onMove) {
  const rect = e.currentTarget.getBoundingClientRect();
  const apply = (ev) => {
    const fx = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    const fy = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
    onMove(fx, fy);
  };
  apply(e);
  const up = () => {
    window.removeEventListener('pointermove', apply);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', apply);
  window.addEventListener('pointerup', up);
}

// value: { start, end, gradient }. Gradient đi từ dưới (start) lên trên (end)
export default function ColorPicker({ value, onChange, presets, wide = false }) {
  const [target, setTarget] = useState('start');
  const current = target === 'end' && value.gradient ? value.end : value.start;
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(current)));
  const [hexText, setHexText] = useState(current);
  const nativeRef = useRef(null);
  const nativeFor = useRef('start');

  useEffect(() => {
    setHexText(current);
    if (rgbToHex(hsvToRgb(hsv)) !== current) setHsv(rgbToHsv(hexToRgb(current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function setColor(hex) {
    const next = target === 'end' ? { ...value, end: hex } : { ...value, start: hex };
    if (!next.gradient) next.end = next.start;
    onChange(next);
  }

  function setSV(fx, fy) {
    const next = { h: hsv.h, s: fx, v: 1 - fy };
    setHsv(next);
    setColor(rgbToHex(hsvToRgb(next)));
  }

  function setHue(fx) {
    const next = { ...hsv, h: fx * 360 };
    setHsv(next);
    setColor(rgbToHex(hsvToRgb(next)));
  }

  function commitHex() {
    const hex = normalizeHex(hexText);
    if (hex) setColor(hex);
    else setHexText(current);
  }

  function toggleGradient(on) {
    const next = { ...value, gradient: on };
    if (on) {
      next.end = value.end && value.end !== value.start ? value.end : '#3B1B70';
      setTarget('start');
    } else {
      next.end = value.start;
    }
    onChange(next);
  }

  // Bấm đúp vào chấm màu: mở bảng chọn màu của hệ thống cho đúng điểm đó
  function openNative(which) {
    nativeFor.current = which;
    setTarget(which);
    const el = nativeRef.current;
    if (!el) return;
    el.value = which === 'end' ? value.end : value.start;
    el.click();
  }

  function onNative(hex) {
    const h = normalizeHex(hex);
    if (!h) return;
    const next = nativeFor.current === 'end' ? { ...value, end: h } : { ...value, start: h };
    if (!next.gradient) next.end = next.start;
    onChange(next);
  }

  async function pickScreen() {
    try {
      const r = await new window.EyeDropper().open();
      const hex = normalizeHex(r.sRGBHex);
      if (hex) setColor(hex);
    } catch (e) {
      // Người dùng hủy chọn, không cần báo lỗi
    }
  }

  const baseHue = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  return (
    <div className={wide ? 'picker wide' : 'picker'}>
      <div className="picker-col">
        <div className="gbar-wrap">
          <div className="gbar" style={{ background: value.gradient ? `linear-gradient(to right, ${value.start}, ${value.end})` : value.start }} />
          <button type="button" className={target === 'start' || !value.gradient ? 'gstop on' : 'gstop'} style={{ left: '0%', background: value.start }}
            title="Bấm để chọn điểm màu này, bấm đúp để mở bảng màu"
            onClick={() => setTarget('start')} onDoubleClick={() => openNative('start')} />
          {value.gradient && (
            <button type="button" className={target === 'end' ? 'gstop on' : 'gstop'} style={{ left: '100%', background: value.end }}
              title="Bấm để chọn điểm màu này, bấm đúp để mở bảng màu"
              onClick={() => setTarget('end')} onDoubleClick={() => openNative('end')} />
          )}
          <input ref={nativeRef} type="color" className="native-color" tabIndex={-1} aria-hidden="true"
            onChange={(e) => onNative(e.target.value)} />
        </div>
        <div
          className="sv"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${baseHue})` }}
          onPointerDown={(e) => startDrag(e, setSV)}
        >
          <div className="sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }} />
        </div>

        <div className="hue" style={{ background: HUE_GRADIENT }} onPointerDown={(e) => startDrag(e, (fx) => setHue(fx))}>
          <div className="hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
        </div>

        <div className="picker-row">
          <span className="big-swatch" style={{ background: current }} />
          <input
            className="hex"
            value={hexText}
            onChange={(e) => setHexText(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
          />
          {window.EyeDropper && (
            <button className="eyedrop" onClick={pickScreen}>Lấy màu từ màn hình</button>
          )}
        </div>
      </div>

      <div className="picker-col">
        <label className="check-field">
          <input type="checkbox" checked={!!value.gradient} onChange={(e) => toggleGradient(e.target.checked)} />
          <span>Dùng gradient (chọn từng điểm màu ở thanh phía trên)</span>
        </label>

        <div className="presets">
          {presets.map((p) => (
            <button key={p} className="preset" style={{ background: p }} title={p} onClick={() => setColor(p)} />
          ))}
        </div>
      </div>
    </div>
  );
}
