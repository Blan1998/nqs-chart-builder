// Lấy màu thương hiệu (màu nổi bật nhất) từ ảnh logo dạng data URI.
// Bỏ qua pixel trong suốt, trắng, đen và xám; gom các pixel có sắc độ gần nhau rồi lấy màu trung bình của nhóm lớn nhất.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh logo'));
    img.src = src;
  });
}

function rgbToHsv(r, g, b) {
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

const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');

export async function dominantColor(src) {
  const img = await loadImage(src);
  const w = Math.min(160, img.naturalWidth || 160);
  const h = Math.max(1, Math.round(w * (img.naturalHeight / (img.naturalWidth || 1))));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const BINS = 24;
  const bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let grayScore = 0;
  let gray = { r: 0, g: 0, b: 0, n: 0 };
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { h: hue, s, v } = rgbToHsv(r, g, b);
    if (v > 0.93 && s < 0.12) continue; // nền trắng
    if (s < 0.22 || v < 0.18) {
      // chữ đen / xám: chỉ dùng khi logo không có màu nào khác
      gray = { r: gray.r + r, g: gray.g + g, b: gray.b + b, n: gray.n + 1 };
      grayScore++;
      continue;
    }
    const k = Math.min(BINS - 1, Math.floor(hue / (360 / BINS)));
    const wt = 0.5 + s;
    bins[k].w += wt;
    bins[k].r += r * wt;
    bins[k].g += g * wt;
    bins[k].b += b * wt;
  }
  let best = null;
  for (const bin of bins) if (bin.w > 0 && (!best || bin.w > best.w)) best = bin;
  if (best) return '#' + toHex(best.r / best.w) + toHex(best.g / best.w) + toHex(best.b / best.w);
  if (grayScore > 0) return '#' + toHex(gray.r / gray.n) + toHex(gray.g / gray.n) + toHex(gray.b / gray.n);
  return null;
}

// logos: { tênDanhMục: dataUri } -> { tênDanhMục: '#RRGGBB' }
export async function brandColorsOf(logos) {
  const out = {};
  await Promise.all(
    Object.entries(logos).map(async ([name, src]) => {
      try {
        const c = await dominantColor(src);
        if (c) out[name] = c.toUpperCase();
      } catch (e) {
        // bỏ qua logo không đọc được
      }
    })
  );
  return out;
}
