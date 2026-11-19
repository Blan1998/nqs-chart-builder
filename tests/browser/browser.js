// Mở biểu đồ trong trình duyệt thật (Edge hoặc Chrome đã cài sẵn) để đo kích thước chữ, khoảng cách, tương tác.
// Không có trình duyệt thì các bài kiểm tra trong thư mục này tự bỏ qua.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildSvgDocument } from '../../src/Lib/svgBuilder.js';

const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export const browserPath = process.env.CHART_BROWSER || CANDIDATES.find((p) => fs.existsSync(p)) || null;

export async function launch() {
  return chromium.launch({ executablePath: browserPath, headless: true });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nqs-chart-'));
let counter = 0;

// Dựng file SVG từ dữ liệu rồi mở trong một trang; viewport mặc định bằng kích thước biểu đồ
export async function openChart(browser, built, { viewport, wait = 400 } = {}) {
  const svg = buildSvgDocument(built.spec, built.settings, built.options, built.rows, built.colors || {}, {}, {});
  const file = path.join(tmp, `chart-${++counter}.svg`);
  fs.writeFileSync(file, svg, 'utf8');
  const W = Number(built.settings.width);
  const H = Number(built.settings.height);
  const ctx = await browser.newContext({ viewport: viewport || { width: W, height: H } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///' + file.replace(/\\/g, '/'));
  await page.waitForTimeout(wait);
  return { page, ctx, errors, W, H, close: () => ctx.close() };
}

// Hộp bao (theo toạ độ của biểu đồ gốc) của mọi chữ đang hiện: [{ text, x0, y0, x1, y1, size }]
export function readTexts(page) {
  return page.evaluate(() => {
    const svg = document.documentElement;
    const vb = svg.viewBox.baseVal;
    const r0 = svg.getBoundingClientRect();
    const sx = vb.width / r0.width;
    const sy = vb.height / r0.height;
    const out = [];
    svg.querySelectorAll('text').forEach((t) => {
      if (t.closest('#tip')) return;
      const txt = (t.textContent || '').trim();
      if (!txt) return;
      const r = t.getBoundingClientRect();
      const size = parseFloat(t.getAttribute('font-size')) || 0;
      const top = (r.top - r0.top) * sy;
      const bottom = (r.bottom - r0.top) * sy;
      // Khung dòng chữ có khoảng thừa phía trên và dưới; chỉ lấy phần thân chữ (khoảng 0,8 cỡ chữ quanh tâm dòng)
      const mid = (top + bottom) / 2;
      const half = size ? size * 0.4 : (bottom - top) / 2;
      out.push({
        text: txt,
        x0: (r.left - r0.left) * sx,
        y0: mid - half,
        x1: (r.right - r0.left) * sx,
        y1: mid + half,
        size,
        bold: t.getAttribute('font-weight') === 'bold',
      });
    });
    return out;
  });
}

// Các cặp chữ chồng lên nhau (tolerance px)
export function overlaps(boxes, tol = 1) {
  const bad = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w > tol && h > tol) bad.push(`"${a.text}" đè "${b.text}"`);
    }
  }
  return bad;
}
