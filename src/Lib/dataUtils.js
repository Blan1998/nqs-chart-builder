// Tiện ích kiểm tra dữ liệu nhập tay. Dùng chung cho giao diện và các bước sau.

export function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

// Chấp nhận số thập phân dạng 42.5 hoặc 42,5
export function toNumber(v) {
  if (isBlank(v)) return NaN;
  const s = String(v).trim().replace(/%$/, '').trim();
  const normalized = s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
  return Number(normalized);
}

// Trả về danh sách lỗi: { row (0 = dòng đầu, -1 = lỗi chung), key, message }
export function validateRows(spec, rows) {
  const errors = [];
  // level: 'error' chặn việc đi tiếp, 'warn' chỉ cảnh báo
  const add = (row, key, message, level = 'warn') => errors.push({ row, key, message, level });

  if (rows.length === 0) {
    add(-1, null, 'Chưa có dữ liệu.', 'error');
    return errors;
  }

  // Kiểm tra từng ô: bắt buộc và kiểu số
  rows.forEach((r, i) => {
    spec.columns.forEach((c) => {
      if (isBlank(r[c.key])) {
        if (c.required) add(i, c.key, `Thiếu "${c.label}".`);
        return;
      }
      if (c.type === 'number') {
        const n = toNumber(r[c.key]);
        if (Number.isNaN(n)) {
          add(i, c.key, `"${c.label}" phải là số.`);
        } else if (c.min !== undefined && n < c.min) {
          add(i, c.key, `"${c.label}" phải lớn hơn hoặc bằng ${c.min}.`);
        }
      }
    });
  });

  // Trùng tên phân loại (Pie, Bar)
  if (spec.id === 'pie' || spec.id === 'bar' || spec.id === 'rankBar') {
    const seen = new Map();
    rows.forEach((r, i) => {
      if (isBlank(r.category)) return;
      const k = String(r.category).trim();
      if (seen.has(k)) add(i, 'category', `"${k}" bị trùng với dòng ${seen.get(k) + 1}.`);
      else seen.set(k, i);
    });
  }

  // Line: không trùng (chuỗi, mốc X), và mỗi chuỗi có đủ mọi mốc X
  if (spec.id === 'line') {
    const seen = new Map();
    const xsBySeries = new Map();
    const allXs = new Set();
    rows.forEach((r, i) => {
      if (isBlank(r.x) || isBlank(r.series)) return;
      const x = String(r.x).trim();
      const s = String(r.series).trim();
      const k = `${s}|${x}`;
      if (seen.has(k)) add(i, 'x', `Mốc "${x}" của chuỗi "${s}" bị trùng với dòng ${seen.get(k) + 1}.`);
      else seen.set(k, i);
      if (!xsBySeries.has(s)) xsBySeries.set(s, new Set());
      xsBySeries.get(s).add(x);
      allXs.add(x);
    });
    for (const [s, xs] of xsBySeries) {
      const missing = [...allXs].filter((x) => !xs.has(x));
      if (missing.length) add(-1, null, `Chuỗi "${s}" thiếu mốc: ${missing.join(', ')}.`);
    }
  }

  // Cột cạnh nhau (bảng ngang): tên chuỗi không rỗng, không trùng; danh mục không trùng
  if (spec.id === 'groupedBar' || spec.id === 'combo' || spec.id === 'stackedBar' || spec.id === 'barRace' || spec.id === 'lineRank') {
    const names = spec.columns.slice(1).map((c) => String(c.label ?? '').trim());
    names.forEach((n, k) => {
      if (!n) add(-1, null, `Chuỗi thứ ${k + 1} chưa có tên.`);
    });
    const dup = [...new Set(names.filter((n, idx) => n && names.indexOf(n) !== idx))];
    if (dup.length) add(-1, null, `Tên chuỗi bị trùng: ${dup.join(', ')}.`);

    const seenCat = new Map();
    rows.forEach((r, i) => {
      if (isBlank(r.category)) return;
      const cat = String(r.category).trim();
      if (seenCat.has(cat)) add(i, 'category', `Danh mục "${cat}" bị trùng với dòng ${seenCat.get(cat) + 1}.`);
      else seenCat.set(cat, i);
    });
  }

  // Pie: tổng phải lớn hơn 0
  if (spec.id === 'pie' && rows.some((r) => !isBlank(r.value))) {
    const total = rows.reduce((sum, r) => {
      const n = toNumber(r.value);
      return Number.isNaN(n) ? sum : sum + n;
    }, 0);
    if (total <= 0) add(-1, null, 'Tổng các giá trị phải lớn hơn 0.');
  }

  return errors;
}
