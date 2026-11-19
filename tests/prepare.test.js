import { describe, it, expect } from 'vitest';
import { buildPayload, colorTargets, barColorKey } from '../src/Lib/svgBuilder.js';
import { build } from './helpers.js';

const payload = (id, args) => {
  const b = build(id, args);
  return buildPayload(b.spec, b.settings, b.options, b.rows, b.colors, {}, {});
};

describe('Thanh xếp hạng / thanh tăng giảm', () => {
  it('một cột: giữ dạng thanh xếp hạng (việc sắp xếp thực hiện ở bước vẽ)', () => {
    const p = payload('rankBar', { series: [{ name: 'GT' }], table: [['VPS', 300], ['SSI', 800], ['HCM', 500]] });
    expect(p.type).toBe('rankBar');
    expect(p.data.items).toHaveLength(3);
  });

  it('nhiều cột: vẽ như cột cạnh nhau ngang và xếp theo cột đầu', () => {
    const p = payload('rankBar', { series: [{ name: 'Kỳ này' }, { name: 'Đầu năm' }], table: [['A', 10, 9], ['B', 30, 20], ['C', 20, 25]] });
    expect(p.type).toBe('groupedBar');
    expect(p.options.orientation).toBe('horizontal');
    expect(p.data.xs).toEqual(['B', 'C', 'A']);
  });

  it('thanh tăng/giảm: dương màu xanh, âm màu đỏ', () => {
    const p = payload('divBar', { series: [{ name: 'Người' }], table: [['Tăng', 5], ['Giảm', -5]] });
    const by = Object.fromEntries(p.data.items.map((i) => [i.label, i.start]));
    expect(by['Tăng']).toBe('#1747A6');
    expect(by['Giảm']).toBe('#EE3A43');
  });
});

describe('Cột đơn', () => {
  it('thêm cột: chuyển sang cột cạnh nhau và giữ chiều theo tùy chọn', () => {
    const p = payload('bar', { series: [{ name: 'A' }, { name: 'B' }], table: [['X', 1, 2]], options: { orientation: 'horizontal' } });
    expect(p.type).toBe('groupedBar');
    expect(p.options.orientation).toBe('horizontal');
  });

  it('cột thứ hai mặc định là gradient xanh lá, cột đầu giữ màu tím', () => {
    const p = payload('bar', { series: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], table: [['X', 1, 2, 3]] });
    expect(p.data.series[1].start).toBe('#008300');
    expect(p.data.series[1].end).toBe('#1BAF7B');
    expect(p.data.series[0].start).not.toBe('#008300');
  });

  it('biểu đồ đường không bị đổi màu mặc định cột thứ hai', () => {
    const p = payload('line', { series: [{ name: 'A' }, { name: 'B' }], table: [['Q1', 1, 2]] });
    expect(p.data.series[1].start).not.toBe('#008300');
  });

  it('một cột: màu riêng của danh mục thắng màu chung "Tất cả các cột"', () => {
    const p = payload('bar', {
      series: [{ name: 'GT' }], table: [['A', 1], ['B', 2]],
      colors: { __bar__: { start: '#00aa00', gradient: false }, B: { start: '#ff0000', gradient: false } },
    });
    const by = Object.fromEntries(p.data.items.map((i) => [i.label, i.start]));
    expect(by).toEqual({ A: '#00aa00', B: '#ff0000' });
  });

  it('nhiều cột: màu riêng của một cột chỉ ảnh hưởng đúng cột đó', () => {
    const p = payload('bar', {
      series: [{ name: 'S1' }, { name: 'S2' }], table: [['X', 1, 2], ['Y', 3, 4]],
      colors: { [barColorKey('S1', 'Y')]: { start: '#ff0000', gradient: false } },
    });
    expect(p.data.series[0].catColors[0]).toBeNull();
    expect(p.data.series[0].catColors[1].start).toBe('#ff0000');
    expect(p.data.series[1].catColors).toBeUndefined();
  });

  it('sắp xếp giảm dần theo cột đầu khi nhiều cột', () => {
    const p = payload('bar', { series: [{ name: 'A' }, { name: 'B' }], table: [['x', 1, 1], ['y', 9, 1], ['z', 5, 1]], options: { sort: 'desc' } });
    expect(p.data.xs).toEqual(['y', 'z', 'x']);
  });
});

describe('Danh sách màu ở bước tạo SVG', () => {
  it('kết hợp: chip từng cột chỉ cho chuỗi dạng cột, không cho chuỗi đường', () => {
    const b = build('combo', { series: [{ name: 'DT', kind: 'bar' }, { name: 'LN', kind: 'line' }], table: [['Q1', 1, 2], ['Q2', 3, 4]] });
    const t = colorTargets(b.spec, b.rows);
    expect(t.filter((x) => x.bar).map((x) => x.group)).toEqual(['DT', 'DT']);
    expect(t.filter((x) => !x.bar).map((x) => x.name)).toEqual(['DT', 'LN']);
  });

  it('cột chồng: mỗi khúc của mỗi cột có chip riêng', () => {
    const b = build('stackedBar', { series: [{ name: 'A', kind: 'bar' }, { name: 'B', kind: 'bar' }], table: [['2019', 1, 2], ['2020', 3, 4]] });
    expect(colorTargets(b.spec, b.rows).filter((x) => x.bar)).toHaveLength(4);
  });

  it('biểu đồ tròn: mỗi danh mục một mục màu', () => {
    const b = build('pie', { series: [{ name: 'GT' }], table: [['A', 1], ['B', 2]] });
    expect(colorTargets(b.spec, b.rows).map((x) => x.name)).toEqual(['A', 'B']);
  });
});

describe('Biểu đồ tròn', () => {
  it('cột chọn kiểu %: 0,45 hiểu là 45', () => {
    const p = payload('pie', { series: [{ name: 'GT', pct: true }], table: [['A', 0.45], ['B', 0.55]] });
    const v = p.data.items.map((i) => i.value);
    expect(v[0]).toBeCloseTo(45);
    expect(v[1]).toBeCloseTo(55);
    expect(p.data.pct).toBe(true);
  });

  it('nhiều cột: vẽ cột được chọn "Vẽ", mặc định cột đầu', () => {
    const p1 = payload('pie', { series: [{ name: 'X' }, { name: 'Y' }], table: [['A', 1, 100], ['B', 2, 200]] });
    expect(p1.data.items.map((i) => i.value)).toEqual([1, 2]);
    const p2 = payload('pie', { series: [{ name: 'X' }, { name: 'Y', draw: true }], table: [['A', 1, 100], ['B', 2, 200]] });
    expect(p2.data.items.map((i) => i.value)).toEqual([100, 200]);
  });
});

describe('Cột tăng/giảm', () => {
  const withChange = (cc, table) => payload('bar', {
    series: [{ name: 'Cuối kỳ' }, { name: 'Đầu năm' }], table,
    options: { orientation: 'horizontal' }, settings: { changeCol: cc },
  });

  it('tính (kỳ này - kỳ gốc) / kỳ gốc ra phần trăm', () => {
    const p = withChange({ on: true, curId: 'a', baseId: 'b', title: 'Tăng/giảm' }, [['X', 120, 100], ['Y', 90, 100]]);
    expect(p.data.changes.values[0]).toBeCloseTo(20);
    expect(p.data.changes.values[1]).toBeCloseTo(-10);
    expect(p.data.changes.title).toBe('Tăng/giảm');
  });

  it('kỳ gốc bằng 0 hoặc trống thì không tính', () => {
    const p = withChange({ on: true, curId: 'a', baseId: 'b' }, [['X', 5, 0], ['Y', 5, null]]);
    expect(p.data.changes.values).toEqual([null, null]);
  });

  it('không bật thì không có dữ liệu tăng/giảm', () => {
    const p = withChange({ on: false }, [['X', 5, 4]]);
    expect(p.data.changes).toBeUndefined();
  });

  it('chọn hai cột trùng nhau thì bỏ qua', () => {
    const p = withChange({ on: true, curId: 'a', baseId: 'a' }, [['X', 5, 4]]);
    expect(p.data.changes).toBeUndefined();
  });
});
