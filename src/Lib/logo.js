// Chuẩn hóa tên để khớp với tên file logo: bỏ dấu, bỏ khoảng trắng và ký tự đặc biệt, không phân biệt hoa thường.
// "Mirae Asset" khớp với "Mirae-Asset.png", "MIRAE_ASSET.png", "miraeasset.jpg"...
export function normalizeKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
