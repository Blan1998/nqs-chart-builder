// Kiểm tra bố cục bằng trình duyệt thật: chữ không đè nhau, không tràn khỏi khung, khoảng cách đúng
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { browserPath, launch, openChart, readTexts, overlaps } from './browser.js';
import { build, buildSample, buildRange } from '../helpers.js';

const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const SCENARIOS = {
  'cột đơn có số âm': () => buildSample('bar', {
    table: [['T1', 36], ['T2', -3], ['T3', -28], ['T4', -121], ['T5', 15], ['T6', 48], ['T7', -265], ['T8', -114]],
    settings: { width: 1000, height: 700 },
  }),
  'thanh xếp hạng hai cột, 12 danh mục': () => buildSample('rankBar', {
    series: [{ name: 'Cuối kỳ' }, { name: 'Đầu năm' }],
    table: many(12, (i) => ['NH' + (i + 1), 2500 - i * 150, 2300 - i * 140]),
    settings: { width: 1000, height: 900 },
  }),
  // Trường hợp khó: thanh mỏng và cỡ chữ số liệu lớn (từng làm số của hai thanh liền nhau đè lên nhau)
  'thanh xếp hạng hai cột, thanh mỏng và chữ lớn': () => buildSample('rankBar', {
    series: [{ name: 'Cuối kỳ' }, { name: 'Đầu năm' }],
    table: many(8, (i) => ['NH' + (i + 1), 2500 - i * 200, 2300 - i * 180]),
    settings: { width: 1000, height: 560, dataSize: 28 },
  }),
  // Trường hợp khó: khúc cột rất nhỏ (nhãn số của khúc không được tràn sang khúc khác)
  'cột chồng có khúc rất nhỏ': () => buildSample('stackedBar', {
    series: [{ name: 'A', kind: 'bar' }, { name: 'B', kind: 'bar' }, { name: 'C', kind: 'bar' }, { name: 'D', kind: 'bar' }],
    table: [['2019', 90, 3, 2, 1], ['2020', 80, 4, 2, 3]],
    settings: { width: 1000, height: 700 },
  }),
  'thanh xếp hạng có cột tăng/giảm': () => buildSample('rankBar', {
    series: [{ name: 'Cuối kỳ' }, { name: 'Đầu năm' }],
    table: many(8, (i) => ['NH' + (i + 1), 2500 - i * 200, 2300 - i * 180]),
    settings: { width: 1000, height: 800, changeCol: { on: true, curId: 'a', baseId: 'b', title: 'Tăng/giảm đầu năm' } },
  }),
  'thanh tăng/giảm 25 danh mục': () => buildSample('divBar', {
    table: many(25, (i) => ['NH' + (i + 1), (i % 2 ? 1 : -1) * (100 + i * 40)]),
    settings: { width: 1000, height: 1000 },
  }),
  'kết hợp cột và đường': () => buildSample('combo', { settings: { width: 1000, height: 700 } }),
  'đường nhiều mốc': () => buildSample('line', {
    table: many(60, (i) => ['11/' + (i + 1), 25600 + (i % 9) * 8, 25500 + (i % 7) * 6]),
    settings: { width: 1000, height: 700 },
  }),
  'dải lịch sử': () => buildRange(),
  'cột chồng': () => buildSample('stackedBar', { settings: { width: 1000, height: 700 } }),
};

describe.skipIf(!browserPath)('Bố cục trên trình duyệt thật', () => {
  let browser;
  beforeAll(async () => { browser = await launch(); }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  for (const [name, make] of Object.entries(SCENARIOS)) {
    it(`${name}: chữ không đè nhau và không tràn khỏi khung`, async () => {
      const c = await openChart(browser, make());
      try {
        expect(c.errors).toEqual([]);
        const boxes = await readTexts(c.page);
        expect(boxes.length).toBeGreaterThan(3);
        // không tràn khỏi khung (cho phép 1px sai số)
        const out = boxes.filter((b) => b.x0 < -1 || b.y0 < -1 || b.x1 > c.W + 1 || b.y1 > c.H + 1).map((b) => b.text);
        expect(out).toEqual([]);
        // không đè nhau
        expect(overlaps(boxes)).toEqual([]);
      } finally { await c.close(); }
    }, 30000);
  }

  it('nhãn số của cột âm cách đầu cột một khoảng cố định, giống cột dương', async () => {
    const c = await openChart(browser, buildSample('bar', {
      table: [['A', 100], ['B', -100]], settings: { width: 800, height: 600 },
    }));
    try {
      const r = await c.page.evaluate(() => {
        const svg = document.documentElement;
        const bars = [...svg.querySelectorAll('[data-bar]')].map((b) => b.getBoundingClientRect());
        // nhãn số của cột: chữ nằm giữa theo chiều ngang của cột (không phải số trên trục)
        const labelOf = (bar, txt) => [...svg.querySelectorAll('text')].filter((t) => t.textContent === txt).map((t) => t.getBoundingClientRect())
          .find((r) => (r.left + r.right) / 2 > bar.left && (r.left + r.right) / 2 < bar.right);
        const pos = labelOf(bars[0], '100');
        const neg = labelOf(bars[1], '-100');
        return { posGap: bars[0].top - pos.bottom, negGap: neg.top - bars[1].bottom };
      });
      expect(Math.abs(r.posGap - r.negGap)).toBeLessThan(6);
      expect(r.negGap).toBeGreaterThan(0);
    } finally { await c.close(); }
  }, 30000);

  it('biểu đồ ngang: tên danh mục dài nhất thẳng hàng với tiêu đề (lề trái 8)', async () => {
    const c = await openChart(browser, buildSample('bar', {
      table: [['HPG', 4035], ['MSN', 3338], ['MWG', 2080]],
      options: { orientation: 'horizontal' },
      settings: { title: 'Giá trị mua ròng', width: 1000, height: 700 },
    }));
    try {
      const boxes = await readTexts(c.page);
      const title = boxes.find((b) => b.text === 'Giá trị mua ròng');
      const cat = boxes.find((b) => b.text === 'HPG');
      expect(Math.abs(title.x0 - 8)).toBeLessThan(4);
      expect(Math.abs(cat.x0 - title.x0)).toBeLessThan(14);
    } finally { await c.close(); }
  }, 30000);

  it('logo nằm bên phải và không đè lên tiêu đề', async () => {
    const c = await openChart(browser, buildSample('bar', {
      settings: { title: 'Giá trị tài sản của ông Đỗ Anh Tuấn theo từng cổ phiếu', width: 1000, height: 700 },
    }));
    try {
      const r = await c.page.evaluate(() => {
        const svg = document.documentElement;
        const vb = svg.viewBox.baseVal;
        const r0 = svg.getBoundingClientRect();
        const sx = vb.width / r0.width;
        const img = svg.querySelector('image').getBoundingClientRect();
        const titles = [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('font-size') === '35');
        const maxRight = Math.max(...titles.map((t) => (t.getBoundingClientRect().right - r0.left) * sx));
        return { imgLeft: (img.left - r0.left) * sx, imgRight: (img.right - r0.left) * sx, titleRight: maxRight };
      });
      expect(r.imgLeft).toBeGreaterThan(r.titleRight);
      expect(r.imgRight).toBeLessThanOrEqual(1000);
    } finally { await c.close(); }
  }, 30000);
});

describe.skipIf(!browserPath)('Số trong cột', () => {
  let browser;
  beforeAll(async () => { browser = await launch(); }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  it('cột chồng: số dài nằm gọn trong bề rộng cột', async () => {
    const c = await openChart(browser, buildSample('stackedBar', {
      series: [{ name: 'Dài hạn', kind: 'bar' }, { name: 'Ngắn hạn', kind: 'bar' }],
      table: many(9, (i) => ['Q' + (i + 1) + '/2025', 588.98 + i * 0.01, 303.37 + i]),
      settings: { width: 1000, height: 700, dataSize: 22 },
    }));
    try {
      const r = await c.page.evaluate(() => {
        const svg = document.documentElement;
        const bars = [...svg.querySelectorAll('rect[data-g]')].map((b) => b.getBoundingClientRect());
        const bw = Math.min(...bars.map((b) => b.width));
        const wide = [...svg.querySelectorAll('text[data-inside]')].map((t) => t.getBoundingClientRect().width).filter((w) => w > bw);
        return { bw, wide };
      });
      expect(r.wide).toEqual([]);
    } finally { await c.close(); }
  }, 30000);
});
