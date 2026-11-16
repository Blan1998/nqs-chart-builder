const { app, BrowserWindow, shell, ipcMain, dialog, protocol, net, safeStorage } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs/promises');
const ExcelJS = require('exceljs');
const { buildTemplate, parseWorkbook } = require('./templates');

const isDev = !app.isPackaged;

// Đăng ký scheme app:// để bản đóng gói tải giao diện như một trang web bình thường
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.join(__dirname, '..', 'dist', rel);
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'NQS Chart Builder',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL('app://bundle/index.html');
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('project:save', async (event, data) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Lưu cấu hình biểu đồ',
    defaultPath: 'bieu-do.nqs.json',
    filters: [{ name: 'Cấu hình biểu đồ', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('project:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Mở cấu hình biểu đồ',
    filters: [{ name: 'Cấu hình biểu đồ', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { ok: false };
  const text = await fs.readFile(filePaths[0], 'utf8');
  return { ok: true, data: JSON.parse(text) };
});

// Xuất file mẫu (rows = null) hoặc xuất dữ liệu hiện tại
ipcMain.handle('excel:template', async (event, { spec, rows }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: rows ? 'Xuất dữ liệu ra Excel' : 'Lưu file Excel mẫu',
    defaultPath: rows ? `du-lieu-${spec.id}.xlsx` : `mau-du-lieu-${spec.id}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (canceled || !filePath) return { ok: false };
  const wb = await buildTemplate(spec, rows);
  await wb.xlsx.writeFile(filePath);
  return { ok: true, filePath };
});

// Nhập dữ liệu từ file Excel đã điền
ipcMain.handle('excel:import', async (event, { spec }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Nhập dữ liệu từ file Excel',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { ok: false };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePaths[0]);
  const result = parseWorkbook(spec, wb);
  return { ok: true, filePath: filePaths[0], ...result };
});

ipcMain.handle('svg:save', async (event, { svg, filename }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Xuất file SVG',
    defaultPath: filename,
    filters: [{ name: 'SVG', extensions: ['svg'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await fs.writeFile(filePath, svg, 'utf8');
  return { ok: true, filePath };
});


// ===== Trợ lý AI (Gemini): lưu key đã mã hóa, đọc Excel, nhận gợi ý loại biểu đồ =====
const AI_CONFIG = () => path.join(app.getPath('userData'), 'ai-config.json');

async function readApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (typeof __EMBEDDED_OPENAI_KEY__ !== 'undefined' && __EMBEDDED_OPENAI_KEY__) return __EMBEDDED_OPENAI_KEY__;
  try {
    const cfg = JSON.parse(await fs.readFile(AI_CONFIG(), 'utf8'));
    if (!cfg.key) return null;
    const buf = Buffer.from(cfg.key, 'base64');
    return cfg.enc ? safeStorage.decryptString(buf) : buf.toString('utf8');
  } catch (e) {
    return null;
  }
}

ipcMain.handle('ai:status', async () => ({ hasKey: !!(await readApiKey()) }));

ipcMain.handle('ai:setKey', async (event, { key }) => {
  const enc = safeStorage.isEncryptionAvailable();
  const value = enc
    ? safeStorage.encryptString(key).toString('base64')
    : Buffer.from(key, 'utf8').toString('base64');
  await fs.writeFile(AI_CONFIG(), JSON.stringify({ enc, key: value }), 'utf8');
  return { ok: true };
});

function sheetToTable(ws, maxRows = 30, maxCols = 20) {
  const rows = [];
  const lastRow = Math.min(ws.rowCount, maxRows + 1);
  const lastCol = Math.min(ws.columnCount || maxCols, maxCols);
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= lastCol; c++) cells.push(String(row.getCell(c).text ?? '').trim());
    if (cells.some((x) => x !== '')) rows.push(cells);
  }
  return rows;
}

// Thử lần lượt các model; model nào trả 404 (không có trong tài khoản) thì thử model kế tiếp
const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-flash-latest'];

const SYSTEM_PROMPT =
  'Bạn là chuyên gia trực quan hóa dữ liệu cho một tòa soạn báo ở Việt Nam. ' +
  'Từ bảng dữ liệu người dùng cung cấp, hãy chọn tối đa 3 loại biểu đồ phù hợp nhất trong danh sách cho sẵn, ' +
  'chỉ dùng đúng "id" trong danh sách. Trả về JSON đúng dạng: ' +
  '{"suggestions":[{"id":"...","reason":"..."}],"note":"..."}. ' +
  '"reason" là lý do ngắn gọn bằng tiếng Việt. "note" là một câu nhận xét về dữ liệu, ' +
  'ví dụ thiếu dữ liệu hoặc nên sắp xếp lại. Không viết gì ngoài JSON.';

ipcMain.handle('ai:advise', async (event, { chartList }) => {
  const key = await readApiKey();
  if (!key) return { ok: false, error: 'NO_KEY' };

  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Chọn file Excel dữ liệu',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { ok: false, cancelled: true };

  let table;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePaths[0]);
    const ws = wb.worksheets && wb.worksheets[0];
    if (!ws) return { ok: false, error: 'File không có sheet dữ liệu. Hãy mở file trong Excel, Save As > Excel Workbook (.xlsx), rồi thử lại.' };
    table = sheetToTable(ws);
  } catch (e) {
    return { ok: false, error: 'Không đọc được file Excel (' + e.message + '). Hãy mở file trong Excel và lưu lại dạng .xlsx rồi thử lại.' };
  }
  const tableText = table.map((r) => r.join(' | ')).join('\n');
  const userPrompt =
    `Danh sách loại biểu đồ:\n${JSON.stringify(chartList)}\n\n` +
    `Dữ liệu (dòng đầu là tiêu đề cột):\n${tableText}`;

  let res = null;
  let lastStatus = 0;
  for (const model of GEMINI_MODELS) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      });
    } catch (e) {
      return { ok: false, error: 'Không kết nối được tới Gemini. Kiểm tra mạng rồi thử lại.' };
    }
    lastStatus = res.status;
    if (res.status !== 404) break;
    res = null;
  }
  if (!res) {
    return { ok: false, error: `Không tìm thấy model Gemini nào dùng được (lỗi ${lastStatus}). Báo người phát triển cập nhật tên model.` };
  }
  if (!res.ok) {
    return { ok: false, error: `Gemini trả về lỗi ${res.status}. Kiểm tra lại API key hoặc hạn mức.` };
  }

  const data = await res.json();
  let parsed = {};
  try {
    parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
  } catch (e) {
    parsed = {};
  }
  const ids = new Set(chartList.map((c) => c.id));
  const suggestions = (parsed.suggestions ?? []).filter((x) => ids.has(x.id)).slice(0, 3);

  return {
    ok: true,
    fileName: path.basename(filePaths[0]),
    columns: table[0] ?? [],
    rowCount: Math.max(0, table.length - 1),
    suggestions,
    note: parsed.note ?? '',
  };
});


// ===== Phân tích cấu trúc file Excel để tự nhận cột (auto-mapping) =====
async function geminiJson(key, system, user) {
  let res = null;
  let lastStatus = 0;
  for (const model of GEMINI_MODELS) {
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      });
    } catch (e) {
      return { ok: false, error: 'Không kết nối được tới Gemini.' };
    }
    lastStatus = res.status;
    if (res.status !== 404) break;
    res = null;
  }
  if (!res) return { ok: false, error: `Không tìm thấy model Gemini (lỗi ${lastStatus}).` };
  if (!res.ok) return { ok: false, error: `Gemini trả về lỗi ${res.status}.` };
  const data = await res.json();
  try {
    return { ok: true, data: JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') };
  } catch (e) {
    return { ok: false, error: 'Không đọc được phản hồi từ Gemini.' };
  }
}

const AUTO_SYSTEM =
  'Bạn phân tích cấu trúc bảng Excel để vẽ biểu đồ. Xác định: cột "category" là cột mốc thời gian hoặc nhãn trục X ' +
  '(ví dụ Quý, Tháng, Năm, tên đội, tên danh mục); các cột "series" là cột giá trị số cần vẽ thành chuỗi. ' +
  'Bỏ qua cột STT, mã, ghi chú, nguồn. Với biểu đồ kết hợp, gán "kinds" cho từng chuỗi: "bar" cho cột, "line" cho đường. ' +
  'Trả JSON đúng dạng: {"category": <số thứ tự cột, bắt đầu từ 0, hoặc null>, "series": [<số thứ tự các cột>], ' +
  '"kinds": {"<số thứ tự cột>": "bar" hoặc "line"}, "note": "<nhận xét ngắn bằng tiếng Việt, cảnh báo nếu có cột trống hoặc không thống nhất định dạng>"}. ' +
  'Không viết gì ngoài JSON.';

function looksNumeric(v) {
  const t = String(v ?? '').trim();
  return t !== '' && /\d/.test(t) && /^[-+]?[\d.,\s]+%?$/.test(t);
}

// Dự phòng khi không có AI: cột có chữ nhiều hơn số là danh mục, cột có số nhiều hơn là chuỗi
function heuristicMapping(header, data, chartId) {
  const stats = header.map((_, i) => {
    let num = 0, txt = 0;
    data.forEach((r) => {
      const v = (r[i] ?? '').trim();
      if (!v) return;
      if (looksNumeric(v)) num++; else txt++;
    });
    return { i, num, txt };
  });
  const cat = stats.find((s) => s.txt > s.num) ?? stats[0];
  const series = stats.filter((s) => cat && s.i !== cat.i && s.num > 0 && s.num >= s.txt).map((s) => s.i);
  const kinds = {};
  if (chartId === 'combo') series.forEach((i, k) => { kinds[i] = k === 0 ? 'bar' : 'line'; });
  return { category: cat ? cat.i : null, series, kinds };
}

function sanitizeMapping(d, n, chartId) {
  const inRange = (x) => Number.isInteger(x) && x >= 0 && x < n;
  const category = inRange(d.category) ? d.category : null;
  const series = [...new Set((d.series ?? []).filter((x) => inRange(x) && x !== category))];
  if (series.length === 0) return null;
  const kinds = {};
  series.forEach((i) => {
    const k = d.kinds?.[String(i)];
    kinds[i] = ['combo', 'groupedBar', 'stackedBar'].includes(chartId) ? (k === 'line' ? 'line' : 'bar') : undefined;
  });
  return { category, series, kinds };
}

// Tìm dòng tiêu đề, dòng dữ liệu đầu và cuối (dự phòng khi không có AI)
function detectLayout(grid) {
  const info = grid.map((r) => ({
    filled: r.filter((v) => v !== '').length,
    nums: r.filter((v) => looksNumeric(v)).length,
  }));
  const isData = (x) => x && x.nums >= 1 && x.filled >= 2;
  const dataFirst = info.findIndex(isData);
  if (dataFirst < 0) return null;
  let dataLast = dataFirst;
  while (dataLast + 1 < grid.length && isData(info[dataLast + 1])) dataLast++;
  let headerRow = dataFirst - 1;
  while (headerRow >= 0 && info[headerRow].filled < 2) headerRow--;
  return { headerRow, dataFirst, dataLast };
}

const LAYOUT_SYSTEM =
  'Bạn đọc một bảng Excel để vẽ biểu đồ. Bảng có thể có tiêu đề ở đầu, dòng đơn vị, và dòng ghi chú/nguồn ở cuối. ' +
  'Xác định: "headerRow" là chỉ số dòng chứa tên các cột (-1 nếu không có); "dataFirst" và "dataLast" là chỉ số dòng dữ liệu đầu và cuối ' +
  '(không gồm tiêu đề, dòng đơn vị, dòng ghi chú); "category" là chỉ số cột danh mục hoặc mốc thời gian; "series" là các cột giá trị số; ' +
  '"kinds" chỉ cần khi biểu đồ kết hợp: gán "bar" hoặc "line" cho từng cột chuỗi; "note" là nhận xét ngắn bằng tiếng Việt. ' +
  'Trả JSON đúng dạng: {"headerRow":0,"dataFirst":1,"dataLast":10,"category":0,"series":[1,2],"kinds":{"1":"bar"},"note":"..."}. ' +
  'Không viết gì ngoài JSON.';

ipcMain.handle('excel:analyze', async (event, { spec }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Chọn file Excel dữ liệu',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { ok: false, cancelled: true };

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePaths[0]);
  const rows = sheetToTable(wb.worksheets[0], 80, 60);
  if (rows.length < 2) return { ok: false, error: 'File không có dữ liệu.' };

  const width = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));

  const heur = detectLayout(grid);
  let headerRow = heur ? heur.headerRow : -1;
  let dataFirst = heur ? heur.dataFirst : 1;
  let dataLast = heur ? heur.dataLast : grid.length - 1;
  let aiMapping = null;
  let source = 'auto';
  let note = '';

  const key = await readApiKey();
  if (key) {
    const listing = grid.map((r, i) => `${i}: ${r.map((v) => v || '(trống)').join(' | ')}`).join('\n');
    const res = await geminiJson(
      key,
      LAYOUT_SYSTEM,
      `Loại biểu đồ: ${spec.label}. ${spec.desc || ''}\n\nBảng (số đầu dòng là chỉ số dòng, bắt đầu từ 0):\n${listing}`
    );
    if (res.ok) {
      const d = res.data;
      note = d.note ?? '';
      const layoutOk =
        Number.isInteger(d.dataFirst) && Number.isInteger(d.dataLast) &&
        d.dataFirst >= 0 && d.dataLast >= d.dataFirst && d.dataLast < grid.length;
      if (layoutOk) {
        headerRow = Number.isInteger(d.headerRow) && d.headerRow < d.dataFirst ? d.headerRow : -1;
        dataFirst = d.dataFirst;
        dataLast = d.dataLast;
      }
      aiMapping = sanitizeMapping(d, width, spec.id);
      if (aiMapping) source = 'ai';
    } else {
      note = `Không dùng được AI (${res.error}), đã tự nhận theo quy tắc đơn giản.`;
    }
  }

  const header = headerRow >= 0 ? grid[headerRow] : [];
  const names = Array.from({ length: width }, (_, i) => header[i] || `Cột ${i + 1}`);
  const dataRows = grid.slice(dataFirst, dataLast + 1).filter((r) => r.some((v) => v !== ''));

  const mapping = aiMapping ?? heuristicMapping(names, dataRows, spec.id);
  // Cột % : ô có dấu %, hoặc tiêu đề chứa biên/tỷ lệ/%
  const percent = [];
  for (let c = 0; c < width; c++) {
    const vals = dataRows.map((r) => (r[c] ?? '').trim()).filter((v) => v !== '');
    const pctCount = vals.filter((v) => v.endsWith('%')).length;
    const byHeader = /%|biên|bien|tỷ lệ|ty le|margin/i.test(names[c] || '');
    if (vals.length && (pctCount / vals.length >= 0.5 || byHeader)) percent.push(c);
  }
  if (mapping.series.length === 0) {
    return { ok: false, error: 'Không tìm thấy cột số nào để vẽ trong file.' };
  }

  const findCol = (re) => {
    const i = names.findIndex((h) => re.test(h));
    return i >= 0 ? i : null;
  };
  mapping.meta = {
    region: findCol(/region|khu vực|khu vuc|châu lục|chau luc/i),
  };

  return {
    ok: true,
    fileName: path.basename(filePaths[0]),
    header: names,
    rows: dataRows,
    mapping,
    percent,
    source,
    note,
  };
});

// ===== Thư viện logo: đặt tên file trùng với danh mục, AI ghép các tên gần đúng =====
const LOGO_CONFIG = () => path.join(app.getPath('userData'), 'logo-config.json');
const LOGO_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const normKey = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

async function listLogos() {
  // Đã đóng gói: resources/logos. Khi chạy dev: thư mục logos ở gốc dự án
  const folder = app.isPackaged
    ? path.join(process.resourcesPath, 'logos')
    : path.join(__dirname, '..', 'logos');
  const files = new Map();
  if (!folder) return { folder, files };
  try {
    for (const n of await fs.readdir(folder)) {
      const ext = path.extname(n).toLowerCase();
      if (!LOGO_EXT.includes(ext)) continue;
      const key = normKey(path.basename(n, path.extname(n)));
      if (key && !files.has(key)) files.set(key, path.join(folder, n));
    }
  } catch (e) {
    // thư mục không còn tồn tại: coi như trống
  }
  return { folder, files };
}

const LOGO_SYSTEM =
  'Bạn ghép tên danh mục với tên file logo có sẵn. Chỉ ghép khi chắc chắn cùng một đơn vị ' +
  '(ví dụ "Mirae Asset Securities" với khóa "miraeasset"). Nếu không chắc, để null. ' +
  'Trả JSON đúng dạng: {"mapping": {"<tên danh mục>": "<khóa logo>" hoặc null}}. Không viết gì ngoài JSON.';

ipcMain.handle('logo:match', async (event, { categories }) => {
  const { folder, files } = await listLogos();
  if (!folder) return { ok: false, error: 'Không tìm thấy thư mục logo trong ứng dụng.' };
  const aliases = {};
  const unmatched = [];
  categories.forEach((c) => {
    const k = normKey(c);
    if (files.has(k)) aliases[c] = k;
    else unmatched.push(c);
  });
  if (unmatched.length && files.size) {
    const key = await readApiKey();
    if (key) {
      const res = await geminiJson(
        key,
        LOGO_SYSTEM,
        `Danh mục cần tìm logo:\n${JSON.stringify(unmatched)}\n\nKhóa logo có sẵn:\n${JSON.stringify([...files.keys()])}`
      );
      if (res.ok && res.data && res.data.mapping) {
        unmatched.forEach((c) => {
          const k = res.data.mapping[c];
          if (k && files.has(k)) aliases[c] = k;
        });
      }
    }
  }
  const missing = categories.filter((c) => !aliases[c]);
  return { ok: true, aliases, missing };
});

ipcMain.handle('logo:resolve', async (event, { keys }) => {
  const { files } = await listLogos();
  const out = {};
  for (const k of keys) {
    const file = files.get(k);
    if (!file) continue;
    const st = await fs.stat(file);
    if (st.size > 1024 * 1024) continue;
    const ext = path.extname(file).toLowerCase();
    const mime =
      ext === '.svg' ? 'image/svg+xml' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.webp' ? 'image/webp' : 'image/png';
    const buf = await fs.readFile(file);
    out[k] = `data:${mime};base64,${buf.toString('base64')}`;
  }
  return out;
});


// ===== Tự động cập nhật (chỉ khi đã cài bằng bộ cài, đọc bản mới từ GitHub Releases) =====
function setupAutoUpdate() {
  if (isDev) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return;
  }
  autoUpdater.on('error', () => {
    // Lỗi mạng hoặc chưa có bản phát hành: bỏ qua, không làm phiền người dùng
  });

  // macOS: app chưa ký bằng Apple Developer ID nên macOS không cho tự cài đè.
  // Vẫn đọc bản mới từ GitHub Releases, nhưng chỉ báo và mở trang tải.
  if (process.platform === 'darwin') {
    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', async (info) => {
      const win = BrowserWindow.getAllWindows()[0];
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Mở trang tải', 'Để sau'],
        defaultId: 0,
        cancelId: 1,
        title: 'Có bản cập nhật mới',
        message: `NQS Chart Builder ${info.version} đã có.`,
        detail: 'Tải file .dmg mới, kéo vào Applications để thay bản cũ.',
      });
      if (response === 0) shell.openExternal('https://github.com/Blan1998/nqs-chart-builder/releases/latest');
    });
    autoUpdater.checkForUpdates().catch(() => {});
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', async (info) => {
    const win = BrowserWindow.getAllWindows()[0];
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Khởi động lại và cập nhật', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
      title: 'Có bản cập nhật mới',
      message: `NQS Chart Builder ${info.version} đã sẵn sàng.`,
      detail: 'Chọn "Để sau" thì bản mới sẽ tự cài khi bạn thoát app.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  if (!isDev) registerAppProtocol();
  createWindow();
  setupAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
