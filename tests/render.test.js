// @vitest-environment jsdom
// Vẽ biểu đồ thật (trong trình duyệt giả lập) rồi kiểm tra nội dung SVG tạo ra
import { describe, it, expect } from 'vitest';
import { renderStaticSvg } from '../src/Lib/svgBuilder.js';
import { build, buildSample, buildRange, SAMPLES } from './helpers.js';

const draw = (id, extra) => {
  const b = typeof id === 'string' ? buildSample(id, extra) : id;
  return renderStaticSvg(b.spec, b.settings, b.options, b.rows, b.colors || {});
};
const parse = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml');
const texts = (svg) => [...parse(svg).querySelectorAll('text')].map((t) => t.textContent);
const count = (svg, sel) => parse(svg).querySelectorAll(sel).length;

describe('Mọi loại biểu đồ vẽ được', () => {
  for (const id of Object.keys(SAMPLES)) {
    it(`${id}: vẽ ra SVG, có số liệu và không báo lỗi`, () => {
      const svg = draw(id);
      expect(svg).toContain('<svg');
      expect(svg).not.toContain('Lỗi vẽ biểu đồ');
      expect(texts(svg).length).toBeGreaterThan(3);
    });
  }

  it('dữ liệu rỗng không làm hỏng, hiện thông báo không có dữ liệu', () => {
    const b = build('bar', { series: [{ name: 'GT' }], table: [] });
    const svg = renderStaticSvg(b.spec, b.settings, b.options, b.rows, {});
    expect(texts(svg).join(' ')).toMatch(/Không có dữ liệu/);
  });
});

describe('Định dạng số', () => {
  it('không bao giờ hiện "-0"', () => {
    const svg = draw('bar', { table: [['A', -3], ['B', 5], ['C', -0.0001]] });
    expect(texts(svg)).not.toContain('-0');
    expect(texts(svg)).toContain('0');
  });

  it('cột âm vẫn hiện nhãn số âm', () => {
    const svg = draw('bar'); // có giá trị -30
    expect(texts(svg)).toContain('-30');
  });
});

describe('Cỡ chữ', () => {
  it('nhãn trục dùng đúng cỡ người dùng nhập (không nhân thêm hệ số)', () => {
    // danh mục là chữ (danh mục toàn số như "2024" được coi là số liệu nên dùng cỡ "Số liệu")
    const svg = draw('bar', { table: [['Alpha', 1], ['Beta', 2]], settings: { labelSize: 20 } });
    const axisLabels = [...parse(svg).querySelectorAll('text')].filter((t) => t.textContent === 'Alpha');
    expect(axisLabels.length).toBeGreaterThan(0);
    expect(axisLabels[0].getAttribute('font-size')).toBe('20');
  });

  it('tiêu đề dài tự xuống dòng', () => {
    const title = 'Giá trị tài sản của ông Đỗ Anh Tuấn theo từng cổ phiếu trong nhiều năm liên tiếp';
    const svg = draw('bar', { settings: { title } });
    const lines = [...parse(svg).querySelectorAll('text')].filter((t) => t.getAttribute('font-size') === '35' && t.getAttribute('font-weight') === 'bold');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.map((t) => t.textContent).join(' ')).toBe(title);
  });
});

describe('Logo NQS DATA', () => {
  it('có logo mặc định và bỏ được bằng thiết lập', () => {
    const on = draw('bar');
    expect(count(on, 'image')).toBe(1);
    const off = draw('bar', { settings: { showBrandLogo: false } });
    expect(count(off, 'image')).toBe(0);
  });
});

describe('Tooltip gộp mọi chuỗi tại một mốc', () => {
  it('kết hợp: cột và điểm đường đều liệt kê cả hai chuỗi', () => {
    const svg = draw('combo');
    const tips = [...parse(svg).querySelectorAll('[data-tip]')].map((e) => e.getAttribute('data-tip'));
    const q2 = tips.filter((t) => t.startsWith('Q2'));
    expect(q2.length).toBeGreaterThan(0);
    for (const t of q2) {
      expect(t).toContain('Doanh thu:');
      expect(t).toContain('Lợi nhuận:');
    }
  });

  it('đường nhiều chuỗi: tooltip của một điểm có đủ chuỗi', () => {
    const svg = draw('line');
    const tips = [...parse(svg).querySelectorAll('[data-tip]')].map((e) => e.getAttribute('data-tip'));
    expect(tips.some((t) => t.includes('Doanh thu:') && t.includes('Chi phí:'))).toBe(true);
  });
});

describe('Hiệu ứng và tương tác', () => {
  it('ảnh tĩnh không để cột trong suốt (hiệu ứng vào bị tắt)', () => {
    const svg = draw('bar');
    expect(svg).not.toMatch(/opacity:\s*0/);
    expect(count(svg, '[data-bar]')).toBeGreaterThan(0);
  });
});

describe('Chuỗi "Tổng" trong cột chồng', () => {
  const withTotal = () => draw('stackedBar', {
    series: [{ name: 'Dài hạn', kind: 'bar' }, { name: 'Ngắn hạn', kind: 'bar' }, { name: 'Tổng nợ vay', kind: 'total' }],
    table: [['Q1', 300, 5, 305], ['Q2', 590, 2, 592]],
  });

  it('không xếp chồng chuỗi Tổng: cột chỉ có 2 khúc và số tổng ghi trên đầu cột', () => {
    const svg = withTotal();
    expect(count(svg, 'rect[data-g]')).toBe(4); // 2 quý x 2 khúc
    expect(count(svg, 'rect[data-g="Tổng nợ vay"]')).toBe(0);
    expect(texts(svg)).toContain('305');
    expect(texts(svg)).toContain('592');
  });

  it('chú giải không có mục Tổng; tooltip vẫn có dòng Tổng', () => {
    const svg = withTotal();
    const legend = [...parse(svg).querySelectorAll('[data-legend]')].map((e) => e.getAttribute('data-legend'));
    expect(legend).toEqual(['Dài hạn', 'Ngắn hạn']);
    const tips = [...parse(svg).querySelectorAll('[data-tip]')].map((e) => e.getAttribute('data-tip'));
    expect(tips.some((t) => t.includes('Tổng nợ vay: 305'))).toBe(true);
  });
});

describe('Cột tăng/giảm ở lề phải', () => {
  const withChange = () => draw('bar', {
    series: [{ name: 'Cuối kỳ' }, { name: 'Đầu năm' }],
    table: [['A', 120, 100], ['B', 90, 100]],
    options: { orientation: 'horizontal' },
    settings: { changeCol: { on: true, curId: 'a', baseId: 'b', title: 'Tăng/giảm đầu năm' } },
  });

  it('hiện % tăng (có dấu +) và % giảm', () => {
    const t = texts(withChange());
    expect(t.some((x) => /^\+20%$/.test(x))).toBe(true);
    expect(t.some((x) => /^-10%$/.test(x))).toBe(true);
  });

  it('hiện tiêu đề cột', () => {
    expect(texts(withChange()).join(' ')).toContain('Tăng/giảm');
  });

  it('biểu đồ dọc thì không vẽ cột tăng/giảm', () => {
    const svg = draw('bar', {
      series: [{ name: 'Cuối kỳ' }, { name: 'Đầu năm' }], table: [['A', 120, 100]],
      settings: { changeCol: { on: true, curId: 'a', baseId: 'b' } },
    });
    expect(texts(svg).some((x) => /%$/.test(x) && x.startsWith('+'))).toBe(false);
  });
});

describe('Dải lịch sử', () => {
  it('mỗi giá trị hiện tại là một tam giác; doanh nghiệp không có dải thì không có dải xám', () => {
    const svg = draw(buildRange());
    // 3 tam giác trong biểu đồ + 1 trong chú giải
    expect(count(svg, 'polygon')).toBe(4);
    expect(texts(svg)).toContain('19,2');
    expect(texts(svg)).toContain('12');
  });

  it('tên chú giải đổi được', () => {
    const b = buildRange();
    b.options = { ...b.options, curLabel: 'P/E hiện tại' };
    expect(texts(draw(b))).toContain('P/E hiện tại');
  });
});

describe('Thanh nhiều cột', () => {
  it('thanh xếp hạng hai cột: tên danh mục sắp từ lớn đến nhỏ', () => {
    const svg = draw('rankBar', { series: [{ name: 'Kỳ này' }, { name: 'Đầu năm' }], table: [['A', 10, 9], ['B', 30, 20], ['C', 20, 25]] });
    const order = texts(svg).filter((t) => ['A', 'B', 'C'].includes(t));
    expect(order).toEqual(['B', 'C', 'A']);
  });

  it('nhãn số của hai thanh liền nhau không cao hơn thanh (không đè nhau)', () => {
    const svg = draw('rankBar', {
      series: [{ name: 'Kỳ này' }, { name: 'Đầu năm' }],
      table: Array.from({ length: 12 }, (_, i) => ['D' + i, 100 + i, 90 + i]),
      settings: { dataSize: 28, height: 600, width: 1000 },
    });
    const sizes = [...parse(svg).querySelectorAll('text')].filter((t) => /^\d+$/.test(t.textContent) && t.getAttribute('data-raw')).map((t) => Number(t.getAttribute('font-size')));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThan(28);
  });
});

describe('Biểu đồ đường nhiều mốc', () => {
  const many = () => Array.from({ length: 40 }, (_, i) => ['T' + (i + 1), 100 + i, 50 + i]);

  it('nhấn mạnh điểm đầu và cuối: chỉ còn chấm ở hai đầu mỗi chuỗi', () => {
    const svg = draw('line', { table: many() });
    // mỗi chuỗi: 1 chấm đầu + 1 chấm cuối = 4 chấm (và không có hơn)
    expect(count(svg, 'circle:not([fill="transparent"])')).toBe(4);
  });

  it('tắt tùy chọn thì vẽ chấm ở mọi mốc', () => {
    const svg = draw('line', { table: many(), options: { emphasizeEnds: false } });
    expect(count(svg, 'circle:not([fill="transparent"])')).toBe(80);
  });

  it('trục X luôn có nhãn mốc đầu và mốc cuối', () => {
    const t = texts(draw('line', { table: many() }));
    expect(t).toContain('T1');
    expect(t).toContain('T40');
  });
});

describe('Giữ nguyên số, không làm tròn', () => {
  it('số liệu hiện đúng như nhập dù đặt 0 chữ số thập phân; tổng cộng không bị nhiễu', () => {
    const svg = draw('stackedBar', {
      series: [{ name: 'Dài hạn', kind: 'bar' }, { name: 'Ngắn hạn', kind: 'bar' }],
      table: [['Q1', 303.37, 1.05], ['Q2', 588.98, 2.1], ['Q3', 89.75, 0]],
      options: { decimalPlaces: 0 },
    });
    const t = texts(svg);
    expect(t).toContain('303,37');
    expect(t).toContain('588,98');
    expect(t).toContain('304,42'); // tổng 303,37 + 1,05
    expect(t).toContain('591,08'); // tổng 588,98 + 2,1
    expect(t).toContain('89,75');
  });
});

describe('Số thập phân thừa', () => {
  it('bỏ phần thập phân chỉ toàn số 0, giữ phần có nghĩa', () => {
    const svg = draw('bar', { table: [['A', 390], ['B', 590.8], ['C', 0]], options: { decimalPlaces: 1 } });
    const t = texts(svg);
    expect(t).toContain('390');
    expect(t).toContain('590,8');
    expect(t).toContain('0');
    expect(t).not.toContain('390,0');
    expect(t).not.toContain('0,0');
  });
});
