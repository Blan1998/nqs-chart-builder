// Kiểm tra cấu trúc đặc tả. Chạy: npm test
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'specs');
const REQUIRED_KEYS = ['id', 'label', 'columns', 'options', 'interactions'];
const ALLOWED_TYPES = ['category', 'number', 'series-name', 'text'];
let errors = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'common.json')) {
  const spec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const key of REQUIRED_KEYS) {
    if (!(key in spec)) { console.error(`[${file}] thiếu trường "${key}"`); errors++; }
  }
  const seen = new Set();
  for (const col of spec.columns || []) {
    if (!ALLOWED_TYPES.includes(col.type)) { console.error(`[${file}] kiểu cột không hợp lệ: ${col.type}`); errors++; }
    if (seen.has(col.key)) { console.error(`[${file}] trùng key cột: ${col.key}`); errors++; }
    seen.add(col.key);
  }
}

if (errors) { console.error(`Có ${errors} lỗi.`); process.exit(1); }
console.log('Tất cả đặc tả hợp lệ.');
