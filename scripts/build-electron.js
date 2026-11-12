// Gộp mã Electron thành dist-electron/. Nếu có file ai-key.txt ở thư mục gốc,
// key trong file được nhúng vào bản build để mọi người dùng khỏi phải nhập.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const keyFile = path.join(root, 'ai-key.txt');
const key = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  external: ['electron', 'electron-updater'],
  define: { __EMBEDDED_OPENAI_KEY__: JSON.stringify(key) },
  logLevel: 'warning',
};

(async () => {
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'electron/main.js')],
    outfile: path.join(root, 'dist-electron/main.js'),
  });
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'electron/preload.js')],
    outfile: path.join(root, 'dist-electron/preload.js'),
  });
  console.log(key ? 'Đã nhúng API key vào bản build.' : 'Không có ai-key.txt: app sẽ hỏi API key khi dùng.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
