// @vitest-environment jsdom
// Chiều cao tự dãn: để trống chiều cao thì biểu đồ tự đo cho vừa nội dung
import { describe, it, expect } from 'vitest';
import { resolveHeight, buildSvgDocument, embedCode } from '../src/Lib/svgBuilder.js';
import { build, buildSample } from './helpers.js';

const auto = (id, extra = {}) => {
  const b = buildSample(id, { ...extra, settings: { ...(extra.settings || {}), height: null } });
  return resolveHeight(b.spec, b.settings, b.options, b.rows, b.colors || {});
};
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

describe('Chiều cao tự dãn', () => {
  it('nhập chiều cao thì dùng đúng số đó (trong khoảng 300–3000)', () => {
    const b = buildSample('bar', { settings: { height: 800 } });
    expect(resolveHeight(b.spec, b.settings, b.options, b.rows, {})).toBe(800);
    const c = buildSample('bar', { settings: { height: 50 } });
    expect(resolveHeight(c.spec, c.settings, c.options, c.rows, {})).toBe(300);
  });

  it('mọi loại biểu đồ tự ra chiều cao hợp lý (không bé quá, không lố)', () => {
    for (const id of ['pie', 'bar', 'rankBar', 'divBar', 'line', 'combo', 'stackedBar', 'stackedArea']) {
      const h = auto(id);
      expect(h, id).toBeGreaterThan(300);
      expect(h, id).toBeLessThan(1500);
    }
  });

  it('thanh ngang: nhiều danh mục thì cao hơn, ít danh mục thì thấp hơn', () => {
    const few = auto('rankBar', { table: many(4, (i) => ['NH' + i, 100 - i]) });
    const lots = auto('rankBar', { table: many(25, (i) => ['NH' + i, 100 - i]) });
    expect(lots).toBeGreaterThan(few + 600);
  });

  it('tiêu đề và chú giải dài hơn thì khung cao thêm', () => {
    const short = auto('pie', { settings: { title: 'Ngắn' } });
    const long = auto('pie', { settings: { title: 'Cơ cấu chi phí sản xuất kinh doanh dở dang của doanh nghiệp bất động sản' } });
    expect(long).toBeGreaterThan(short);
  });

  it('bản SVG xuất ra có chiều cao cố định (không dãn lúc chạy)', () => {
    const b = buildSample('pie', { settings: { height: null } });
    const svg = buildSvgDocument(b.spec, b.settings, b.options, b.rows, {});
    const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(Number(m[2])).toBe(auto('pie'));
    expect(svg).toContain('"autoHeight":false');
  });

  it('mã nhúng dùng đúng tỉ lệ đã đo', () => {
    expect(embedCode('https://x/y.svg', 1000, 1234)).toContain('padding-bottom:123.4%');
  });
});
