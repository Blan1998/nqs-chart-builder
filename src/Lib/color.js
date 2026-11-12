import common from '../specs/common.json';

// Bảng màu gợi ý: màu chính trước, sau đó là bảng màu chuẩn
export const PRESETS = [
  common.mainColor.start,
  common.mainColor.end,
  ...common.palette.map((p) => p.color),
];

export function normalizeHex(v) {
  const s = String(v ?? '').trim().toUpperCase();
  const h = s.startsWith('#') ? s : `#${s}`;
  return /^#[0-9A-F]{6}$/.test(h) ? h : null;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// Gradient có sẵn: start là màu phía dưới, end là màu phía trên
// Gradient đầu tiên là màu chính của app (Tím - Lavender)
export const GRADIENT_PRESETS = [
  { name: 'Tím - Lavender', start: common.mainColor.start.toUpperCase(), end: common.mainColor.end.toUpperCase() },
  { name: 'Cam - Tím', start: '#FF6201', end: '#3B1B70' },
  { name: 'Hồng - Tím', start: '#EC4899', end: '#4C1D95' },
  { name: 'Xanh - Cyan', start: '#3B82F6', end: '#06B6D4' },
  { name: 'Xanh lá - Teal', start: '#14B8A6', end: '#22C55E' },
];
