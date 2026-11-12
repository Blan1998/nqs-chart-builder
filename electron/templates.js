// Đọc và ghi file Excel (bước 4). Chạy trong tiến trình chính của Electron.
const ExcelJS = require('exceljs');

// Dữ liệu ví dụ cho từng loại. Thêm loại mới thì thêm một dòng ở đây.
const SAMPLE_ROWS = {
  pie: [
    ['Nhóm A', 35],
    ['Nhóm B', 25],
    ['Nhóm C', 40],
  ],
  bar: [
    ['2022', 120],
    ['2023', 150],
    ['2024', 180],
  ],
  line: [
    ['2024-Q1', 'Doanh thu', 42.5],
    ['2024-Q2', 'Doanh thu', 45],
    ['2024-Q3', 'Doanh thu', 47.2],
    ['2024-Q1', 'Chi phí', 30],
    ['2024-Q2', 'Chi phí', 31.5],
    ['2024-Q3', 'Chi phí', 33],
  ],
};

SAMPLE_ROWS.groupedBar = [
  ['Bán hàng', 78, 65],
  ['Tài chính', 60, 65],
  ['Marketing', 45, 65],
  ['Nhân sự', 30, 65],
];

SAMPLE_ROWS.combo = [
  ['Q4/2024', 1826.1, 216.5],
  ['Q1/2025', 1269.1, 211.9],
  ['Q2/2025', 1990.8, 320.5],
  ['Q3/2025', 1609.6, 257.6],
  ['Q4/2025', 1881.4, 202.8],
  ['Q1/2026', 1478.1, 254.4],
  ['Q2/2026', 2150.0, 477.6],
  ['Q3/2026', 2106.1, 289.6],
];

SAMPLE_ROWS.stackedBar = [
  ['2019', 49, 5, 7, 23, 16],
  ['2020', 64.8, 6.1, 4.4, 16.3, 8.4],
  ['2021', 62.9, 4.3, 2.6, 13.8, 16.4],
  ['Quý 1/2022', 36.7, 8.1, 7.4, 18.2, 29.6],
];
SAMPLE_ROWS.rankBar = [
  ['Dallas Mavericks', 8250],
  ['Oklahoma City Thunder', 5050],
  ['LA Lakers', 3350],
  ['Miami Heat', 2750],
  ['Phoenix Suns', 2300],
  ['Indiana Pacers', 2150],
  ['Charlotte Hornets', 2130],
];

SAMPLE_ROWS.barRace = [["Argentina", 15177907, 15550745, 15916161, 16283191, 16650738, 17017602, 17383414], ["Australia", 8378309, 8589875, 8832932, 9034955, 9245383, 9459784, 9709943], ["Algeria", 3394203, 3626403, 3882767, 4154288, 4443887, 4753164, 5041536], ["Austria", 4561167, 4592914, 4624644, 4658034, 4692726, 4726878, 4763809], ["Azerbaijan", 2051432, 2110437, 2171811, 2233683, 2293590, 2349763, 2401556], ["Armenia", 960955, 1012429, 1065431, 1119584, 1174558, 1229978, 1285571], ["Afghanistan", 755783, 796042, 838885, 884370, 932848, 984301, 1038888], ["Angola", 588866, 621212, 657233, 695164, 734733, 775661, 818062]];
SAMPLE_ROWS.lineRank = [["Argentina", 15177907, 15550745, 15916161, 16283191, 16650738, 17017602, 17383414], ["Australia", 8378309, 8589875, 8832932, 9034955, 9245383, 9459784, 9709943], ["Algeria", 3394203, 3626403, 3882767, 4154288, 4443887, 4753164, 5041536], ["Austria", 4561167, 4592914, 4624644, 4658034, 4692726, 4726878, 4763809], ["Azerbaijan", 2051432, 2110437, 2171811, 2233683, 2293590, 2349763, 2401556], ["Armenia", 960955, 1012429, 1065431, 1119584, 1174558, 1229978, 1285571], ["Afghanistan", 755783, 796042, 838885, 884370, 932848, 984301, 1038888], ["Angola", 588866, 621212, 657233, 695164, 734733, 775661, 818062]];

const TYPE_LABELS = {
  category: 'Chữ (văn bản)',
  number: 'Số',
  'series-name': 'Chữ (tên chuỗi)',
  text: 'Chữ (văn bản)',
};

const HEADER_FILL = 'FFFF6201';
const SAMPLE_FONT = 'FF94A3B8';

function colLetter(index) {
  return String.fromCharCode(65 + index);
}

function toNumberOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const s = String(v).trim();
  const n = Number(s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

// rows: dữ liệu hiện tại để xuất. Nếu không có thì xuất dòng ví dụ.
async function buildTemplate(spec, rows) {
  const hasData = Array.isArray(rows) && rows.length > 0;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NQS Chart Builder';
  wb.title = spec.label;

  const ws = wb.addWorksheet('Dữ liệu');
  ws.columns = spec.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(18, c.label.length + 4),
  }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  if (hasData) {
    for (const r of rows) {
      ws.addRow(
        spec.columns.map((c) => {
          if (c.type === 'number') {
            const n = toNumberOrNull(r[c.key]);
            return n ?? (r[c.key] ?? null);
          }
          return r[c.key] ?? null;
        })
      );
    }
  } else {
    for (const row of SAMPLE_ROWS[spec.id] ?? []) {
      const r = ws.addRow(row);
      r.font = { italic: true, color: { argb: SAMPLE_FONT } };
    }
    const noteCol = spec.columns.length + 2;
    ws.getCell(1, noteCol).value = 'Ghi chú';
    ws.getCell(1, noteCol).font = { bold: true };
    ws.getCell(2, noteCol).value = 'Các dòng chữ xám là dữ liệu ví dụ. Xóa chúng trước khi nhập dữ liệu thật.';
    ws.getColumn(noteCol).width = 60;
  }

  spec.columns.forEach((c, i) => {
    if (c.type === 'number' && c.min !== undefined) {
      ws.dataValidations.add(`${colLetter(i)}2:${colLetter(i)}1000`, {
        type: 'decimal',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [c.min],
        showErrorMessage: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: `Cột "${c.label}" phải là số lớn hơn hoặc bằng ${c.min}.`,
      });
    }
  });

  const g = wb.addWorksheet('Hướng dẫn');
  g.columns = [
    { header: 'Cột', key: 'name', width: 34 },
    { header: 'Ý nghĩa', key: 'desc', width: 50 },
    { header: 'Kiểu dữ liệu', key: 'type', width: 20 },
    { header: 'Bắt buộc', key: 'req', width: 12 },
  ];
  const gh = g.getRow(1);
  gh.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  gh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };

  for (const c of spec.columns) {
    g.addRow({
      name: c.label,
      desc: c.description ?? '',
      type: TYPE_LABELS[c.type] ?? c.type,
      req: c.required ? 'Có' : 'Không',
    });
  }
  g.addRow([]);
  g.addRow(['Quy tắc nhập']).font = { bold: true };
  g.addRow(['Không sửa tên cột ở sheet "Dữ liệu".']);
  for (const v of spec.validation ?? []) g.addRow([`• ${v}`]);

  return wb;
}

// Đọc sheet "Dữ liệu" và trả về các dòng dưới dạng chuỗi, đúng khóa của đặc tả
function parseWorkbook(spec, wb) {
  const ws = wb.getWorksheet('Dữ liệu') ?? wb.worksheets[0];
  if (!ws) return { error: 'File không có sheet nào.' };

  const colByKey = {};
  ws.getRow(1).eachCell((cell, colNumber) => {
    const label = String(cell.text ?? '').trim();
    const col = spec.columns.find((c) => c.label === label);
    if (col) colByKey[col.key] = colNumber;
  });

  const missing = spec.columns.filter((c) => !colByKey[c.key]).map((c) => c.label);
  if (missing.length) {
    return { error: `File thiếu cột: ${missing.join(', ')}. Hãy dùng file mẫu của loại biểu đồ này.` };
  }

  const rows = [];
  let skippedSamples = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const font = row.getCell(1).font ?? {};
    if (font.italic && font.color && font.color.argb === SAMPLE_FONT) {
      skippedSamples++;
      continue;
    }
    const obj = {};
    let hasValue = false;
    for (const c of spec.columns) {
      const cell = row.getCell(colByKey[c.key]);
      const text = typeof cell.value === 'number' ? String(cell.value) : String(cell.text ?? '');
      obj[c.key] = text.trim();
      if (obj[c.key] !== '') hasValue = true;
    }
    if (hasValue) rows.push(obj);
  }
  return { rows, skippedSamples };
}

module.exports = { buildTemplate, parseWorkbook };