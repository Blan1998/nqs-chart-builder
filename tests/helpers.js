// Dữ liệu mẫu và hàm dựng dùng chung cho các bài kiểm thử
import { CHART_SPECS } from '../src/specs/index.js';
import { wideSpecFor } from '../src/Lib/wide.js';
import { DEFAULT_SETTINGS } from '../src/components/PresentationForm.jsx';

export const IDS = ['a', 'b', 'c', 'd'];

export function defaultOptions(id) {
  return Object.fromEntries(CHART_SPECS[id].options.map((o) => [o.key, o.default ?? null]));
}

// series: [{ name, kind?, pct? }]; table: [[danh mục, giá trị chuỗi 1, giá trị chuỗi 2...]]
export function build(id, { series, table, settings = {}, options = {}, colors = {} }) {
  const base = CHART_SPECS[id];
  const defs = (series || []).map((s, i) => ({ id: IDS[i], ...s }));
  const spec = series ? wideSpecFor(base, defs) : base;
  const rows = table.map((r) => {
    const o = { category: r[0] };
    if (series) defs.forEach((d, i) => { o[d.id] = r[i + 1] === null || r[i + 1] === undefined ? '' : String(r[i + 1]); });
    return o;
  });
  return { spec, rows, settings: { ...DEFAULT_SETTINGS, height: 1000, ...settings }, options: { ...defaultOptions(id), ...options }, colors, defs };
}

export const SAMPLES = {
  pie: { series: [{ name: 'Giá trị' }], table: [['A', 35], ['B', 25], ['C', 40]] },
  bar: { series: [{ name: 'Giá trị' }], table: [['2022', 120], ['2023', -30], ['2024', 180]] },
  rankBar: { series: [{ name: 'Giá trị' }], table: [['VPS', 300], ['SSI', 800], ['HCM', 500]] },
  divBar: { series: [{ name: 'Người' }], table: [['VPBank', 2150], ['MB', 410], ['Sacombank', -1800]] },
  line: { series: [{ name: 'Doanh thu' }, { name: 'Chi phí' }], table: [['Q1', 42.5, 30], ['Q2', 45, 31.5], ['Q3', 47.2, 33]] },
  combo: { series: [{ name: 'Doanh thu', kind: 'bar' }, { name: 'Lợi nhuận', kind: 'line' }], table: [['Q1', 1300, 40], ['Q2', 1573, 62], ['Q3', 1302, 44]] },
  stackedBar: { series: [{ name: 'A', kind: 'bar' }, { name: 'B', kind: 'bar' }, { name: 'C', kind: 'bar' }], table: [['2019', 49, 5, 7], ['2020', 64, 6, 4]] },
  stackedArea: { series: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], table: [['Q1', 33, 21, 7], ['Q2', 34, 20, 6], ['Q3', 31, 23, 9]] },
  rangeDot: { table: [['FRT', 19, 29, 45, 19.2], ['MWG', 17.5, 19.5, 37, 9.6], ['HTM', null, null, null, 12]] },
};

// rangeDot có cột cố định nên dựng riêng
export function buildRange() {
  const base = CHART_SPECS.rangeDot;
  const keys = base.columns.map((c) => c.key);
  const rows = SAMPLES.rangeDot.table.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] === null ? '' : String(r[i])])));
  return { spec: base, rows, settings: { ...DEFAULT_SETTINGS, height: 1000 }, options: defaultOptions('rangeDot'), colors: {} };
}

export function buildSample(id, extra = {}) {
  if (id === 'rangeDot') return { ...buildRange(), ...extra };
  return build(id, { ...SAMPLES[id], ...extra });
}
