import { describe, it, expect } from 'vitest';
import { validateRows } from '../src/Lib/dataUtils.js';
import { build, buildRange } from './helpers.js';

const msgs = (spec, rows) => validateRows(spec, rows).map((e) => e.message);

describe('Kiểm tra dữ liệu nhập', () => {
  it('báo trùng tên danh mục ở biểu đồ tròn', () => {
    const { spec, rows } = build('pie', { series: [{ name: 'GT' }], table: [['A', 1], ['A', 2]] });
    expect(msgs(spec, rows).some((m) => /trùng/.test(m))).toBe(true);
  });

  it('báo lỗi khi tổng biểu đồ tròn bằng 0', () => {
    const { spec, rows } = build('pie', { series: [{ name: 'GT' }], table: [['A', 0], ['B', 0]] });
    expect(msgs(spec, rows).some((m) => /lớn hơn 0/.test(m))).toBe(true);
  });

  it('báo trùng tên chuỗi và chuỗi chưa có tên', () => {
    const dup = build('line', { series: [{ name: 'X' }, { name: 'X' }], table: [['Q1', 1, 2]] });
    expect(msgs(dup.spec, dup.rows).some((m) => /trùng/.test(m))).toBe(true);
    const blank = build('line', { series: [{ name: 'X' }, { name: '' }], table: [['Q1', 1, 2]] });
    expect(msgs(blank.spec, blank.rows).some((m) => /chưa có tên/.test(m))).toBe(true);
  });

  it('dữ liệu hợp lệ thì không báo gì', () => {
    const { spec, rows } = build('combo', { series: [{ name: 'A', kind: 'bar' }, { name: 'B', kind: 'line' }], table: [['Q1', 1, 2], ['Q2', 3, 4]] });
    expect(validateRows(spec, rows)).toEqual([]);
  });

  it('dải lịch sử: cận dưới lớn hơn cận trên và trung vị ngoài dải bị báo', () => {
    const { spec } = buildRange();
    const bad = [{ category: 'X', low: '30', mid: '20', high: '10', current: '5' }];
    expect(msgs(spec, bad).some((m) => /Cận dưới/.test(m))).toBe(true);
    const out = [{ category: 'X', low: '10', mid: '50', high: '30', current: '5' }];
    expect(msgs(spec, out).some((m) => /Trung vị/.test(m))).toBe(true);
  });

  it('dải lịch sử: bỏ trống dải mà chỉ có giá trị hiện tại là hợp lệ', () => {
    const { spec } = buildRange();
    expect(msgs(spec, [{ category: 'HTM', low: '', mid: '', high: '', current: '12' }])).toEqual([]);
  });
});
