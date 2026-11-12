// Bảng ngang cho các loại nhiều chuỗi (Cột cạnh nhau, Kết hợp).
// Mỗi chuỗi có id cố định để đổi tên không làm mất dữ liệu.

export function defaultSeries(spec) {
  return (spec.defaultSeries ?? []).map((item, i) => {
    const o = typeof item === 'string' ? { name: item } : item;
    return { id: `s${i + 1}`, name: o.name, ...(o.kind ? { kind: o.kind } : {}) };
  });
}

// Bảng trống khi mới tạo: tên chuỗi chung chung để người dùng tự đặt theo nhãn trong Excel
export function blankSeries(spec) {
  return (spec.defaultSeries ?? []).map((item, i) => {
    const o = typeof item === 'string' ? {} : item;
    const name = spec.keepDefaultNames ? o.name : `Chuỗi ${i + 1}`;
    return { id: `s${i + 1}`, name, ...(o.kind ? { kind: o.kind } : {}) };
  });
}

export function newSeriesId() {
  return 's' + Math.random().toString(36).slice(2, 8);
}

// Đặc tả động: cột Danh mục + một cột cho mỗi chuỗi
export function wideSpecFor(spec, series) {
  const category = spec.columns[0];
  const meta = (spec.metaColumns ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    type: 'text',
    required: false,
    description: 'Thông tin đi kèm, không dùng để vẽ',
  }));
  return {
    ...spec,
    columns: [
      category,
      ...meta,
      ...series.map((s) => ({
        key: s.id,
        label: s.name,
        type: 'number',
        required: false,
        description: 'Giá trị của chuỗi này',
        kind: s.kind,
        pct: s.pct,
      })),
    ],
  };
}
