// Sinh file SVG tự chứa: dữ liệu và cấu hình được nhúng vào, script vẽ biểu đồ và xử lý tương tác.
import { NQS_LOGO_SVG, NQS_LOGO_RATIO } from './nqsLogo.js';
import common from '../specs/common.json';
import { isBlank, toNumber, pieValueCol } from './dataUtils.js';

// Màu mặc định: mục đầu tiên dùng gradient tím (màu chính), các mục sau xoay vòng qua các gradient còn lại
// start là màu phía dưới, end là màu phía trên
const DEFAULT_GRADIENTS = [
  { start: common.mainColor.start, end: common.mainColor.end },
  { start: '#FF6201', end: '#3B1B70' },
  { start: '#3B82F6', end: '#06B6D4' },
  { start: '#EC4899', end: '#4C1D95' },
  { start: '#14B8A6', end: '#22C55E' },
];
const defaultGrad = (i) => DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length];
const BAR_KEY = '__bar__';
// Khóa màu riêng của một cột: tên chuỗi và danh mục
export const barColorKey = (seriesName, cat) => seriesName + '::' + cat;
// Biểu đồ cột có thêm cột giá trị: cột đầu giữ màu mặc định, cột thứ hai mặc định là gradient xanh lá
const COL2_GRAD = { start: '#008300', end: '#1BAF7B' };
const DIV_POS = { start: '#1747A6', end: '#1747A6' };
const DIV_NEG = { start: '#EE3A43', end: '#EE3A43' };
const DEFAULT_DESCRIPTION = 'Dữ liệu: Người Quan Sát';
const REGION_PALETTE = ['#2563EB', '#38BDF8', '#A46BDB', '#EC4899', '#F97316', '#14B8A6'];

// Chọn màu cho một đối tượng: colors[key] (nếu người dùng đã chỉnh) hoặc màu mặc định
// fallback là một gradient mặc định {start, end}; người dùng chỉnh thì dùng màu của họ
function resolveColor(colors, key, fallback) {
  const c = colors[key];
  if (!c || !c.start) {
    return { start: fallback.start, end: fallback.end, mid: undefined, dir: c && c.dir === 'h' ? 'h' : 'v' };
  }
  const start = c.start;
  const end = c.gradient && c.end ? c.end : start;
  const mid = c && c.gradient && c.mid ? c.mid : undefined;
  const dir = c && c.dir === 'h' ? 'h' : 'v';
  return { start, end, mid, dir };
}

// Màu thương hiệu (lấy từ logo): pha trắng để tạo độ nhạt cho chuỗi thứ 2, 3... của cùng một danh mục
const BRAND_TINTS = [0, 0.4, 0.65, 0.8];
function mixWhite(hex, t) {
  const n = parseInt(String(hex).slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * t));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function brandSolid(hex, si) {
  const c = mixWhite(hex, BRAND_TINTS[Math.min(si, BRAND_TINTS.length - 1)]);
  return { start: c, end: c };
}
// Danh mục có màu thương hiệu thì dùng, trừ khi người dùng đã tự chọn màu cho mục đó
function pickBrand(brand, name, colors, key, p) {
  const b = brand && brand[name];
  if (!b || (colors[key] && colors[key].start)) return p;
  return { start: b, end: b, mid: undefined, dir: p.dir };
}

// Chuyển dòng dữ liệu nhập tay thành cấu trúc dùng để vẽ
export function prepareData(spec, rows, colors = {}, brand = {}, options = {}) {
  const valid = rows.filter((r) => spec.columns.some((c) => !isBlank(r[c.key])));
  const hasBrand = !!brand && Object.keys(brand).length > 0;

  if (spec.id === 'barRace' || spec.id === 'lineRank') {
    const seriesCols = spec.columns.filter((c) => c.type === 'number');
    const regionOf = (r) => (isBlank(r.region) ? 'Khác' : String(r.region).trim());
    const regionList = [...new Set(valid.filter((r) => !isBlank(r.category)).map(regionOf))];
    const ents = [];
    for (const r of valid) {
      if (isBlank(r.category)) continue;
      const name = String(r.category).trim();
      const region = regionOf(r);
      const key = name;
      const fallback = defaultGrad(ents.length);
      const p = pickBrand(brand, name, colors, key, resolveColor(colors, key, fallback));
      ents.push({
        name,
        region,
        flag: isBlank(r.flag) ? '' : String(r.flag).trim(),
        start: p.start,
        end: p.end,
        mid: p.mid,
        dir: p.dir,
        values: seriesCols.map((c) => {
          const n = toNumber(r[c.key]);
          if (Number.isNaN(n)) return null;
          return c.pct && Math.abs(n) <= 1 && !String(r[c.key]).includes('%') ? n * 100 : n;
        }),
      });
    }
    return { xs: seriesCols.map((c) => c.label), entities: ents, pct: seriesCols.some((c) => c.pct) };
  }

  if (spec.id === 'groupedBar' || spec.id === 'combo' || spec.id === 'stackedBar' || spec.id === 'stackedArea' || (spec.id === 'line' && !spec.columns.some((c) => c.key === 'series')) || ((spec.id === 'rankBar' || spec.id === 'bar' || spec.id === 'divBar') && spec.columns.length > 2)) {
    let catRows = valid.filter((r) => !isBlank(r.category));
    // Thanh xếp hạng nhiều cột: xếp danh mục từ lớn đến nhỏ theo cột đầu tiên
    const barSort = spec.id === 'bar' ? (options && options.sort) : null;
    if (spec.id === 'rankBar' || spec.id === 'divBar' || barSort === 'asc' || barSort === 'desc') {
      const dir = barSort === 'asc' ? -1 : 1;
      const k0 = spec.columns[1].key;
      const num = (r) => { const n = toNumber(r[k0]); return Number.isNaN(n) ? -Infinity : n; };
      catRows = catRows.slice().sort((a, b) => dir * (num(b) - num(a)));
    }
    const xsAll = catRows.map((r) => String(r.category).trim());
    const wideOut = {
      xs: xsAll,
      series: spec.columns.slice(1).map((c, i) => {
        const p = resolveColor(colors, c.label, i === 1 && ['bar', 'rankBar', 'divBar'].includes(spec.id) ? COL2_GRAD : defaultGrad(i));
        // Màu thương hiệu: mỗi cột lấy màu logo của danh mục; chuỗi sau nhạt dần. Chuỗi dạng đường giữ màu riêng.
        const brandOn = hasBrand && (c.kind || 'bar') !== 'line' && !(colors[c.label] && colors[c.label].start);
        const brandBars = brandOn ? {
          catColors: xsAll.map((x) => (brand[x] ? brandSolid(brand[x], i) : null)),
          legendObj: brandSolid('#334155', i),
        } : {};
        return {
          name: c.label,
          kind: c.kind || 'bar',
          pct: !!c.pct,
          start: p.start, mid: p.mid, dir: p.dir,
          end: p.end,
          ...brandBars,
          values: catRows.map((r) => {
            const n = toNumber(r[c.key]);
            if (Number.isNaN(n)) return null;
            return c.pct && Math.abs(n) <= 1 && !String(r[c.key]).includes('%') ? n * 100 : n;
          }),
        };
      }),
    };
    // Màu riêng của từng cột (từng khúc với cột chồng): khóa là "tên chuỗi::danh mục", thắng màu chuỗi và màu logo
    if (['bar', 'rankBar', 'divBar', 'combo', 'stackedBar'].includes(spec.id)) {
      wideOut.series.forEach((sr) => {
        if (sr.kind === 'line') return;
        const own = xsAll.map((x) => { const k = barColorKey(sr.name, x); return colors[k] && colors[k].start ? resolveColor(colors, k, { start: sr.start, end: sr.end }) : null; });
        if (own.some(Boolean)) sr.catColors = xsAll.map((x, i) => own[i] || (sr.catColors && sr.catColors[i]) || null);
      });
    }
    return wideOut;
  }

  if (spec.id === 'line') {
    const xs = [];
    const names = [];
    const map = new Map();
    for (const r of valid) {
      if (isBlank(r.x ?? r.category) || isBlank(r.series)) continue;
      const x = String(r.x ?? r.category).trim();
      const s = String(r.series).trim();
      if (!xs.includes(x)) xs.push(x);
      if (!names.includes(s)) names.push(s);
      const n = toNumber(r.value);
      map.set(`${s}|${x}`, Number.isNaN(n) ? null : n);
    }
    return {
      xs,
      series: names.map((name, i) => {
        const p = resolveColor(colors, name, defaultGrad(i));
        return {
          name,
          start: p.start, mid: p.mid, dir: p.dir,
          end: p.end,
          values: xs.map((x) => (map.has(`${name}|${x}`) ? map.get(`${name}|${x}`) : null)),
        };
      }),
    };
  }

  if (spec.id === 'rangeDot') {
    const num = (v) => { const n = toNumber(v); return Number.isNaN(n) ? null : n; };
    return {
      range: valid.filter((r) => !isBlank(r.category)).map((r) => ({
        label: String(r.category).trim(), low: num(r.low), mid: num(r.mid), high: num(r.high), cur: num(r.current),
      })),
    };
  }

  const items = [];
  const vcol = ['pie', 'bar', 'rankBar', 'divBar'].includes(spec.id) ? pieValueCol(spec) : { key: 'value' };
  for (const r of valid) {
    if (isBlank(r.category)) continue;
    let n = toNumber(r[vcol.key]);
    if (Number.isNaN(n)) continue;
    // Cột chọn kiểu % : ô nhập 0.35 hiểu là 35%
    if (vcol.pct && Math.abs(n) <= 1 && !String(r[vcol.key]).includes('%')) n *= 100;
    const label = String(r.category).trim();
    // Thanh tăng/giảm: xanh cho giá trị dương, đỏ cho giá trị âm
    const fallback = spec.id === 'divBar' ? (n >= 0 ? DIV_POS : DIV_NEG) : spec.id === 'bar' ? defaultGrad(0) : defaultGrad(items.length);
    // Cột đơn: màu riêng của danh mục > màu chung "Tất cả các cột" > màu mặc định
    const colorKey = label;
    const barBase = spec.id === 'bar' ? resolveColor(colors, BAR_KEY, fallback) : null;
    const own = colors[label] && colors[label].start;
    const p = pickBrand(brand, label, colors, colorKey, spec.id === 'bar' && !own ? barBase : resolveColor(colors, colorKey, fallback));
    items.push({ label, value: n, start: p.start, mid: p.mid, dir: p.dir, end: p.end });
  }
  return { items, pct: !!vcol.pct };
}

// Danh sách các đối tượng có thể đổi màu ở bước 5
export function colorTargets(spec, rows) {
  if (spec.id === 'rangeDot') return [];
  const data = prepareData(spec, rows, {});
  if (['bar', 'rankBar', 'divBar', 'combo', 'stackedBar'].includes(spec.id) && data.series) {
    // Màu từng chuỗi, rồi màu riêng của từng cột (từng khúc) trong mỗi chuỗi dạng cột
    const real = data.series.filter((s) => s.kind !== 'total');
    const out = real.map((s) => ({ key: s.name, name: s.name, fallback: s.start, fallbackEnd: s.end }));
    real.forEach((s) => {
      if (s.kind === 'line') return;
      data.xs.forEach((x) => out.push({ key: barColorKey(s.name, x), name: x, bar: true, group: s.name, fallback: s.start, fallbackEnd: s.end }));
    });
    return out;
  }
  if ((spec.id === 'pie' || spec.id === 'rankBar' || spec.id === 'divBar') && data.items) {
    return data.items.map((it) => ({ key: it.label, name: it.label, fallback: it.start, fallbackEnd: it.end }));
  }
  if (spec.id === 'bar' && data.items) {
    return [{ key: BAR_KEY, name: 'Tất cả các cột', fallback: defaultGrad(0).start, fallbackEnd: defaultGrad(0).end }]
      .concat(data.items.map((it) => ({ key: it.label, name: it.label, fallback: it.start, fallbackEnd: it.end })));
  }
  if (spec.id === 'lineRank' || spec.id === 'barRace') {
    return data.entities.slice(0, 12).map((e) => ({ key: e.name, name: e.name, fallback: e.start, fallbackEnd: e.end }));
  }
  return data.series.map((s) => ({ key: s.name, name: s.name, fallback: s.start, fallbackEnd: s.end }));
}

export function slugify(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// date dạng YYYY-MM-DD, filename không có đuôi
export function nqsUrl(date, filename) {
  const [y, m, d] = date.split('-');
  return `https://nqs.1cdn.vn/${y}/${m}/${d}/${filename}.svg`;
}

// Có kích thước biểu đồ thì khung nhúng tự co theo bề rộng bài viết và giữ đúng tỉ lệ (không bị cắt đáy)
export function embedCode(url, width, height) {
  const w = Number(width);
  const h = Number(height);
  if (w > 0 && h > 0) {
    // Giữ tỉ lệ bằng padding-bottom (hệ thống bài viết hay xóa aspect-ratio); cao ÷ rộng × 100
    const pct = Math.round(h / w * 10000) / 100;
    return `<figure style="margin:0"><div style="position:relative;width:100%;max-width:${w}px;padding-bottom:${pct}%"><object type="image/svg+xml" data="${url}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"></object></div></figure>`;
  }
  return `<object type="image/svg+xml" data="${url}"></object>`;
}

export function buildPayload(spec, settings, options, rows, colors = {}, logos = {}, brand = {}) {
  // Màu thương hiệu chỉ có tác dụng khi đang bật Dùng Logo và đã chọn dùng màu logo
  const brandOn = settings.useLogo && settings.useBrandColor ? brand : {};
  const data = prepareData(spec, rows, colors, brandOn, options);
  const theme = themeOf(settings);
  // Cột cạnh nhau / Cột chồng có chuỗi chọn "Đường" thì vẽ bằng bộ vẽ Kết hợp (cột + đường)
  const hasLine = Array.isArray(data.series) && data.series.some((s) => s.kind === 'line');
  // Cột tăng/giảm: so sánh hai cột giá trị (kỳ này và kỳ gốc), tính phần trăm thay đổi cho từng danh mục
  const cc = settings.changeCol;
  if (cc && cc.on && Array.isArray(data.series)) {
    const nameOf = (id) => { const c = spec.columns.find((x) => x.key === id); return c ? c.label : null; };
    const sCur = data.series.find((s) => s.name === nameOf(cc.curId));
    const sBase = data.series.find((s) => s.name === nameOf(cc.baseId));
    if (sCur && sBase && sCur !== sBase) {
      data.changes = {
        title: cc.title || 'Tăng/giảm',
        values: data.xs.map((_, i) => {
          const a = sCur.values[i];
          const b = sBase.values[i];
          if (a === null || a === undefined || b === null || b === undefined || b === 0) return null;
          return (a - b) / Math.abs(b) * 100;
        }),
      };
    }
  }
  // Thanh xếp hạng có nhiều cột giá trị: vẽ như cột cạnh nhau (thanh xếp hạng luôn ngang)
  const rankMulti = (spec.id === 'rankBar' || spec.id === 'bar' || spec.id === 'divBar') && Array.isArray(data.series);
  const drawType = rankMulti ? 'groupedBar' : (spec.id === 'groupedBar' || spec.id === 'stackedBar') && hasLine ? 'combo' : spec.id;
  const payload = {
    type: drawType,
    settings: {
      width: Number(settings.width),
      height: Number(settings.height) > 0 ? Math.min(3000, Math.max(300, Number(settings.height))) : 1000,
      autoHeight: false,
      title: settings.title || '',
      subtitle: settings.subtitle || '',
      description: settings.description ?? DEFAULT_DESCRIPTION,
      showAxes: settings.showAxes !== false,
      showGrid: settings.showGrid !== false,
      brandLogo: settings.showBrandLogo === false ? null : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(NQS_LOGO_SVG),
      brandLogoRatio: NQS_LOGO_RATIO,
      interactions: settings.interactions || {},
      titleColor: settings.titleColor || null,
      textColor: settings.textColor || null,
      insideColor: settings.insideColor || null,
      titleSize: settings.titleSize || 35,
      labelSize: settings.labelSize || 16,
      dataSize: settings.dataSize || 18,
      lineLabelColor: settings.lineLabelColor || null,
    },
    options: rankMulti ? { ...options, orientation: spec.id === 'rankBar' || spec.id === 'divBar' ? 'horizontal' : options.orientation, showLegend: true, labelInside: false } : options,
    theme,
    data,
    logos: settings.useLogo ? logos : {},
  };
  return payload;
}

// Giao diện sáng/tối, cho phép ghi đè màu nền biểu đồ bằng settings.bgColor
function themeOf(settings) {
  const base = common.theme[settings.theme] ?? common.theme.light;
  return settings.bgColor ? { ...base, background: settings.bgColor } : base;
}

// Chiều cao thực của biểu đồ: người dùng nhập thì dùng số đó, để trống thì đo bằng cách vẽ thử (tự dãn đủ nội dung)
export function resolveHeight(spec, settings, options, rows, colors = {}, logos = {}, brand = {}) {
  const given = Number(settings.height);
  if (given > 0) return Math.min(3000, Math.max(300, given));
  const fallback = Math.round(Number(settings.width) || 1000);
  if (typeof document === 'undefined') return fallback;
  const payload = buildPayload(spec, { ...settings, height: 1000 }, options, rows, colors, logos, brand);
  payload.settings.autoHeight = true;
  const w = payload.settings.width;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:' + w + 'px;height:1000px;overflow:hidden';
  host.innerHTML = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' 1000" width="' + w + '" height="1000">',
    '<g id="chart"></g>',
    '<g id="tip" visibility="hidden"><rect id="tip-bg" width="10" height="10"/><text id="tip-text"></text></g>',
    '</svg>',
  ].join('');
  document.body.appendChild(host);
  let h = fallback;
  try {
    runtime(Object.assign(JSON.parse(JSON.stringify(payload)), { isStatic: true }));
    const vb = host.querySelector('svg').getAttribute('viewBox').split(' ');
    h = Math.round(Number(vb[3])) || fallback;
  } catch (e) {
    h = fallback;
  } finally {
    document.body.removeChild(host);
  }
  return h;
}

export function buildSvgDocument(spec, settings, options, rows, colors = {}, logos = {}, brand = {}) {
  if (!(Number(settings.height) > 0)) {
    settings = { ...settings, height: resolveHeight(spec, settings, options, rows, colors, logos, brand) };
  }
  const payload = buildPayload(spec, settings, options, rows, colors, logos, brand);
  const theme = themeOf(settings);
  // Escape để dữ liệu không thể đóng thẻ script
  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  const w = payload.settings.width;
  const h = payload.settings.height;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="max-width:100%;height:auto;background:${theme.background}">`,
    "<defs><style>@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&amp;display=swap');</style></defs>",
    '<g id="chart"></g>',
    '<g id="tip" visibility="hidden" pointer-events="none"><rect id="tip-bg" rx="6" fill="#0F172A" fill-opacity="0.92" width="10" height="10"/><text id="tip-text" fill="#F8FAFC" font-size="14" font-family="Be Vietnam Pro, Arial, sans-serif"></text></g>',
    `<script><![CDATA[(function(){try{(${runtime.toString()})(${json});}catch(e){var c=document.getElementById('chart');if(c){c.textContent='Lỗi vẽ biểu đồ: '+e.message;}}})();]]></script>`,
    '</svg>',
  ].join('\n');
}

// Hàm này được đưa nguyên văn vào file SVG. Không dùng biến bên ngoài, chỉ nhận DATA.
function runtime(DATA) {
  var NS = 'http://www.w3.org/2000/svg';
  var FONT = "'Be Vietnam Pro', Arial, sans-serif";
  var TXT = DATA.settings.textColor || null;
  var LBLN = DATA.settings.lineLabelColor || TXT || DATA.theme.label;
  var INS = DATA.settings.insideColor || '#FFFFFF';
  var TSZ0 = DATA.settings.titleSize || 35;
  var LS0 = DATA.settings.labelSize || 16; // cỡ chữ nhãn: đúng bằng số người dùng nhập
  var DS0 = DATA.settings.dataSize || 18; // cỡ chữ số liệu
  var TSZ = TSZ0, LS = LS0, DS = DS0;
  var fontK = 1; // hệ số phóng chữ khi xem trên màn hình nhỏ (điện thoại)

  // Biểu đồ co theo bề rộng màn hình; trên điện thoại (hiển thị < 55% kích thước gốc) thì dùng cỡ chữ lớn hơn.
  function applyFontScale() {
    if (DATA.isStatic) return false;
    var svgEl = document.documentElement;
    var rw = 0;
    try { rw = svgEl.getBoundingClientRect().width; } catch (e) { rw = 0; }
    var sc = rw > 0 ? rw / DATA.settings.width : 1;
    // Điện thoại: tiêu đề 35 -> 45, nhãn 16 -> 22, số liệu 18 -> 28 (tỉ lệ theo cỡ người dùng chọn)
    var mobile = sc < 0.55;
    var k = mobile ? 1 : 0;
    var changed = k !== fontK;
    fontK = k;
    TSZ = mobile ? Math.round(TSZ0 * 45 / 35) : TSZ0;
    LS = mobile ? Math.round(LS0 * 22 / 16) : LS0;
    DS = mobile ? Math.round(DS0 * 28 / 18) : DS0;
    return changed;
  }
  var S = DATA.settings;
  var O = DATA.options || {};
  var T = DATA.theme;
  var D = DATA.data;
  var W = S.width;
  var H = S.height;
  var IX = S.interactions || {};
  var root = document.getElementById('chart');
  var tip = document.getElementById('tip');
  var tipBg = document.getElementById('tip-bg');
  var tipText = document.getElementById('tip-text');
  var svgRoot = root.ownerSVGElement;
  var zoomOn = !!IX.zoomPan && DATA.type === 'line';
  var dp = O.decimalPlaces != null ? O.decimalPlaces : 0;
  var unit = O.valueUnit ? ' ' + O.valueUnit : '';
  var hidden = {};
  var view = { s: 0, e: 1 };
  var PLOT = null;
  var drag = null;
  var lastHL = null;
  var bottomY = H;
  var DEFS = null;
  var gradN = 0;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) {
      if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  // Cột chỉ bo góc ở đầu cột (phía giá trị), chân cột vuông
  function barEl(a, vertical, positive, parent) {
    var x = a.x, y = a.y, w = a.width, h = a.height;
    var r = Math.max(0, Math.min(6, w / 2, h));
    var d;
    if (vertical) {
      d = positive
        ? 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z'
        : 'M' + x + ' ' + y + 'V' + (y + h - r) + 'Q' + x + ' ' + (y + h) + ' ' + (x + r) + ' ' + (y + h) + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w) + ' ' + (y + h - r) + 'V' + y + 'Z';
    } else {
      d = positive
        ? 'M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z'
        : 'M' + (x + w) + ' ' + y + 'H' + (x + r) + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + x + ' ' + (y + h) + ' ' + (x + r) + ' ' + (y + h) + 'H' + (x + w) + 'Z';
    }
    var attrs = { d: d, 'data-bar': vertical ? 'v' : 'h', 'data-pos': positive ? 1 : 0 };
    for (var k in a) if (k !== 'x' && k !== 'y' && k !== 'width' && k !== 'height' && k !== 'rx') attrs[k] = a[k];
    return el('path', attrs, parent);
  }

  function label(str, attrs, parent) {
    var a = attrs;
    if (a && a['font-size'] !== undefined && !a['data-raw']) {
      var isNum = /\d/.test(String(str)) && /^[\s\d.,%+\-−–()]+$/.test(String(str));
      a = Object.assign({}, a, { 'font-size': (a['data-inside'] || isNum) ? DS : LS });
    }
    var t = el('text', Object.assign({ 'font-family': FONT, fill: TXT || T.label }, a), parent);
    t.textContent = str;
    return t;
  }

  // Trả về giá trị fill: màu đơn, hoặc url gradient (từ dưới lên trên)
  function paint(o) {
    if (!o.end || o.end === o.start) return o.start;
    var id = 'grad' + gradN++;
    var g = el('linearGradient', o.dir === 'h' ? { id: id, x1: 0, y1: 0, x2: 1, y2: 0 } : { id: id, x1: 0, y1: 1, x2: 0, y2: 0 }, DEFS);
    el('stop', { offset: 0, 'stop-color': o.start }, g);
    if (o.mid) el('stop', { offset: 0.5, 'stop-color': o.mid }, g);
    el('stop', { offset: 1, 'stop-color': o.end }, g);
    return 'url(#' + id + ')';
  }

  // Màu số liệu bên trong cột: nếu người dùng đã chọn thì dùng màu đó, nếu không thì tự chọn
  // trắng hoặc đen cho dễ đọc trên màu nền của chuỗi/danh mục
  function inkFor(o) {
    if (DATA.settings.insideColor) return DATA.settings.insideColor;
    var cs = [o.start, o.end, o.mid].filter(function (c) { return !!c; });
    var L = 0;
    cs.forEach(function (c) {
      var n = parseInt(String(c).slice(1), 16);
      L += (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    });
    L = cs.length ? L / cs.length : 1;
    return L > 0.62 ? '#1E293B' : '#FFFFFF';
  }

  // Số liệu gốc: hiện đúng như đã nhập, không làm tròn (chỉ loại bỏ nhiễu dấu phẩy động khi cộng/trừ)
  function fmt(v) {
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    n = parseFloat(n.toPrecision(12));
    if (n === 0) n = 0;
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 10 });
  }

  // Cỡ chữ số nằm trong cột: giữ cỡ số liệu, nhưng thu nhỏ nếu chữ rộng hơn cột (tối thiểu 9)
  function fitFs(txt, w) {
    var need = String(txt).length * DS * 0.6;
    if (need <= w - 8) return DS;
    return Math.max(9, Math.floor((w - 8) / (String(txt).length * 0.6)));
  }

  // Số tính ra (phần trăm, tỷ trọng, tăng/giảm): làm tròn theo d chữ số, bỏ số 0 thừa (20,0 -> 20)
  function fmtR(v, d) {
    var n = Number(v);
    if (Math.abs(n) < Math.pow(10, -(d || 0)) / 2) n = 0;
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: d });
  }

  // Số trên trục: giữ cố định số chữ số thập phân để các mốc đều nhau (0,5 / 1,0 / 1,5)
  function fmtFix(v, d) {
    var n = Number(v);
    if (Math.abs(n) < Math.pow(10, -(d || 0)) / 2) n = 0;
    return n.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  // Tooltip gộp: tiêu đề là mốc/danh mục, mỗi dòng sau là một chuỗi đang hiển thị và giá trị tại mốc đó
  // withShare (cột/vùng chồng tỷ trọng): thêm phần trăm trong tổng
  function tipAll(ci, cat, withShare) {
    var NLc = String.fromCharCode(10);
    var sers = D.series.filter(function (s) { return !hidden[s.name]; });
    var total = 0;
    sers.forEach(function (s) { var v = s.values[ci]; if (s.kind !== 'total' && v !== null && v !== undefined && v > 0) total += v; });
    var out = [String(cat)];
    sers.forEach(function (s) {
      var v = s.values[ci];
      if (v === null || v === undefined) return;
      var txt = fmt(v, dp) + (s.pct ? '%' : unit);
      if (withShare && O.percent && total > 0 && v > 0) txt += ' (' + fmtR(v / total * 100, dp) + '%)';
      out.push(s.name + ': ' + txt);
    });
    return out.join(NLc);
  }

  // Biểu đồ thanh ngang: lề trái vừa đủ cho tên danh mục dài nhất (hoặc logo), để tên dài nhất thẳng hàng với tiêu đề (x = 30)
  function hLabelX0(labels) {
    var w = 40;
    labels.forEach(function (l) {
      var lw = logoOf(l) ? 112 : String(l).length * LS * 0.6;
      if (lw > w) w = lw;
    });
    return Math.min(330, Math.round(30 + w + 14));
  }

  // Khoảng cách cố định (6px) giữa đầu cột và nhãn số, tính theo cỡ chữ số liệu: dùng cho cả cột dương lẫn cột âm
  function lblH() { return 6 + Math.round(DS * 0.75); }

  function dpOf(v) {
    return Number.isInteger(v) ? 0 : 2;
  }

  function decOf(step) {
    return Math.min(4, Math.max(0, -Math.floor(Math.log(step) / Math.LN10)));
  }

  // Lề trái (px) đủ rộng cho số trên trục dọc: tính theo số ký tự dài nhất và cỡ chữ số liệu
  function axisPad(d) {
    var longest = 0;
    ticksOf(d).forEach(function (t) {
      var len = fmtFix(t, decOf(d.step)).length;
      if (len > longest) longest = len;
    });
    return Math.max(80, Math.ceil(longest * DS * 0.6 + 20));
  }

  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var exp = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / exp;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
  }

  function domainFor(vals, zeroBase) {
    var mn = Math.min.apply(null, vals);
    var mx = Math.max.apply(null, vals);
    if (mn === mx) mx = mn + 1;
    var pad = (mx - mn) * 0.08;
    var lo = zeroBase ? Math.min(0, mn) : mn - pad;
    var hi = mx + pad;
    var step = niceStep((hi - lo) / 5);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    return { lo: lo, hi: hi, step: step };
  }

  // Hai trục (trái/phải) dùng chung đường 0: cùng số vạch dương và cùng số vạch âm.
  // Chọn (P vạch dương, N vạch âm) và bước đẹp cho từng trục sao cho ít khoảng trống thừa nhất.
  function alignZero(a, b) {
    var anyNeg = a.lo < 0 || b.lo < 0;
    var best = null;
    for (var N = anyNeg ? 1 : 0; N <= 5; N++) {
      for (var P = 1; P <= 8; P++) {
        if (P + N < 4 || P + N > 9) continue;
        var cost = 0;
        var steps = [];
        [a, b].forEach(function (d) {
          var need = Math.max(d.hi / P, N ? -d.lo / N : 0);
          var st = niceStep(need);
          steps.push(st);
          cost += (P + N) * st / Math.max(1e-9, d.hi - d.lo);
        });
        if (!best || cost < best.cost - 1e-9) best = { cost: cost, P: P, N: N, steps: steps };
      }
    }
    if (!best) return [a, b];
    return [a, b].map(function (d, i) {
      var st = best.steps[i];
      return { lo: -best.N * st, hi: best.P * st, step: st };
    });
  }

  function ticksOf(d) {
    var out = [];
    for (var i = Math.round(d.lo / d.step); i <= Math.round(d.hi / d.step); i++) out.push(i * d.step);
    return out;
  }

  function noData(g) {
    label('Không có dữ liệu hiển thị', { x: W / 2, y: H / 2, 'text-anchor': 'middle', 'font-size': 16 }, g);
  }

  function legendEntries() {
    if (DATA.type === 'barRace' || DATA.type === 'lineRank') return [];
    if (DATA.type === 'pie') return D.items.map(function (it) { return { name: it.label, color: paint(it) }; });
    if (DATA.type === 'bar' || DATA.type === 'rankBar' || DATA.type === 'divBar') return [];
    if (DATA.type === 'rangeDot') {
      return [
        { name: O.bandLabel || 'Khoảng tứ phân vị', color: T.grid, shape: 'rect' },
        { name: O.midLabel || 'Trung vị', color: T.label, shape: 'dot' },
        { name: O.curLabel || 'Hiện tại', color: RANGE_CUR, shape: 'tri' },
      ];
    }
    return D.series.filter(function (s) { return s.kind !== 'total'; }).map(function (s) { return { name: s.name, color: paint(s.legendObj || s) }; });
  }

  function wrapText(str, size, bold, maxW, parent) {
    var probe = el('text', { 'font-family': FONT, 'font-size': size, 'font-weight': bold ? 'bold' : 'normal', visibility: 'hidden' }, parent);
    function width(t) {
      probe.textContent = t;
      var w = 0;
      try { w = probe.getComputedTextLength(); } catch (e) { w = 0; }
      return w > 0 ? w : t.length * size * (bold ? 0.6 : 0.55);
    }
    var out = [];
    String(str).split(String.fromCharCode(10)).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean);
      var cur = '';
      words.forEach(function (w) {
        var test = cur ? cur + ' ' + w : w;
        if (cur && width(test) > maxW) { out.push(cur); cur = w; } else cur = test;
      });
      out.push(cur);
    });
    parent.removeChild(probe);
    return out.length ? out : [''];
  }

  function drawHeader(g) {
    var y = 28 + Math.round(TSZ * 1.1); // chừa lề trên theo cỡ tiêu đề
    // Logo nằm ở 1/3 bên phải, căn phải theo mép biểu đồ, giữa theo chiều dọc với dòng tiêu đề đầu tiên
    if (S.brandLogo) {
      var lgW = Math.round(Math.min(300, W * 0.25));
      var lgH = Math.round(lgW / S.brandLogoRatio);
      var lgY = Math.max(10, Math.round(y - TSZ * 0.35 - lgH / 2) + 12);
      el('image', { href: S.brandLogo, x: W - 30 - lgW, y: lgY, width: lgW, height: lgH, preserveAspectRatio: 'xMaxYMid meet' }, g);
    }
    if (S.title) {
      // Tiêu đề căn trái, rộng tối đa khoảng 2/3 biểu đồ, dài hơn thì xuống dòng
      var tLines = wrapText(S.title, TSZ, true, Math.round(W * 0.67) - 30, g);
      tLines.forEach(function (ln, li) {
        label(ln, { x: 30, y: y, 'font-size': TSZ, 'font-weight': 'bold', fill: S.titleColor || T.label, 'data-raw': 1 }, g);
        // Dòng cuối: khoảng cách xuống dòng đơn vị gọn hơn khoảng cách giữa các dòng tiêu đề
        y += li === tLines.length - 1 ? Math.round(TSZ * 0.3 + LS * 1.1) + 12 : Math.round(TSZ * 1.2);
      });
    }
    if (S.subtitle) {
      label(S.subtitle, { x: 30, y: y, 'font-size': 15, fill: TXT || T.axis }, g);
      y += Math.round(LS * 1.0); // khoảng cách theo cỡ chữ
    }
    var entries = O.showLegend !== false ? legendEntries() : [];
    if (entries.length) {
      var fsz = LS;
      var lineH = fsz * 1.6 + 8;
      var x = 30;
      y += 8 + Math.round(LS * 0.5);
      entries.forEach(function (en) {
        var sw = Math.max(14, Math.round(LS * 0.7)); // ô màu tăng theo cỡ chữ
        var itemW = sw + 8 + String(en.name).length * fsz * 0.6 + 30;
        if (x > 30 && x + itemW > W - 30) {
          x = 30;
          y += lineH;
        }
        var item = el('g', {
          'data-legend': en.name,
          opacity: hidden[en.name] ? 0.35 : 1,
          cursor: IX.legendToggle ? 'pointer' : 'default',
        }, g);
        var sy = Math.round(y - LS * 0.4 - sw / 2);
        if (en.shape === 'dot') el('circle', { cx: x + sw / 2, cy: sy + sw / 2, r: sw / 2, fill: en.color }, item);
        else if (en.shape === 'tri') el('polygon', { points: [[x + sw / 2, sy], [x + sw, sy + sw], [x, sy + sw]].map(function (q) { return q.join(','); }).join(' '), fill: en.color }, item);
        else el('rect', { x: x, y: sy, width: sw, height: sw, rx: 4, fill: en.color }, item);
        label(en.name, { x: x + sw + 8, y: y, 'font-size': 14 }, item);
        x += itemW;
      });
      y += 10;
    }
    return y + 22;
  }

  function drawLegend(g, x, y, entries) {
    return;
    entries.forEach(function (en, i) {
      var row = el('g', {
        'data-legend': en.name,
        opacity: hidden[en.name] ? 0.35 : 1,
        cursor: IX.legendToggle ? 'pointer' : 'default',
      }, g);
      el('rect', { x: x, y: y + i * 24, width: 14, height: 14, rx: 3, fill: en.color }, row);
      label(en.name, { x: x + 22, y: y + i * 24 + 12, 'font-size': 14 }, row);
    });
  }

  function drawAxisY(g, d, x0, x1, y0, y1, horizontal) {
    ticksOf(d).forEach(function (t) {
      var p = horizontal ? x0 + (t - d.lo) / (d.hi - d.lo) * (x1 - x0) : y1 - (t - d.lo) / (d.hi - d.lo) * (y1 - y0);
      if (S.showGrid) {
        if (horizontal) el('line', { x1: p, y1: y0, x2: p, y2: y1, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
        else el('line', { x1: x0, y1: p, x2: x1, y2: p, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
      }
      if (S.showAxes) {
        if (horizontal) label(fmtFix(t, decOf(d.step)), { x: p, y: y1 + 20, 'text-anchor': 'middle', 'font-size': 12, fill: TXT || T.axis }, g);
        else label(fmtFix(t, decOf(d.step)), { x: x0 - 8, y: p + 4, 'text-anchor': 'end', 'font-size': 12, fill: TXT || T.axis }, g);
      }
    });
  }

  function drawPie(g, top) {
    var showLegend = O.showLegend !== false;
    var legendW = 0;
    var items = D.items.filter(function (it) { return !hidden[it.label]; });
    var total = items.reduce(function (s, it) { return s + it.value; }, 0);
    var areaW = W - legendW - 40;
    var areaH = bottomY - top;
    var r = Math.max(20, Math.min(areaW, areaH) / 2 - 36);
    var cx = 20 + areaW / 2;
    var cy = top + areaH / 2;

    if (total > 0) {
      var a = (O.startAngle || 0) * Math.PI / 180 - Math.PI / 2;
      items.forEach(function (it) {
        var frac = it.value / total;
        var a1 = a + frac * 2 * Math.PI;
        var mid = (a + a1) / 2;
        var off = O.highlightCategory === it.label ? 14 : 0;
        var ox = off * Math.cos(mid);
        var oy = off * Math.sin(mid);
        var tipRaw = it.label + '\n' + fmt(it.value, dpOf(it.value)) + '\n' + fmtR(frac * 100, 1) + '%';
        var attrs = { fill: paint(it), stroke: T.background, 'stroke-width': 2, 'data-g': it.label, 'data-tip': tipRaw };
        if (items.length === 1) {
          el('circle', Object.assign({ cx: cx, cy: cy, r: r }, attrs), g);
          if (O.shape === 'donut') el('circle', { cx: cx, cy: cy, r: r * 0.58, fill: T.background }, g);
        } else {
          var large = a1 - a > Math.PI ? 1 : 0;
          var x0 = cx + ox + r * Math.cos(a);
          var y0 = cy + oy + r * Math.sin(a);
          var x1 = cx + ox + r * Math.cos(a1);
          var y1 = cy + oy + r * Math.sin(a1);
          var d;
          if (O.shape === 'donut') {
            var ri = r * 0.58;
            var ix1 = cx + ox + ri * Math.cos(a1);
            var iy1 = cy + oy + ri * Math.sin(a1);
            var ix0 = cx + ox + ri * Math.cos(a);
            var iy0 = cy + oy + ri * Math.sin(a);
            d = 'M' + x0 + ' ' + y0 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' L' + ix1 + ' ' + iy1 + ' A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + ix0 + ' ' + iy0 + ' Z';
          } else {
            d = 'M' + (cx + ox) + ' ' + (cy + oy) + ' L' + x0 + ' ' + y0 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + ' Z';
          }
          el('path', Object.assign({ d: d }, attrs), g);
        }
        if (O.showLabels !== false && frac > 0.04) {
          var lr = r * 0.62;
          var txt = O.showAs === 'value' ? fmt(it.value, dpOf(it.value)) + (D.pct ? '%' : '') : fmtR(frac * 100, 1) + '%';
          label(txt, {
            x: cx + ox + lr * Math.cos(mid),
            y: cy + oy + lr * Math.sin(mid),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': 13,
            'font-weight': 'bold',
            fill: inkFor(it),
            'data-inside': 1,
            'pointer-events': 'none',
          }, g);
        }
        a = a1;
      });
      if (O.shape === 'donut') {
        label(fmt(total, dp), { x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 'bold' }, g);
        label(O.centerLabel || 'Tổng', { x: cx, y: cy + 22, 'text-anchor': 'middle', 'font-size': 12, fill: TXT || T.axis }, g);
      }
    } else {
      noData(g);
    }

    if (showLegend) {
      drawLegend(g, W - legendW + 10, top + 10, D.items.map(function (it) {
        return { name: it.label, color: paint(it) };
      }));
    }
  }

  function drawBar(g, top) {
    var items = D.items.slice();
    if (O.sort === 'asc') items.sort(function (a, b) { return a.value - b.value; });
    if (O.sort === 'desc' || DATA.type === 'rankBar' || DATA.type === 'divBar') items.sort(function (a, b) { return b.value - a.value; });
    if (items.length === 0) { noData(g); return; }

    var horizontal = O.orientation === 'horizontal' || DATA.type === 'rankBar' || DATA.type === 'divBar';
    var x0 = horizontal ? hLabelX0(items.map(function (i) { return i.label; })) : 80;
    var x1 = W - 30;
    var y0 = top;
    var y1 = bottomY - 34 - (horizontal ? 0 : rotExtra(items.map(function (i) { return i.label; }), W - 110));
    var d = domainFor(items.map(function (i) { return i.value; }), O.startAtZero !== false);
    if (!horizontal) x0 = Math.max(x0, axisPad(d));
    var span = d.hi - d.lo;
    function mapV(v) {
      return horizontal ? x0 + (v - d.lo) / span * (x1 - x0) : y1 - (v - d.lo) / span * (y1 - y0);
    }
    var band = horizontal ? (y1 - y0) / items.length : (x1 - x0) / items.length;
    var bw = band * 0.62;
    var base = mapV(Math.max(d.lo, Math.min(d.hi, 0)));

    drawAxisY(g, d, x0, x1, y0, y1, horizontal);
    if (S.showAxes) {
      if (horizontal) el('line', { x1: base, y1: y0, x2: base, y2: y1, stroke: T.axis }, g);
      else el('line', { x1: x0, y1: base, x2: x1, y2: base, stroke: T.axis }, g);
    }

    items.forEach(function (it, i) {
      var tipRaw = it.label + '\n' + fmt(it.value, dp) + (D.pct ? '%' : unit);
      var show = O.showLabels !== false;
      if (horizontal) {
        var c0 = y0 + band * i + (band - bw) / 2;
        var px = mapV(it.value);
        barEl({ x: Math.min(base, px), y: c0, width: Math.abs(px - base), height: bw, fill: paint(it), 'data-g': it.label, 'data-tip': tipRaw }, false, it.value >= 0, g);
        var lgH = logoOf(it.label);
        if (lgH) {
          var lhH = Math.max(20, Math.min(bw, 40));
          el('image', { href: lgH, x: x0 - 122, y: c0 + bw / 2 - lhH / 2, width: 110, height: lhH, preserveAspectRatio: 'xMidYMid meet' }, g);
        }
        else label(it.label, { x: x0 - 8, y: c0 + bw / 2 + 5, 'text-anchor': 'end', 'font-size': 13 }, g);
        if (show) {
          label(fmt(it.value, dp) + (D.pct ? '%' : unit), {
            x: px + (it.value >= 0 ? 6 : -6),
            y: c0 + bw / 2 + 5,
            'text-anchor': it.value >= 0 ? 'start' : 'end',
            'font-size': 13,
          }, g);
        }
      } else {
        var cx0 = x0 + band * i + (band - bw) / 2;
        var py = mapV(it.value);
        barEl({ x: cx0, y: Math.min(base, py), width: bw, height: Math.abs(py - base), fill: paint(it), 'data-g': it.label, 'data-tip': tipRaw }, true, it.value >= 0, g);
        catLabel(it.label, cx0 + bw / 2, y1 + 10 + LS, band, { 'font-size': 13 }, g);
        if (show) {
          label(fmt(it.value, dp) + (D.pct ? '%' : unit), {
            x: cx0 + bw / 2,
            y: it.value >= 0 ? (O.labelInside ? py + lblH() : py - 6) : (O.labelInside ? py - 6 : py + lblH()),
            'text-anchor': 'middle',
            'font-size': O.labelInside ? fitFs(fmt(it.value, dp) + (D.pct ? '%' : unit), bw) : 13,
            'data-raw': O.labelInside ? 1 : undefined,
            fill: O.labelInside ? inkFor(it) : (TXT || T.label),
            'data-inside': O.labelInside ? 1 : undefined,
          }, g);
        }
      }
    });
  }

  function drawGrouped(g, top) {
    var showLegend = O.showLegend !== false;
    var legendW = 0;
    var horizontal = O.orientation === 'horizontal';
    var maxCat = 0;
    D.xs.forEach(function (c) { if (String(c).length > maxCat) maxCat = String(c).length; });
    // Cột ngang: chừa bên trái đủ chỗ cho tên danh mục hoặc logo (logo rộng tới 110)
    var x0 = horizontal ? hLabelX0(D.xs) : 80;
    var chg = horizontal && D.changes ? D.changes : null;
    var chgW = chg ? Math.max(120, Math.round(LS * 7.5)) : 0;
    var x1 = horizontal ? W - 80 - (chg ? chgW + Math.round(DS * 3) - 50 : 0) : W - 30 - legendW;
    // Tiêu đề cột tăng/giảm xuống dòng trong bề rộng cột, chừa chỗ phía trên khung vẽ
    var chgLines = chg ? wrapText(chg.title, 13, true, chgW - 8, g) : null;
    var y0 = top + (chg ? chgLines.length * (LS + 2) + 12 : 0);
    var y1 = bottomY - 34 - (horizontal ? 0 : rotExtra(D.xs, x1 - x0));
    var visible = D.series.filter(function (s) { return !hidden[s.name]; });
    var vals = [];
    visible.forEach(function (s) {
      s.values.forEach(function (v) { if (v !== null) vals.push(v); });
    });

    if (vals.length === 0 || D.xs.length === 0) {
      noData(g);
    } else if (horizontal) {
      var dh = domainFor(vals, O.startAtZero !== false);
      var spanH = dh.hi - dh.lo;
      var mapX = function (v) { return x0 + (v - dh.lo) / spanH * (x1 - x0); };
      var baseX = mapX(Math.max(dh.lo, Math.min(dh.hi, 0)));
      drawAxisY(g, dh, x0, x1, y0, y1, true);
      if (S.showAxes) el('line', { x1: baseX, y1: y0, x2: baseX, y2: y1, stroke: T.axis }, g);

      var nH = D.xs.length;
      var bandH = (y1 - y0) / nH;
      var innerH = bandH * 0.86;
      var bhH = innerH / Math.max(1, visible.length);
      // Nhãn số của từng thanh không được cao hơn thanh, nếu không các số của hai thanh liền nhau đè lên nhau
      var hbLabel = Math.max(9, Math.min(DS, Math.floor(bhH - 3)));

      D.xs.forEach(function (cat, ci) {
        var gy = y0 + bandH * ci + (bandH - innerH) / 2;
        visible.forEach(function (s, si) {
          var v = s.values[ci];
          if (v === null || v === undefined) return;
          var px = mapX(v);
          var by = gy + si * bhH;
          barEl({
            x: Math.min(baseX, px),
            y: by + 2,
            width: Math.max(1, Math.abs(px - baseX)),
            height: Math.max(1, bhH - 4),
            fill: paint(colorAt(s, ci)),
            'data-g': s.name,
            'data-tip': tipAll(ci, cat),
          }, false, v >= 0, g);
          if (O.showLabels !== false) {
            var inside = !!O.labelInside;
            var onRight = v >= 0 ? !inside : inside;
            label(fmt(v, dp), {
              x: onRight ? px + 6 : px - 6,
              y: by + bhH / 2 + Math.round(hbLabel * 0.35),
              'text-anchor': onRight ? 'start' : 'end',
              'font-size': hbLabel,
              'data-raw': 1,
              fill: inside ? inkFor(colorAt(s, ci)) : (TXT || T.label),
            }, g);
          }
        });
        var cyH = y0 + bandH * ci + bandH / 2;
        var lgG = logoOf(cat);
        if (lgG) {
          var lhG = Math.max(20, Math.min(bandH * 0.8, 40));
          el('image', { href: lgG, x: x0 - 122, y: cyH - lhG / 2, width: 110, height: lhG, preserveAspectRatio: 'xMidYMid meet' }, g);
        } else {
          label(cat, { x: x0 - 10, y: cyH + 5, 'text-anchor': 'end', 'font-size': 13 }, g);
        }
        if (chg) {
          // Cột tăng/giảm ở lề phải: mũi tên và phần trăm, xanh khi tăng, đỏ khi giảm
          var pv = chg.values[ci];
          var xc = W - 30 - chgW + 8;
          if (pv !== null && pv !== undefined) {
            var up = pv > 0.0000001;
            var down = pv < -0.0000001;
            var cc2 = up ? '#15803D' : down ? '#DC2626' : (TXT || T.axis);
            var ts = Math.max(8, Math.round(DS * 0.5));
            if (up || down) {
              var tp = up ? [[xc + ts / 2, cyH - ts / 2], [xc + ts, cyH + ts / 2], [xc, cyH + ts / 2]] : [[xc, cyH - ts / 2], [xc + ts, cyH - ts / 2], [xc + ts / 2, cyH + ts / 2]];
              el('polygon', { points: tp.map(function (q) { return q.join(','); }).join(' '), fill: cc2 }, g);
            }
            label((up ? '+' : '') + fmtR(pv, 1) + '%', { x: xc + ts + 8, y: cyH + 5, 'font-weight': 'bold', 'text-anchor': 'start', 'font-size': 13, fill: cc2, 'data-inside': 1 }, g);
          }
        }
      });
      if (chg) {
        chgLines.forEach(function (ln, k) {
          label(ln, { x: W - 30 - chgW + 8, y: y0 - 8 - (chgLines.length - 1 - k) * (LS + 2), 'font-weight': 'bold', 'text-anchor': 'start', 'font-size': 13, fill: TXT || T.axis, 'data-raw': 1 }, g);
        });
      }
    } else {
      var d = domainFor(vals, O.startAtZero !== false);
      x0 = Math.max(x0, axisPad(d));
      var span = d.hi - d.lo;
      function mapY(v) { return y1 - (v - d.lo) / span * (y1 - y0); }
      var base = mapY(Math.max(d.lo, Math.min(d.hi, 0)));
      drawAxisY(g, d, x0, x1, y0, y1, false);
      if (S.showAxes) el('line', { x1: x0, y1: base, x2: x1, y2: base, stroke: T.axis }, g);

      var n = D.xs.length;
      var band = (x1 - x0) / n;
      var inner = band * 0.8;
      var bw = inner / Math.max(1, visible.length);

      D.xs.forEach(function (cat, ci) {
        var gx = x0 + band * ci + (band - inner) / 2;
        visible.forEach(function (s, si) {
          var v = s.values[ci];
          if (v === null || v === undefined) return;
          var py = mapY(v);
          var bx = gx + si * bw;
          barEl({
            x: bx + 2,
            y: Math.min(base, py),
            width: Math.max(1, bw - 4),
            height: Math.abs(py - base),
            fill: paint(colorAt(s, ci)),
            'data-g': s.name,
            'data-tip': tipAll(ci, cat),
          }, true, v >= 0, g);
          if (O.showLabels !== false) {
            label(fmt(v, dp), { x: bx + bw / 2, y: v >= 0 ? (O.labelInside ? py + lblH() : py - 6) : (O.labelInside ? py - 6 : py + lblH()), 'text-anchor': 'middle', 'font-size': O.labelInside ? fitFs(fmt(v, dp), bw) : 12, 'data-raw': O.labelInside ? 1 : undefined, fill: O.labelInside ? inkFor(colorAt(s, ci)) : (TXT || T.label), 'data-inside': O.labelInside ? 1 : undefined }, g);
          }
        });
        catLabel(cat, x0 + band * ci + band / 2, y1 + 10 + LS, band, { 'font-size': 13 }, g);
      });
    }

    if (showLegend) {
      drawLegend(g, W - legendW + 10, top + 10, D.series.map(function (s) {
        return { name: s.name, color: paint(s.legendObj || s) };
      }));
    }
  }

  function drawCombo(g, top) {
    var showLegend = O.showLegend !== false;
    var CB = [];
    var legendW = 0;
    var x0 = 80;
    var x1 = W - 80 - legendW;
    var y0 = top + 20;
    var y1 = bottomY - 34;
    // Nhãn trục X: nếu có nhãn rộng hơn khoảng cách giữa các mốc thì dựng đứng cả hàng, chừa thêm chỗ bên dưới
    var xFs = LS;
    var xLongest = D.xs.reduce(function (m, c) { return Math.max(m, String(c).length); }, 0);
    var xEst = xLongest * xFs * 0.62;
    var rotateX = false;
    if (D.xs.length > 0) {
      var bandGuess = (W - 160) / D.xs.length;
      rotateX = xEst > bandGuess * 0.9;
      if (rotateX) y1 = Math.max(top + 120, bottomY - 20 - Math.ceil(xEst * 0.574 + xFs * 0.82) - 8);
    }
    var visible = D.series.filter(function (s) { return !hidden[s.name]; });
    var bars = visible.filter(function (s) { return s.kind !== 'line' && s.kind !== 'total'; });
    var lines = visible.filter(function (s) { return s.kind === 'line'; });
    var bVals = [];
    var lVals = [];
    bars.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) bVals.push(v); }); });
    lines.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) lVals.push(v); }); });
    var n = D.xs.length;

    if (n === 0 || (bVals.length === 0 && lVals.length === 0)) {
      noData(g);
    } else {
      var zb = O.startAtZero !== false;
      var dl = bVals.length ? domainFor(bVals, zb) : null;
      var dr = lVals.length ? domainFor(lVals, zb) : null;
      // Cả hai trục cùng bắt đầu từ 0; giá trị âm đi xuống dưới đường 0 chung
      if (dl && dr && zb) {
        var al = alignZero(dl, dr);
        dl = al[0];
        dr = al[1];
      }
      var lft = dl || dr;
      var rgt = dr || dl;
      if (dr) x1 = Math.min(x1, W - axisPad(rgt));
      x0 = Math.max(x0, axisPad(lft));
      function mapL(v) { return y1 - (v - lft.lo) / (lft.hi - lft.lo) * (y1 - y0); }
      function mapR(v) { return y1 - (v - rgt.lo) / (rgt.hi - rgt.lo) * (y1 - y0); }
      var band = (x1 - x0) / n;
      var base = mapL(Math.max(lft.lo, Math.min(lft.hi, 0)));

      ticksOf(lft).forEach(function (t) {
        var p = mapL(t);
        if (S.showGrid) el('line', { x1: x0, y1: p, x2: x1, y2: p, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
        if (S.showAxes) label(fmtFix(t, decOf(lft.step)), { x: x0 - 8, y: p + 4, 'text-anchor': 'end', 'font-size': 12, fill: TXT || T.axis }, g);
      });
      if (S.showAxes && dr) {
        ticksOf(rgt).forEach(function (t) {
          label(fmtFix(t, decOf(rgt.step)), { x: x1 + 8, y: mapR(t) + 4, 'text-anchor': 'start', 'font-size': 12, fill: TXT || T.axis }, g);
        });
      }
      if (S.showAxes) {
        el('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: T.axis }, g);
        el('line', { x1: x0, y1: y1, x2: x1 + (dr ? 0 : 0), y2: y1, stroke: T.axis }, g);
        if (dr) el('line', { x1: x1, y1: y0, x2: x1, y2: y1, stroke: T.axis }, g);
        if (O.leftUnit) label(O.leftUnit, { x: x0, y: Math.round(y0 - LS * 0.8 - 4), 'font-size': 12, fill: TXT || T.axis }, g);
        if (O.rightUnit && dr) label(O.rightUnit, { x: x1, y: Math.round(y0 - LS * 0.8 - 4), 'text-anchor': 'start', 'font-size': 12, fill: TXT || T.axis }, g);
      }

      var inner = band * 0.6;
      var bw = bars.length ? inner / bars.length : 0;
      var barTopAt = {}; // đỉnh cột cao nhất ở mỗi mốc: để biết nhãn đường nằm trong cột hay ngoài cột
      bars.forEach(function (s, si) {
        s.values.forEach(function (v, ci) {
          if (v === null) return;
          var gx = x0 + band * ci + (band - inner) / 2;
          var py = mapL(v);
          if (v >= 0 && (barTopAt[ci] === undefined || py < barTopAt[ci])) barTopAt[ci] = py;
          var bx = gx + si * bw;
          barEl({
            x: bx + 2,
            y: Math.min(base, py),
            width: Math.max(1, bw - 4),
            height: Math.abs(py - base),
            fill: paint(colorAt(s, ci)),
            'data-g': s.name,
            'data-ci': ci,
            'data-tip': tipAll(ci, D.xs[ci]),
          }, true, v >= 0, g);
          if (O.showLabels !== false) {
            CB.push(boxOf(fmt(v, dp), bx + bw / 2, v >= 0 ? (O.labelInside ? py + lblH() : py - 6) : (O.labelInside ? py - 6 : py + lblH()), DS));
            label(fmt(v, dp), { x: bx + bw / 2, y: v >= 0 ? (O.labelInside ? py + lblH() : py - 6) : (O.labelInside ? py - 6 : py + lblH()), 'text-anchor': 'middle', 'font-size': O.labelInside ? fitFs(fmt(v, dp), bw) : 11, 'data-raw': O.labelInside ? 1 : undefined, 'font-weight': 'bold', fill: O.labelInside ? inkFor(colorAt(s, ci)) : (TXT || T.label), 'data-inside': O.labelInside ? 1 : undefined }, g);
          }
        });
      });

      lines.forEach(function (s) {
        var pts = [];
        s.values.forEach(function (v, ci) {
          if (v !== null) pts.push({ x: x0 + band * (ci + 0.5), y: mapR(v), v: v, ci: ci });
        });
        if (pts.length) {
          var d = 'M' + pts[0].x + ' ' + pts[0].y;
          for (var k = 1; k < pts.length; k++) d += ' L' + pts[k].x + ' ' + pts[k].y;
          el('path', { d: d, fill: 'none', stroke: s.start, 'stroke-width': O.lineWidth || 2.5, 'stroke-linejoin': 'round', 'data-g': s.name }, g);
        }
        pts.forEach(function (p) {
          var tipRaw = tipAll(p.ci, D.xs[p.ci]);
          markerEl(O.markerShape || 'circle', p.x, p.y, O.markerSize != null ? O.markerSize : 6, T.background, s.start, g, { 'data-g': s.name, 'data-ci': p.ci });
          el('circle', { cx: p.x, cy: p.y, r: 10, fill: 'transparent', 'data-g': s.name, 'data-ci': p.ci, 'data-tip': tipRaw }, g);
          if (O.showLabels !== false) {
            var ptxt = fmt(p.v, dp) + (s.pct ? '%' : '');
            var fsL = LS;
            var ly = p.y - 12;
            var lb = boxOf(ptxt, p.x, ly, fsL);
            while (overlapsAny(CB, lb) && ly > top + 4) {
              ly -= fsL + 3;
              lb = boxOf(ptxt, p.x, ly, fsL);
            }
            CB.push(lb);
            // Mặc định chữ trắng khi nhãn nằm trong cột (nằm ngoài cột trên nền trắng thì dùng màu chữ thường để không bị mất)
            var inBar = barTopAt[p.ci] !== undefined && ly - fsL >= barTopAt[p.ci] && ly <= base;
            var lineInk = DATA.settings.lineLabelColor ? LBLN : (inBar ? '#FFFFFF' : (TXT || T.label));
            label(ptxt, { fill: lineInk, x: p.x, y: ly, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', 'pointer-events': 'none' }, g);
          }
        });
      });

      D.xs.forEach(function (cat, ci) {
        var cx = x0 + band * (ci + 0.5);
        if (rotateX && !logoOf(cat)) {
          var ty = y1 + 10 + LS;
          label(cat, { x: cx, y: ty, 'text-anchor': 'end', 'font-size': xFs, transform: 'rotate(-35 ' + cx + ' ' + ty + ')' }, g);
        } else {
          catLabel(cat, cx, y1 + 10 + LS, band, { 'font-size': xFs }, g);
        }
      });
    }

    if (showLegend) {
      drawLegend(g, W - legendW + 10, top + 10, D.series.map(function (s) {
        return { name: s.name, color: paint(s.legendObj || s) };
      }));
    }
  }

  function drawStacked(g, top) {
    var showLegend = O.showLegend !== false;
    var legendW = 0;
    var x0 = 80;
    var x1 = W - 30 - legendW;
    var y0 = top + 10;
    var y1 = bottomY - 34 - rotExtra(D.xs, W - 110);
    // Chuỗi dạng "Tổng" không được xếp chồng: chỉ dùng làm số tổng ghi trên đầu cột
    var visible = D.series.filter(function (s) { return !hidden[s.name] && s.kind !== 'total'; });
    var totalSer = D.series.filter(function (s) { return s.kind === 'total'; })[0];
    var anyHidden = D.series.some(function (s) { return s.kind !== 'total' && hidden[s.name]; });
    var n = D.xs.length;
    var pct = !!O.percent;
    var totals = D.xs.map(function (_, ci) {
      var t = 0;
      visible.forEach(function (s) { var v = s.values[ci]; if (v !== null && v > 0) t += v; });
      return t;
    });
    var maxTotal = Math.max.apply(null, totals.concat([0]));

    if (n === 0 || visible.length === 0 || maxTotal <= 0) {
      noData(g);
    } else {
      var d = pct ? { lo: 0, hi: 1, step: 0.25 } : domainFor([0, maxTotal], true);
      if (!pct) x0 = Math.max(x0, axisPad(d));
      var span = d.hi - d.lo;
      function mapY(v) { return y1 - (v - d.lo) / span * (y1 - y0); }

      if (pct) {
        [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
          var p = mapY(t);
          if (S.showGrid) el('line', { x1: x0, y1: p, x2: x1, y2: p, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
          if (S.showAxes) label(Math.round(t * 100) + '%', { x: x0 - 8, y: p + 4, 'text-anchor': 'end', 'font-size': 12, fill: TXT || T.axis }, g);
        });
      } else {
        drawAxisY(g, d, x0, x1, y0, y1, false);
      }
      if (S.showAxes) el('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: T.axis }, g);

      var band = (x1 - x0) / n;
      var bw = band * 0.6;
      D.xs.forEach(function (cat, ci) {
        var cum = 0;
        var total = totals[ci];
        var gx = x0 + band * ci + (band - bw) / 2;
        visible.forEach(function (s) {
          var v = s.values[ci];
          if (v === null || v <= 0 || total <= 0) return;
          var share = pct ? v / total : v;
          var bottom = cum;
          cum += share;
          var yTop = mapY(cum);
          var h = mapY(bottom) - yTop;
          var vText = pct ? fmtR(v / total * 100, dp) + '%' : fmt(v, dp) + (s.pct ? '%' : unit);
          el('rect', {
            x: gx,
            y: yTop,
            width: bw,
            height: Math.max(0, h),
            fill: paint(colorAt(s, ci)),
            'data-g': s.name,
            'data-tip': tipAll(ci, cat, true),
          }, g);
          if (O.showLabels !== false && h > Math.round(DS * 1.2)) {
            var vfs = fitFs(vText, bw);
            label(vText, {
              x: gx + bw / 2,
              y: yTop + h / 2 + Math.round(vfs * 0.33),
              'text-anchor': 'middle',
              'font-size': vfs,
              'data-raw': 1,
              'font-weight': 600,
              fill: inkFor(colorAt(s, ci)),
              'data-inside': 1,
              'pointer-events': 'none',
            }, g);
          }
        });
        if (!pct && O.showLabels !== false) {
          var shown = totalSer && !anyHidden && totalSer.values[ci] !== null && totalSer.values[ci] !== undefined ? totalSer.values[ci] : total;
          label(fmt(shown, dp) + (totalSer && totalSer.pct && !anyHidden ? '%' : ''), { x: gx + bw / 2, y: mapY(total) - 6, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600 }, g);
        }
        catLabel(cat, gx + bw / 2, y1 + 10 + LS, band, { 'font-size': 13 }, g);
      });
    }

    if (showLegend) {
      drawLegend(g, W - legendW + 10, top + 10, D.series.filter(function (s) { return s.kind !== 'total'; }).map(function (s) {
        return { name: s.name, color: paint(s.legendObj || s) };
      }));
    }
  }

  // Vùng chồng: các chuỗi xếp chồng từ dưới lên, mỗi chuỗi là một vùng tô màu có đường viền và điểm
  function drawStackedArea(g, top) {
    var x0 = 80;
    var x1 = W - 50;
    var y0 = top + 10;
    var y1 = bottomY - 34;
    var visible = D.series.filter(function (s) { return !hidden[s.name]; });
    var n = D.xs.length;
    var pct = !!O.percent;
    function val(s, ci) { var v = s.values[ci]; return v !== null && v !== undefined && v > 0 ? v : 0; }
    var totals = D.xs.map(function (_, ci) {
      var t = 0;
      visible.forEach(function (s) { t += val(s, ci); });
      return t;
    });
    var maxTotal = Math.max.apply(null, totals.concat([0]));

    if (n === 0 || visible.length === 0 || maxTotal <= 0) {
      noData(g);
      return;
    }
    var d = pct ? { lo: 0, hi: 1, step: 0.25 } : domainFor([0, maxTotal], true);
    if (!pct) x0 = Math.max(x0, axisPad(d));
    var span = d.hi - d.lo;
    function mapY(v) { return y1 - (v - d.lo) / span * (y1 - y0); }
    function mapX(ci) { return n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * ci / (n - 1); }

    if (pct) {
      [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
        var p = mapY(t);
        if (S.showGrid) el('line', { x1: x0, y1: p, x2: x1, y2: p, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
        if (S.showAxes) label(Math.round(t * 100) + '%', { x: x0 - 8, y: p + 4, 'text-anchor': 'end', 'font-size': 12, fill: TXT || T.axis }, g);
      });
    } else {
      drawAxisY(g, d, x0, x1, y0, y1, false);
    }
    if (S.showAxes) el('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: T.axis }, g);

    // Đường biên dưới/trên của từng chuỗi tại mỗi mốc
    var lower = D.xs.map(function () { return 0; });
    var layers = visible.map(function (s) {
      var lo = lower.slice();
      var up = D.xs.map(function (_, ci) {
        var share = pct ? (totals[ci] > 0 ? val(s, ci) / totals[ci] : 0) : val(s, ci);
        return lo[ci] + share;
      });
      lower = up;
      return { s: s, lo: lo, up: up };
    });

    var NL = String.fromCharCode(10);
    var pts = O.showPoints !== false;
    layers.forEach(function (L) {
      var top = L.up.map(function (v, ci) { return mapX(ci) + ' ' + mapY(v); });
      var bot = L.lo.map(function (v, ci) { return mapX(ci) + ' ' + mapY(v); }).reverse();
      var dArea = 'M' + top.join('L') + 'L' + bot.join('L') + 'Z';
      el('path', { d: dArea, fill: L.s.start, 'fill-opacity': 0.78, stroke: 'none', 'data-g': L.s.name }, g);
    });
    layers.forEach(function (L) {
      var dLine = 'M' + L.up.map(function (v, ci) { return mapX(ci) + ' ' + mapY(v); }).join('L');
      el('path', { d: dLine, fill: 'none', stroke: L.s.start, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'data-g': L.s.name, 'pointer-events': 'none' }, g);
      L.up.forEach(function (v, ci) {
        var raw = val(L.s, ci);
        var vText = pct ? fmtR(totals[ci] > 0 ? raw / totals[ci] * 100 : 0, dp) + '%' : fmt(raw, dp) + (L.s.pct ? '%' : unit);
        if (pts) el('circle', { cx: mapX(ci), cy: mapY(v), r: 4, fill: L.s.start, 'data-g': L.s.name, 'pointer-events': 'none' }, g);
        el('circle', { cx: mapX(ci), cy: mapY((L.lo[ci] + v) / 2), r: 12, fill: 'transparent', 'data-g': L.s.name, 'data-tip': tipAll(ci, D.xs[ci], true) }, g);
      });
    });
    D.xs.forEach(function (cat, ci) {
      catLabel(cat, mapX(ci), y1 + 10 + LS, (x1 - x0) / Math.max(1, n - 1), { 'font-size': 13 }, g);
    });
  }

  // Dải lịch sử: mỗi danh mục có dải (cận dưới đến cận trên), điểm tròn trung vị và tam giác giá trị hiện tại
  var RANGE_CUR = '#C0151B';
  function drawRangeDot(g, top) {
    var items = D.range;
    var bandN = O.bandLabel || 'Khoảng tứ phân vị';
    var midN = O.midLabel || 'Trung vị';
    var curN = O.curLabel || 'Hiện tại';
    var vals = [];
    items.forEach(function (it) {
      if (!hidden[bandN]) { if (it.low !== null) vals.push(it.low); if (it.high !== null) vals.push(it.high); }
      if (!hidden[midN] && it.mid !== null) vals.push(it.mid);
      if (!hidden[curN] && it.cur !== null) vals.push(it.cur);
    });
    if (items.length === 0 || vals.length === 0) { noData(g); return; }
    var x0 = 80;
    var x1 = W - 30;
    var y0 = top + 10;
    var y1 = bottomY - 34;
    var d = domainFor(vals, O.startAtZero !== false);
    x0 = Math.max(x0, axisPad(d));
    var span = d.hi - d.lo;
    function mapY(v) { return y1 - (v - d.lo) / span * (y1 - y0); }
    drawAxisY(g, d, x0, x1, y0, y1, false);
    if (S.showAxes) el('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: T.axis }, g);
    var band = (x1 - x0) / items.length;
    var bw = Math.min(band * 0.55, 110);
    var NLc = String.fromCharCode(10);
    items.forEach(function (it, i) {
      var cx = x0 + band * (i + 0.5);
      var tipLines = [it.label];
      if (it.low !== null && it.high !== null) tipLines.push(bandN + ': ' + fmt(it.low, dp) + ' - ' + fmt(it.high, dp) + unit);
      if (it.mid !== null) tipLines.push(midN + ': ' + fmt(it.mid, dp) + unit);
      if (it.cur !== null) tipLines.push(curN + ': ' + fmt(it.cur, dp) + unit);
      var tip = tipLines.join(NLc);
      if (!hidden[bandN] && it.low !== null && it.high !== null) {
        el('rect', { x: cx - bw / 2, y: mapY(it.high), width: bw, height: Math.max(1, mapY(it.low) - mapY(it.high)), fill: T.grid }, g);
      }
      if (!hidden[midN] && it.mid !== null) el('circle', { cx: cx, cy: mapY(it.mid), r: Math.max(6, Math.round(LS * 0.5)), fill: T.label }, g);
      if (!hidden[curN] && it.cur !== null) {
        var cy = mapY(it.cur);
        var r = Math.max(8, Math.round(LS * 0.6));
        el('polygon', { points: [[cx, cy - r], [cx + r, cy + r * 0.75], [cx - r, cy + r * 0.75]].map(function (q) { return q.join(','); }).join(' '), fill: RANGE_CUR }, g);
        if (O.showLabels !== false) {
          label(fmt(it.cur, dp), { x: cx + r + 6, y: cy + 5, 'font-weight': 'bold', 'text-anchor': 'start', 'font-size': 13, fill: RANGE_CUR, 'data-inside': 1 }, g);
        }
      }
      el('rect', { x: cx - band / 2, y: y0, width: band, height: y1 - y0, fill: 'transparent', 'data-tip': tip }, g);
      catLabel(it.label, cx, y1 + 10 + LS, band, { 'font-size': 13 }, g);
    });
  }

  // Điểm đánh dấu theo kiểu: tròn, vuông, thoi, tam giác, ngôi sao
  function markerEl(shape, cx, cy, r, fill, stroke, parent, extra) {
    var base = Object.assign({ fill: fill, stroke: stroke, 'stroke-width': 1.5, 'pointer-events': 'none' }, extra || {});
    var pts;
    if (shape === 'square') {
      return el('rect', Object.assign({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, base), parent);
    }
    if (shape === 'diamond') {
      pts = [[cx, cy - r * 1.3], [cx + r * 1.3, cy], [cx, cy + r * 1.3], [cx - r * 1.3, cy]];
      return el('polygon', Object.assign({ points: pts.map(function (p) { return p.join(','); }).join(' ') }, base), parent);
    }
    if (shape === 'triangle') {
      pts = [[cx, cy - r * 1.4], [cx + r * 1.2, cy + r], [cx - r * 1.2, cy + r]];
      return el('polygon', Object.assign({ points: pts.map(function (p) { return p.join(','); }).join(' ') }, base), parent);
    }
    if (shape === 'star') {
      pts = [];
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rad = i % 2 === 0 ? r * 1.6 : r * 0.7;
        pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
      }
      return el('polygon', Object.assign({ points: pts.map(function (p) { return p.join(','); }).join(' ') }, base), parent);
    }
    return el('circle', Object.assign({ cx: cx, cy: cy, r: r }, base), parent);
  }

  function areaPaint(s) {
    var id = 'area' + gradN++;
    var ag = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, DEFS);
    el('stop', { offset: 0, 'stop-color': s.start, 'stop-opacity': 0.28 }, ag);
    el('stop', { offset: 1, 'stop-color': s.start, 'stop-opacity': 0.02 }, ag);
    return 'url(#' + id + ')';
  }

  // Logo của danh mục (nếu đã gán); trả về null nếu không có
  function logoOf(name) {
    return (DATA.logos && DATA.logos[name]) || null;
  }

  // Màu của một cột: nếu bật "màu thương hiệu logo" thì lấy màu đã tính cho danh mục ở mốc ci, không thì màu của chuỗi
  function colorAt(s, ci) {
    var b = s.catColors && s.catColors[ci];
    return b || s;
  }

  // Hộp bao quanh một nhãn số, dùng để kiểm tra chồng lấn
  function boxOf(text, x, y, fs) {
    const w = String(text).length * fs * 0.56;
    return { x0: x - w / 2 - 2, x1: x + w / 2 + 2, y0: y - fs - 2, y1: y + 3 };
  }
  function overlapsAny(list, b) {
    return list.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  }

  // Nhãn trục: nếu quá dài so với khoảng cách cột thì xoay nghiêng để không dính nhau
  // Phần phải nâng đáy khung vẽ lên khi nhãn trục X bị xoay nghiêng (chữ to trên điện thoại thò xuống dưới đáy)
  function rotExtra(labels, availW) {
    var n = labels.length;
    if (!n) return 0;
    var longest = labels.reduce(function (m, c) { return logoOf(c) ? m : Math.max(m, String(c).length); }, 0);
    var est = longest * LS * 0.62;
    if (est <= availW / n * 0.95) return 0;
    var need = 10 + LS + est * 0.574 + LS * 0.3;
    return Math.max(0, Math.ceil(need - 74));
  }

  function catLabel(str, x, y, band, attrs, parent) {
    var lg = logoOf(str);
    if (lg) {
      // Logo rộng tối đa theo khoảng cách giữa các cột (không quá 110), cao tối đa 44, nằm ngay dưới trục
      var lw = Math.max(36, Math.min(band * 0.9, 110));
      el('image', { href: lg, x: x - lw / 2, y: y - 12, width: lw, height: 44, preserveAspectRatio: 'xMidYMid meet' }, parent);
      return null;
    }
    const fs = (attrs && attrs['font-size']) || 13;
    const est = String(str).length * LS * 0.62;
    if (est > band * 0.95) {
      return label(str, Object.assign({}, attrs, { x: x, y: y, 'text-anchor': 'end', transform: 'rotate(-35 ' + x + ' ' + y + ')' }), parent);
    }
    return label(str, Object.assign({}, attrs, { x: x, y: y, 'text-anchor': 'middle' }), parent);
  }

  function pathFor(run, interp) {
    var d = 'M' + run[0].x + ' ' + run[0].y;
    var k;
    if (interp === 'step') {
      for (k = 1; k < run.length; k++) d += ' H' + run[k].x + ' V' + run[k].y;
    } else if (interp === 'monotone' && run.length > 2) {
      for (k = 0; k < run.length - 1; k++) {
        var p0 = run[Math.max(0, k - 1)];
        var p1 = run[k];
        var p2 = run[k + 1];
        var p3 = run[Math.min(run.length - 1, k + 2)];
        var c1x = p1.x + (p2.x - p0.x) / 6;
        var c1y = p1.y + (p2.y - p0.y) / 6;
        var c2x = p2.x - (p3.x - p1.x) / 6;
        var c2y = p2.y - (p3.y - p1.y) / 6;
        d += ' C' + c1x + ' ' + c1y + ' ' + c2x + ' ' + c2y + ' ' + p2.x + ' ' + p2.y;
      }
    } else {
      for (k = 1; k < run.length; k++) d += ' L' + run[k].x + ' ' + run[k].y;
    }
    return d;
  }

  function drawLine(g, top) {
    var xs = D.xs;
    var n = xs.length;
    var legendOn = O.showLegend !== false;
    var legendW = 0;
    var x0 = 80;
    var x1 = W - 30 - legendW;
    var y0 = top;
    var y1 = bottomY - 34;
    PLOT = { x0: x0, x1: x1, y0: y0, y1: y1 };

    var visible = D.series.filter(function (s) { return !hidden[s.name]; });
    var vals = [];
    visible.forEach(function (s) {
      s.values.forEach(function (v) { if (v !== null) vals.push(v); });
    });

    if (vals.length === 0 || n === 0) {
      noData(g);
    } else {
      var d = domainFor(vals, false);
      x0 = Math.max(x0, axisPad(d)); PLOT.x0 = x0; // chừa chỗ cho số trên trục để không bị cắt
      var span = d.hi - d.lo;
      var ends = O.emphasizeEnds !== false && n > 12 && !zoomOn; // nhiều mốc: nhấn mạnh điểm đầu và cuối
      var i0 = view.s * (n - 1);
      var i1 = view.e * (n - 1);
      if (i1 <= i0) i1 = i0 + 1;
      function mapY(v) { return y1 - (v - d.lo) / span * (y1 - y0); }
      function mapX(i) { return n < 2 ? (x0 + x1) / 2 : x0 + (i - i0) / (i1 - i0) * (x1 - x0); }

      var cp = el('clipPath', { id: 'plot-clip' }, DEFS);
      el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, cp);

      drawAxisY(g, d, x0, x1, y0, y1, false);

      if (S.showAxes) {
        el('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: T.axis }, g);
        var first = Math.max(0, Math.floor(i0));
        var last = Math.min(n - 1, Math.ceil(i1));
        var maxLabels = Math.max(2, Math.floor((x1 - x0) / 80));
        var step = Math.max(1, Math.ceil((last - first + 1) / maxLabels));
        if (ends) {
          // Nhiều mốc: luôn có nhãn đầu và cuối (căn mép), phần giữa thưa ra và tránh đè lên hai đầu
          var lblW = function (t) { return String(t).length * LS * 0.62; };
          var yL = y1 + 10 + LS;
          label(xs[0], { x: x0, y: yL, 'text-anchor': 'start', 'font-size': 13, fill: TXT || T.axis }, g);
          label(xs[n - 1], { x: x1, y: yL, 'text-anchor': 'end', 'font-size': 13, fill: TXT || T.axis }, g);
          var leftEnd = x0 + lblW(xs[0]) + 14;
          var rightStart = x1 - lblW(xs[n - 1]) - 14;
          var lastX = leftEnd;
          for (var im = 1; im < n - 1; im++) {
            var pm = mapX(im);
            var half = lblW(xs[im]) / 2 + 10;
            if (pm - half < lastX || pm + half > rightStart) continue;
            label(xs[im], { x: pm, y: yL, 'text-anchor': 'middle', 'font-size': 12, fill: TXT || T.axis }, g);
            lastX = pm + half;
          }
        } else {
        for (var i = first; i <= last; i += step) {
          var px = mapX(i);
          if (px < x0 - 5 || px > x1 + 5) continue;
          catLabel(xs[i], px, y1 + 10 + LS, (x1 - x0) / Math.max(1, n), { 'font-size': 12, fill: TXT || T.axis }, g);
        }
        }
      }

      var dash = O.lineStyle === 'dashed' ? '8 6' : O.lineStyle === 'dotted' ? '2 5' : null;
      var plot = el('g', { 'clip-path': 'url(#plot-clip)' }, g);

      visible.forEach(function (s) {
        var runs = [];
        var cur = [];
        s.values.forEach(function (v, idx) {
          if (v === null) {
            if (cur.length) runs.push(cur);
            cur = [];
          } else {
            cur.push({ x: mapX(idx), y: mapY(v) });
          }
        });
        if (cur.length) runs.push(cur);

        runs.forEach(function (run) {
          if (O.showArea !== false) {
            var ad = pathFor(run, O.interpolation) + ' L' + run[run.length - 1].x + ' ' + y1 + ' L' + run[0].x + ' ' + y1 + ' Z';
            el('path', { d: ad, fill: areaPaint(s), stroke: 'none', 'pointer-events': 'none' }, plot);
          }
          el('path', {
            d: pathFor(run, O.interpolation),
            fill: 'none',
            stroke: s.start,
            'stroke-width': O.lineWidth || 2.5,
            'stroke-dasharray': dash,
            'stroke-linejoin': 'round',
            'data-g': s.name,
          }, plot);
        });

        var fi = -1;
        var li = -1;
        s.values.forEach(function (v, idx) { if (v !== null) { if (fi < 0) fi = idx; li = idx; } });
        s.values.forEach(function (v, idx) {
          if (v === null) return;
          var px2 = mapX(idx);
          var py2 = mapY(v);
          var tipRaw = tipAll(idx, xs[idx]);
          var isEnd = idx === fi || idx === li;
          if (O.showMarkers !== false && (!ends || isEnd)) {
            markerEl(O.markerShape || 'circle', px2, py2, (O.markerSize != null ? O.markerSize : 4) + (ends ? 2 : 0), s.start, T.background, plot, { 'data-g': s.name });
          }
          if (ends && isEnd) {
            // Giá trị đầu và cuối nằm ngoài vùng cắt để không bị mất ở mép
            label(fmt(v, dp) + (s.pct ? '%' : unit), { fill: LBLN, x: px2, y: py2 - 12, 'text-anchor': idx === fi ? 'start' : 'end', 'font-size': 12, 'font-weight': 'bold', 'pointer-events': 'none' }, g);
          }
          el('circle', { cx: px2, cy: py2, r: 8, fill: 'transparent', 'data-g': s.name, 'data-tip': tipRaw }, plot);
          if (O.showLabels && !ends) {
            label(fmt(v, dp), { fill: LBLN, x: px2, y: py2 - 10, 'text-anchor': 'middle', 'font-size': 12, 'pointer-events': 'none' }, plot);
          }
        });
      });
    }

    if (legendOn) {
      drawLegend(g, W - legendW + 10, top + 10, D.series.map(function (s) {
        return { name: s.name, color: paint(s.legendObj || s) };
      }));
    }
  }

  // ===== Đua thanh và đường xếp hạng theo thời gian =====
  var anim = { t: 0, playing: false, dirty: true, last: 0 };
  var lineMode = O.mode || 'value';

  function raceFrame(t) {
    var n = D.xs.length;
    var i = Math.min(n - 1, Math.floor(t));
    var i2 = Math.min(n - 1, i + 1);
    var f = t - i;
    var list = [];
    var total = 0;
    D.entities.forEach(function (e) {
      var a = e.values[i] == null ? 0 : e.values[i];
      var b = e.values[i2] == null ? 0 : e.values[i2];
      var v = a + (b - a) * f;
      total += v;
      if (!hidden[e.region] && v > 0) list.push({ e: e, v: v });
    });
    list.sort(function (p, q) { return q.v - p.v; });
    return { list: list.slice(0, O.topN || 10), total: total, year: D.xs[Math.round(t)] || '' };
  }

  function drawBarRace(g, top) {
    var n = D.xs.length;
    if (!n || !D.entities.length) { noData(g); return; }
    var fr = raceFrame(anim.t);
    var list = fr.list;
    var topN = O.topN || 10;
    var x0 = 230;
    var x1 = W - 170;
    var y0 = top + 36;
    var y1 = bottomY - 92;
    var maxV = list.length ? list[0].v : 1;
    var d = domainFor([0, maxV], true);
    var span = d.hi - d.lo;
    function mapX(v) { return x0 + (v - d.lo) / span * (x1 - x0); }
    ticksOf(d).forEach(function (tk) {
      var p = mapX(tk);
      if (S.showGrid) el('line', { x1: p, y1: y0 - 4, x2: p, y2: y1, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
      if (S.showAxes) label(fmtFix(tk, decOf(d.step)), { x: p, y: y0 - 10, 'text-anchor': 'middle', 'font-size': 11, fill: TXT || T.axis }, g);
    });
    var slot = (y1 - y0) / topN;
    var bh = slot * 0.8;
    list.forEach(function (it, k) {
      var y = y0 + k * slot + (slot - bh) / 2;
      var bx = mapX(it.v);
      el('rect', { x: x0, y: y, width: Math.max(1, bx - x0), height: bh, rx: 4, fill: paint(it.e), 'data-tip': it.e.name + '\n' + fmt(it.v, dp) + (D.pct ? '%' : unit), 'data-g': it.e.region }, g);
      var lgR = logoOf(it.e.name);
      if (lgR) {
        var lhR = Math.max(20, Math.min(bh, 40));
        el('image', { href: lgR, x: x0 - 132, y: y + bh / 2 - lhR / 2, width: 120, height: lhR, preserveAspectRatio: 'xMidYMid meet' }, g);
      }
      else label(it.e.name, { x: x0 - 10, y: y + bh / 2 + 5, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 600 }, g);
      label(fmt(it.v, dp) + (D.pct ? '%' : unit), { x: bx + 8, y: y + bh / 2 + 5, 'text-anchor': 'start', 'font-size': 13, 'font-weight': 600 }, g);
    });

    label(String(fr.year), { x: W - 36, y: bottomY - 56, 'text-anchor': 'end', 'font-size': 64, 'font-weight': 700, fill: T.grid, 'data-raw': 1 }, g);
    if (O.showTotal !== false) {
      label('Tổng: ' + fmt(fr.total, dp), { x: W - 36, y: bottomY - 28, 'text-anchor': 'end', 'font-size': 14, 'data-raw': 1 }, g);
    }

    var by = bottomY - 30;
    el('rect', { x: 10, y: by - 14, width: 70, height: 28, rx: 14, fill: T.label, 'data-action': 'toggle', cursor: 'pointer' }, g);
    label(anim.playing ? 'Dừng' : 'Chạy', { x: 45, y: by + 5, 'text-anchor': 'middle', 'font-size': 13, fill: '#FFFFFF', 'data-action': 'toggle', 'data-raw': 1 }, g);
    var sx0 = 100;
    var sx1 = W - 40;
    el('line', { x1: sx0, y1: by, x2: sx1, y2: by, stroke: T.grid, 'stroke-width': 6, 'stroke-linecap': 'round', 'data-action': 'seek', cursor: 'pointer' }, g);
    var kx = sx0 + (anim.t / Math.max(1, n - 1)) * (sx1 - sx0);
    el('circle', { cx: kx, cy: by, r: 8, fill: '#ff6201', 'pointer-events': 'none' }, g);
  }

  function drawLineRank(g, top) {
    var n = D.xs.length;
    var last = n - 1;
    var ents = D.entities
      .filter(function (e) { return e.values[last] != null; })
      .sort(function (a, b) { return b.values[last] - a.values[last]; })
      .slice(0, O.topN || 8);
    if (!n || !ents.length) { noData(g); return; }

    var mode = lineMode;
    var m = ents.length;
    var ranks = {};
    if (mode === 'rank') {
      for (var i = 0; i < n; i++) {
        var arr = ents
          .filter(function (e) { return e.values[i] != null; })
          .sort(function (a, b) { return b.values[i] - a.values[i]; });
        arr.forEach(function (e, k) {
          ranks[e.name] = ranks[e.name] || [];
          ranks[e.name][i] = k + 1;
        });
      }
    }

    [['value', 'Giá trị'], ['rank', 'Thứ hạng']].forEach(function (tg, k) {
      var on = mode === tg[0];
      el('rect', { x: 20 + k * 100, y: top - 6, width: 92, height: 26, rx: 13, fill: on ? T.label : '#FFFFFF', stroke: T.grid, cursor: 'pointer', 'data-action': 'mode:' + tg[0] }, g);
      label(tg[1], { x: 66 + k * 100, y: top + 11, 'text-anchor': 'middle', 'font-size': 12, fill: on ? '#FFFFFF' : (TXT || T.label), 'data-action': 'mode:' + tg[0], 'data-raw': 1 }, g);
    });

    var x0 = 70;
    var x1 = W - 190;
    var y0 = top + 46;
    var y1 = bottomY - 40;
    var vals = [];
    ents.forEach(function (e) { e.values.forEach(function (v) { if (v != null) vals.push(v); }); });
    var d = domainFor(vals, false);
    var span = d.hi - d.lo;
    function mapX(i) { return n < 2 ? (x0 + x1) / 2 : x0 + i / (n - 1) * (x1 - x0); }
    function mapY(e, i) {
      if (mode === 'rank') {
        var r = ranks[e.name] ? ranks[e.name][i] : null;
        if (r == null) return null;
        return y0 + (r - 1) / Math.max(1, m - 1) * (y1 - y0);
      }
      var v = e.values[i];
      if (v == null) return null;
      return y1 - (v - d.lo) / span * (y1 - y0);
    }

    if (mode === 'rank') {
      for (var k2 = 1; k2 <= m; k2++) {
        var yy = y0 + (k2 - 1) / Math.max(1, m - 1) * (y1 - y0);
        if (S.showGrid) el('line', { x1: x0, y1: yy, x2: x1, y2: yy, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
        if (S.showAxes) label(String(k2), { x: x0 - 10, y: yy + 4, 'text-anchor': 'end', 'font-size': 12, fill: TXT || T.axis }, g);
      }
    } else {
      ticksOf(d).forEach(function (tk) {
        var p = y1 - (tk - d.lo) / span * (y1 - y0);
        if (S.showGrid) el('line', { x1: x0, y1: p, x2: x1, y2: p, stroke: T.grid, 'stroke-dasharray': '4 4' }, g);
        if (S.showAxes) label(fmtFix(tk, decOf(d.step)), { x: x0 - 10, y: p + 4, 'text-anchor': 'end', 'font-size': 12, fill: TXT || T.axis }, g);
      });
    }
    if (S.showAxes) {
      var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((x1 - x0) / 60))));
      for (var q = 0; q < n; q += step) {
        label(D.xs[q], { x: mapX(q), y: y1 + 10 + LS, 'text-anchor': 'middle', 'font-size': 12, fill: TXT || T.axis }, g);
      }
      el('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: T.axis }, g);
    }

    var plot = el('g', {}, g);
    ents.forEach(function (e) {
      var pts = [];
      e.values.forEach(function (v, i2) {
        var y = mapY(e, i2);
        if (y != null) pts.push({ x: mapX(i2), y: y, i: i2 });
      });
      if (pts.length) {
        var dd = 'M' + pts[0].x + ' ' + pts[0].y;
        for (var j = 1; j < pts.length; j++) dd += ' L' + pts[j].x + ' ' + pts[j].y;
        el('path', { d: dd, fill: 'none', stroke: e.start, 'stroke-width': O.lineWidth || 2.5, 'stroke-linejoin': 'round', 'data-g': e.name }, plot);
      }
      pts.forEach(function (p) {
        var val = mode === 'rank' ? ('Hạng ' + ranks[e.name][p.i]) : (fmt(e.values[p.i], dp) + (D.pct ? '%' : unit));
        markerEl(O.markerShape || 'circle', p.x, p.y, O.markerSize != null ? O.markerSize : 4, e.start, T.background, plot,
          { 'data-g': e.name, 'data-tip': e.name + '\n' + D.xs[p.i] + '\n' + val, 'pointer-events': 'all' });
      });
      var lp = pts[pts.length - 1];
      if (lp && O.showEndLabels !== false) {
        var endVal = mode === 'rank' ? ('#' + ranks[e.name][lp.i]) : fmt(e.values[lp.i], dp) + (D.pct ? '%' : '');
        label(e.name + '  ' + endVal, { x: lp.x + 12, y: lp.y + 4, 'font-size': 12, 'font-weight': 600, fill: e.start, 'data-g': e.name, 'pointer-events': 'none' }, plot);
      }
    });
  }

  root.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-action');
    if (!a) return;
    if (a === 'toggle') {
      anim.playing = !anim.playing;
      if (anim.playing && anim.t >= D.xs.length - 1) anim.t = 0;
      anim.last = 0;
    } else if (a === 'seek') {
      var p = toSvgPoint(e);
      var f = Math.min(1, Math.max(0, (p.x - 100) / (W - 40 - 100)));
      anim.t = f * Math.max(0, D.xs.length - 1);
      anim.playing = false;
    } else if (a.indexOf('mode:') === 0) {
      lineMode = a.slice(5);
    }
    draw();
  });

  function raceTick(ts) {
    if (anim.playing && DATA.type === 'barRace') {
      var dt = anim.last ? ts - anim.last : 0;
      anim.t += dt / (O.speed || 1200);
      if (anim.t >= D.xs.length - 1) { anim.t = D.xs.length - 1; anim.playing = false; }
      anim.dirty = true;
    }
    anim.last = ts;
    if (anim.dirty) { anim.dirty = false; draw(); }
    requestAnimationFrame(raceTick);
  }

  // Hiệu ứng vào: cột mọc từ chân cột lên và mờ hiện dần khi biểu đồ vào vùng nhìn thấy (chỉ chạy lần đầu)
  var introState = 0; // 0 chưa chạy, 1 đã chờ/đã chạy
  function playIntro() {
    var bars = root.querySelectorAll('[data-bar]');
    if (DATA.isStatic) { introState = 1; return; }
    if (introState === 1 || !bars.length || !root.animate) { introState = 1; return; }
    introState = 1;
    var items = [];
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      var vert = b.getAttribute('data-bar') === 'v';
      var pos = b.getAttribute('data-pos') === '1';
      var origin = vert ? (pos ? '50% 100%' : '50% 0%') : (pos ? '0% 50%' : '100% 50%');
      b.style.transformBox = 'fill-box';
      b.style.transformOrigin = origin;
      b.style.opacity = '0';
      items.push({ el: b, from: vert ? 'scale(1,0)' : 'scale(0,1)' });
    }
    var started = false;
    function go() {
      if (started) return;
      started = true;
      items.forEach(function (it, k) {
        var a = it.el.animate(
          [{ transform: it.from, opacity: 0 }, { transform: 'scale(1,1)', opacity: 1 }],
          { duration: 800, delay: Math.min(k, 20) * 40, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'both' }
        );
        a.onfinish = function () { it.el.style.opacity = ''; it.el.style.transformBox = ''; it.el.style.transformOrigin = ''; try { a.cancel(); } catch (e) {} };
      });
    }
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); }
      }, { threshold: 0.25 });
      io.observe(root);
      setTimeout(function () { if (!started) { io.disconnect(); go(); } }, 4000);
    } else go();
  }

  // Chiều cao phần vẽ (từ dưới phần đầu đến chân biểu đồ) đủ chứa nội dung theo từng loại biểu đồ
  function autoPlotH() {
    var t = DATA.type;
    if (t === 'pie') return Math.round(W * 0.7) + 72;
    if (t === 'barRace' || t === 'lineRank') return Math.round(W * 0.75);
    var horizontal = false;
    var rows = 0;
    var per = 0;
    var extra = 0;
    if (t === 'bar' || t === 'rankBar' || t === 'divBar') {
      horizontal = O.orientation === 'horizontal' || t !== 'bar';
      rows = D.items ? D.items.length : 0;
      per = Math.max(40, Math.round(DS * 2.3));
    } else if (t === 'groupedBar') {
      horizontal = O.orientation === 'horizontal';
      rows = D.xs ? D.xs.length : 0;
      var ns = D.series ? D.series.length : 1;
      per = ns * Math.max(26, Math.round(DS * 1.6)) + 16;
      if (D.changes) extra = 60;
    }
    if (horizontal) return Math.max(220, rows * per + 34 + extra);
    return Math.round(W * 0.62) + 58;
  }

  function draw() {
    applyFontScale();
    while (root.firstChild) root.removeChild(root.firstChild);
    lastHL = null;
    gradN = 0;
    DEFS = el('defs', {}, root);
    var foot = (S.description ? 44 : 24) + 40;
    bottomY = H - foot;
    var top = drawHeader(root);
    if (S.autoHeight) {
      // Chiều cao tự tính theo nội dung (chỉ dùng ở bước đo; bản xuất ra luôn có chiều cao cố định)
      var wantH = Math.round(top + autoPlotH() + foot);
      if (wantH !== H) {
        H = wantH;
        svgRoot.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svgRoot.setAttribute('height', H);
      }
      bottomY = H - foot;
    }
    if (DATA.type === 'pie') drawPie(root, top);
    else if (DATA.type === 'bar') drawBar(root, top);
    else if (DATA.type === 'groupedBar') drawGrouped(root, top);
    else if (DATA.type === 'combo') drawCombo(root, top);
    else if (DATA.type === 'barRace') drawBarRace(root, top);
    else if (DATA.type === 'lineRank') drawLineRank(root, top);
    else if (DATA.type === 'stackedBar') drawStacked(root, top);
    else if (DATA.type === 'stackedArea') drawStackedArea(root, top);
    else if (DATA.type === 'rankBar' || DATA.type === 'divBar') drawBar(root, top);
    else if (DATA.type === 'rangeDot') drawRangeDot(root, top);
    else drawLine(root, top);
    if (S.description) label(S.description, { x: 30, y: H - 18, 'font-size': 12, fill: TXT || T.axis }, root);
    playIntro();
    if (zoomOn) label('Cuộn chuột để zoom, kéo để di chuyển, nhấp đúp để về mặc định', { x: W - 30, y: H - 18, 'text-anchor': 'end', 'font-size': 11, fill: TXT || T.axis }, root);
  }

  function toSvgPoint(e) {
    var pt = svgRoot.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    var m = svgRoot.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: e.clientX, y: e.clientY };
  }

  function showTip(e, raw) {
    var lines = raw.split('\n');
    while (tipText.firstChild) tipText.removeChild(tipText.firstChild);
    var maxLen = 0;
    lines.forEach(function (ln, k) {
      var ts = el('tspan', { x: 14, dy: k === 0 ? 22 : 21, 'font-weight': k === 0 ? 'bold' : 'normal' }, tipText);
      ts.textContent = ln;
      if (ln.length > maxLen) maxLen = ln.length;
    });
    var bw = Math.max(110, maxLen * 8.6 + 28);
    var bh = lines.length * 21 + 18;
    tipBg.setAttribute('width', bw);
    tipBg.setAttribute('height', bh);
    // Phóng to theo tỷ lệ hiển thị: khi SVG bị thu nhỏ (điện thoại, khung hẹp) tooltip lớn lên để vẫn đọc được
    var ctm = svgRoot.getScreenCTM();
    var k = ctm && ctm.a > 0 ? 1 / ctm.a : 1;
    var sc = Math.min(4, Math.max(1.15, 1.1 * k));
    var gap = 14 * sc;
    var p = toSvgPoint(e);
    var tx = p.x + gap;
    if (tx + bw * sc > W) tx = p.x - bw * sc - gap;
    var ty = p.y + gap;
    if (ty + bh * sc > H) ty = p.y - bh * sc - gap;
    tip.setAttribute('transform', 'translate(' + Math.max(0, tx) + ',' + Math.max(0, ty) + ') scale(' + sc + ')');
    tip.setAttribute('visibility', 'visible');
  }

  function hideTip() {
    tip.setAttribute('visibility', 'hidden');
  }

  // Cột (và khúc cột chồng) chỉ sáng đúng phần tử được rê vào; đường, miếng bánh... vẫn sáng theo cả nhóm
  function highlight(group, target) {
    // Biểu đồ kết hợp: rê vào cột hoặc điểm thì sáng cả cột và điểm đánh dấu cùng mốc, phần còn lại mờ đi
    var ciKey = target && group !== null && target.getAttribute('data-ci') !== null ? target.getAttribute('data-ci') : null;
    if (ciKey !== null) {
      var ck = 'ci:' + ciKey;
      if (ck === lastHL) return;
      lastHL = ck;
      var allc = root.querySelectorAll('[data-g]');
      for (var q = 0; q < allc.length; q++) {
        allc[q].setAttribute('opacity', allc[q].getAttribute('data-ci') === ciKey ? 1 : 0.3);
      }
      return;
    }
    var single = !!target && group !== null && (target.getAttribute('data-bar') !== null || (DATA.type === 'stackedBar' && target.tagName === 'rect'));
    var key = single ? target : group;
    if (key === lastHL) return;
    lastHL = key;
    var all = root.querySelectorAll('[data-g]');
    for (var k = 0; k < all.length; k++) {
      var on = group === null || (single ? all[k] === target : all[k].getAttribute('data-g') === group);
      all[k].setAttribute('opacity', on ? 1 : 0.3);
    }
  }

  function setView(s, e) {
    var r = e - s;
    if (r >= 1) {
      view.s = 0;
      view.e = 1;
    } else {
      if (s < 0) { e -= s; s = 0; }
      if (e > 1) { s -= e - 1; e = 1; }
      view.s = Math.max(0, s);
      view.e = Math.min(1, e);
    }
    draw();
  }

  svgRoot.addEventListener('mousemove', function (e) {
    if (drag) return;
    var raw = e.target.getAttribute ? e.target.getAttribute('data-tip') : null;
    if (raw && IX.tooltip !== false) showTip(e, raw);
    else hideTip();
    if (IX.highlight !== false) highlight(raw ? e.target.getAttribute('data-g') : null, e.target);
  });

  svgRoot.addEventListener('mouseleave', function () {
    hideTip();
    if (IX.highlight !== false) highlight(null);
  });

  root.addEventListener('click', function (e) {
    if (!IX.legendToggle) return;
    var t = e.target;
    while (t && t !== root && (!t.getAttribute || t.getAttribute('data-legend') === null)) t = t.parentNode;
    if (t && t !== root) {
      var name = t.getAttribute('data-legend');
      hidden[name] = !hidden[name];
      draw();
    }
  });

  if (zoomOn) {
    svgRoot.addEventListener('wheel', function (e) {
      if (!PLOT) return;
      e.preventDefault();
      var p = toSvgPoint(e);
      var f = Math.min(1, Math.max(0, (p.x - PLOT.x0) / (PLOT.x1 - PLOT.x0)));
      var range = view.e - view.s;
      var minRange = D.xs.length > 1 ? Math.min(1, 1 / (D.xs.length - 1)) : 1;
      var newRange = Math.min(1, Math.max(minRange, range * (e.deltaY < 0 ? 0.85 : 1.18)));
      var anchor = view.s + f * range;
      var s = anchor - f * newRange;
      setView(s, s + newRange);
    }, { passive: false });

    svgRoot.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      drag = { x: toSvgPoint(e).x, s: view.s, e: view.e };
    });

    svgRoot.addEventListener('mousemove', function (e) {
      if (!drag || !PLOT) return;
      var p = toSvgPoint(e);
      var r = drag.e - drag.s;
      var shift = -(p.x - drag.x) / (PLOT.x1 - PLOT.x0) * r;
      setView(drag.s + shift, drag.e + shift);
    });

    window.addEventListener('mouseup', function () { drag = null; });

    svgRoot.addEventListener('dblclick', function () { setView(0, 1); });
  }

  if (DATA.type === 'barRace') requestAnimationFrame(raceTick);
  draw();
  var rzTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () { var o = fontK; applyFontScale(); if (fontK !== o && DATA.type !== 'barRace') draw(); }, 150);
  });
}


// Ảnh tĩnh của biểu đồ (không có script), dùng cho thư viện xem trước.
// Chạy trong tiến trình giao diện: vẽ vào một khung ẩn rồi lấy mã SVG.
export function renderStaticSvg(spec, settings, options, rows, colors = {}) {
  if (!(Number(settings.height) > 0)) {
    settings = { ...settings, height: resolveHeight(spec, settings, options, rows, colors) };
  }
  const payload = buildPayload(spec, settings, options, rows, colors);
  const theme = payload.theme;
  const w = payload.settings.width;
  const h = payload.settings.height;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:' + w + 'px;height:' + h + 'px;overflow:hidden';
  host.innerHTML = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="background:' + theme.background + '">',
    '<g id="chart"></g>',
    '<g id="tip" visibility="hidden"><rect id="tip-bg" rx="6" fill="#0F172A" fill-opacity="0.92" width="10" height="10"/><text id="tip-text" fill="#F8FAFC" font-size="14"></text></g>',
    '</svg>',
  ].join('');
  document.body.appendChild(host);
  let out = '';
  try {
    // Ảnh tĩnh: không chạy hiệu ứng vào, không phóng chữ theo cỡ cửa sổ app
    runtime(Object.assign(JSON.parse(JSON.stringify(payload)), { isStatic: true }));
    out = host.querySelector('svg').outerHTML;
  } finally {
    document.body.removeChild(host);
  }
  if (!out.includes('xmlns=')) out = out.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return out;
}
