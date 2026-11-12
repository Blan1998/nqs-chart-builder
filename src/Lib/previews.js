// Dữ liệu mẫu và ảnh demo cho từng loại biểu đồ (bước 1)
import { renderStaticSvg, colorTargets } from './svgBuilder.js';
import { defaultSeries, wideSpecFor } from './wide.js';
import { DEFAULT_SETTINGS } from '../components/PresentationForm.jsx';

// Gradient Tím - Lavender: dưới là tím đậm, trên là lavender nhạt
const PREVIEW_GRADIENT = { start: '#3B1B70', end: '#A78BFA', gradient: true, dir: 'v' };

const LONG = {
  rankBar: [
    { category: 'Dallas Mavericks', value: 8250 },
    { category: 'Oklahoma City Thunder', value: 5050 },
    { category: 'LA Lakers', value: 3350 },
    { category: 'Miami Heat', value: 2750 },
    { category: 'Phoenix Suns', value: 2300 },
    { category: 'Indiana Pacers', value: 2150 },
    { category: 'Charlotte Hornets', value: 2130 },
  ],
  pie: [
    { category: 'Nhóm A', value: 35 },
    { category: 'Nhóm B', value: 25 },
    { category: 'Nhóm C', value: 40 },
  ],
  bar: [
    { category: '2022', value: 120 },
    { category: '2023', value: 150 },
    { category: '2024', value: 180 },
  ],
  line: [
    { x: '2024-Q1', series: 'Doanh thu', value: 42.5 },
    { x: '2024-Q2', series: 'Doanh thu', value: 45 },
    { x: '2024-Q3', series: 'Doanh thu', value: 47.2 },
    { x: '2024-Q1', series: 'Chi phí', value: 30 },
    { x: '2024-Q2', series: 'Chi phí', value: 31.5 },
    { x: '2024-Q3', series: 'Chi phí', value: 33 },
  ],
};

// Dữ liệu thật từ file dân số 1960–1966 (8 quốc gia)
const RACE_SAMPLE = [{"name": "Argentina", "region": "Americas", "flag": "https://public.flourish.studio/country-flags/svg/ar.svg", "values": [15177907, 15550745, 15916161, 16283191, 16650738, 17017602, 17383414]}, {"name": "Australia", "region": "Oceania", "flag": "https://public.flourish.studio/country-flags/svg/au.svg", "values": [8378309, 8589875, 8832932, 9034955, 9245383, 9459784, 9709943]}, {"name": "Algeria", "region": "Africa", "flag": "https://public.flourish.studio/country-flags/svg/dz.svg", "values": [3394203, 3626403, 3882767, 4154288, 4443887, 4753164, 5041536]}, {"name": "Austria", "region": "Europe", "flag": "https://public.flourish.studio/country-flags/svg/at.svg", "values": [4561167, 4592914, 4624644, 4658034, 4692726, 4726878, 4763809]}, {"name": "Azerbaijan", "region": "Asia", "flag": "https://public.flourish.studio/country-flags/svg/az.svg", "values": [2051432, 2110437, 2171811, 2233683, 2293590, 2349763, 2401556]}, {"name": "Armenia", "region": "Asia", "flag": "https://public.flourish.studio/country-flags/svg/am.svg", "values": [960955, 1012429, 1065431, 1119584, 1174558, 1229978, 1285571]}, {"name": "Afghanistan", "region": "Asia", "flag": "https://public.flourish.studio/country-flags/svg/af.svg", "values": [755783, 796042, 838885, 884370, 932848, 984301, 1038888]}, {"name": "Angola", "region": "Africa", "flag": "https://public.flourish.studio/country-flags/svg/ao.svg", "values": [588866, 621212, 657233, 695164, 734733, 775661, 818062]}];

// Mẫu theo hàng: [danh mục, chuỗi 1, chuỗi 2, ...]
const WIDE = {
  groupedBar: [
    ['Bán hàng', 78, 65],
    ['Tài chính', 60, 65],
    ['Marketing', 45, 65],
    ['Nhân sự', 30, 65],
  ],
  combo: [
    ['Q4/2024', 1826.1, 216.5],
    ['Q1/2025', 1269.1, 211.9],
    ['Q2/2025', 1990.8, 320.5],
    ['Q3/2025', 1609.6, 257.6],
    ['Q4/2025', 1881.4, 202.8],
    ['Q1/2026', 1478.1, 254.4],
    ['Q2/2026', 2150.0, 477.6],
    ['Q3/2026', 2106.1, 289.6],
  ],
  stackedBar: [
    ['2019', 49, 5, 7, 23, 16],
    ['2020', 64.8, 6.1, 4.4, 16.3, 8.4],
    ['2021', 62.9, 4.3, 2.6, 13.8, 16.4],
    ['Quý 1/2022', 36.7, 8.1, 7.4, 18.2, 29.6],
  ],
};

function previewSvg(spec) {
  const defaults = Object.fromEntries(spec.options.map((o) => [o.key, o.default ?? null]));
  const settings = { ...DEFAULT_SETTINGS, title: '', subtitle: '', description: '', width: 1200, height: 675 };
  let target = spec;
  let rows;

  if (spec.id === 'barRace' || spec.id === 'lineRank') {
    const series = defaultSeries(spec);
    target = wideSpecFor(spec, series);
    rows = RACE_SAMPLE.map((r) => {
      const o = { category: r.name, region: r.region, flag: '' };
      series.forEach((s, i) => { o[s.id] = r.values[i]; });
      return o;
    });
  } else if (WIDE[spec.id]) {
    const series = defaultSeries(spec);
    target = wideSpecFor(spec, series);
    rows = WIDE[spec.id].map((r) => {
      const o = { category: r[0] };
      series.forEach((s, i) => { o[s.id] = r[i + 1]; });
      return o;
    });
  } else {
    rows = LONG[spec.id].map((r) => ({ ...r }));
  }

  const colors = {};
  colorTargets(target, rows).forEach((t) => { colors[t.key] = PREVIEW_GRADIENT; });
  return renderStaticSvg(target, settings, defaults, rows, colors);
}

// Nếu không vẽ được ảnh demo, hiện thông báo lỗi thay vì làm trắng cả ứng dụng
export function previewFor(spec) {
  try {
    return previewSvg(spec);
  } catch (e) {
    const msg = String((e && e.message) || e).replace(/[<>&]/g, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675"><rect width="1200" height="675" fill="#fef2f2"/><text x="40" y="80" font-size="28" fill="#b91c1c" font-family="Arial">Lỗi ảnh demo: ${msg}</text></svg>`;
  }
}