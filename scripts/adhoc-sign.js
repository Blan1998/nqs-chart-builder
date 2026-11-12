// Ký "ad-hoc" cho bản macOS (không cần tài khoản Apple Developer).
// Máy Mac chip Apple (M1/M2/...) từ chối chạy app hoàn toàn không có chữ ký.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
