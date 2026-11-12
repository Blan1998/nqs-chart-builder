// Tăng số patch của phiên bản trước mỗi lần đóng gói: 0.1.0 -> 0.1.1 -> 0.1.2 ...
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const parts = pkg.version.split('.').map(Number);
parts[2] += 1;
pkg.version = parts.join('.');
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Phiên bản đóng gói:', pkg.version);
