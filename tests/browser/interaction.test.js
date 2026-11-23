// Kiểm tra tương tác trên trình duyệt thật: rê chuột, chú giải, cỡ chữ trên điện thoại, hiệu ứng cột mọc lên
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { browserPath, launch, openChart, readTexts } from './browser.js';
import { buildSample } from '../helpers.js';

const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

describe.skipIf(!browserPath)('Tương tác trên trình duyệt thật', () => {
  let browser;
  beforeAll(async () => { browser = await launch(); }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  it('rê chuột vào cột: chỉ cột đó sáng, các cột khác mờ đi', async () => {
    const c = await openChart(browser, buildSample('bar', { settings: { width: 900, height: 600 } }), { wait: 1800 });
    try {
      const rects = await c.page.evaluate(() => [...document.querySelectorAll('[data-bar]')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
      const p = center(rects[1]);
      await c.page.mouse.move(p.x, p.y);
      await c.page.waitForTimeout(150);
      const ops = await c.page.evaluate(() => [...document.querySelectorAll('[data-bar]')].map((b) => b.getAttribute('opacity')));
      expect(ops).toEqual(['0.3', '1', '0.3']);
      // rời khỏi biểu đồ thì sáng lại
      await c.page.mouse.move(1, 1);
      await c.page.waitForTimeout(150);
      const after = await c.page.evaluate(() => [...document.querySelectorAll('[data-bar]')].map((b) => b.getAttribute('opacity')));
      expect(after.every((o) => o === '1')).toBe(true);
    } finally { await c.close(); }
  }, 30000);

  it('kết hợp: tooltip hiện đủ hai chuỗi; cột và điểm đánh dấu cùng mốc cùng sáng', async () => {
    const c = await openChart(browser, buildSample('combo', { settings: { width: 900, height: 600 } }), { wait: 1800 });
    try {
      const rects = await c.page.evaluate(() => [...document.querySelectorAll('[data-bar]')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
      const p = center(rects[1]);
      await c.page.mouse.move(p.x, p.y);
      await c.page.waitForTimeout(150);
      const r = await c.page.evaluate(() => {
        const tip = document.getElementById('tip');
        return {
          visible: tip.getAttribute('visibility') === 'visible',
          lines: [...document.querySelectorAll('#tip-text tspan')].map((t) => t.textContent),
          lit: [...document.querySelectorAll('[data-ci]')].filter((e) => e.getAttribute('opacity') === '1').map((e) => e.getAttribute('data-ci')),
          dim: [...document.querySelectorAll('[data-ci]')].filter((e) => e.getAttribute('opacity') === '0.3').map((e) => e.getAttribute('data-ci')),
        };
      });
      expect(r.visible).toBe(true);
      expect(r.lines[0]).toBe('Q2');
      expect(r.lines.join('|')).toContain('Doanh thu:');
      expect(r.lines.join('|')).toContain('Lợi nhuận:');
      expect(r.lit.length).toBeGreaterThanOrEqual(2); // cột + điểm đánh dấu
      expect(new Set(r.lit)).toEqual(new Set(['1']));
      expect(r.dim.length).toBeGreaterThan(0);
    } finally { await c.close(); }
  }, 30000);

  it('bấm chú giải để ẩn một chuỗi', async () => {
    const c = await openChart(browser, buildSample('stackedBar', { settings: { width: 900, height: 600 } }), { wait: 1800 });
    try {
      const before = await c.page.evaluate(() => document.querySelectorAll('[data-bar], rect[data-g]').length);
      // bấm vào chữ của mục chú giải (không bấm vào khoảng trống giữa ô màu và chữ)
      const box = await c.page.evaluate(() => { const r = document.querySelector('[data-legend] text').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      const p = center(box);
      await c.page.mouse.click(p.x, p.y);
      await c.page.waitForTimeout(300);
      const after = await c.page.evaluate(() => document.querySelectorAll('rect[data-g], [data-bar]').length);
      expect(after).toBeLessThan(before);
    } finally { await c.close(); }
  }, 30000);

  it('điện thoại: chữ to hơn (tiêu đề 45, nhãn 22); máy tính giữ nguyên 35 và 16', async () => {
    const built = () => buildSample('bar', { table: [['Alpha', 5], ['Beta', 8]], settings: { title: 'Tiêu đề ngắn', width: 1000, height: 700 } });
    const desk = await openChart(browser, built());
    const mob = await openChart(browser, built(), { viewport: { width: 375, height: 800 } });
    try {
      const d = await readTexts(desk.page);
      const m = await readTexts(mob.page);
      expect(d.find((t) => t.text === 'Tiêu đề ngắn').size).toBe(35);
      expect(d.find((t) => t.text === 'Alpha').size).toBe(16);
      expect(m.find((t) => t.text === 'Tiêu đề ngắn').size).toBe(45);
      expect(m.find((t) => t.text === 'Alpha').size).toBe(22);
    } finally { await desk.close(); await mob.close(); }
  }, 30000);

  it('điện thoại: nhãn trục X xoay nghiêng không bị cắt ở đáy', async () => {
    const labels = ['03/2024', '04/2024', '01/2025', '02/2025', '03/2025', '04/2025', '01/2026', '02/2026', '03/2026'];
    const built = buildSample('bar', { table: labels.map((l, i) => [l, 1600 - i * 100]), settings: { width: 1000, height: 1000 } });
    const mob = await openChart(browser, built, { viewport: { width: 375, height: 500 }, wait: 1800 });
    try {
      const boxes = await readTexts(mob.page);
      const out = boxes.filter((b) => b.y1 > mob.H + 1 || b.x0 < -1).map((b) => b.text);
      expect(out).toEqual([]);
    } finally { await mob.close(); }
  }, 30000);

  it('hiệu ứng: cột bắt đầu trong suốt rồi hiện đầy đủ sau khi mọc lên', async () => {
    const c = await openChart(browser, buildSample('bar', { settings: { width: 800, height: 500 } }), { wait: 0 });
    try {
      // ngay lúc mới mở, cột chưa hiện hết (đang chờ hoặc đang chạy hiệu ứng)
      const early = await c.page.evaluate(() => Math.min(...[...document.querySelectorAll('[data-bar]')].map((b) => parseFloat(getComputedStyle(b).opacity))));
      expect(early).toBeLessThan(1);
      await c.page.waitForTimeout(2500);
      const late = await c.page.evaluate(() => [...document.querySelectorAll('[data-bar]')].map((b) => parseFloat(getComputedStyle(b).opacity)));
      expect(late.every((o) => o === 1)).toBe(true);
    } finally { await c.close(); }
  }, 30000);
});
