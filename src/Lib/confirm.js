// Hộp xác nhận trong app (thay cho window.confirm).
// window.confirm của Electron trên Windows làm các ô nhập liệu không gõ được nữa sau khi đóng hộp thoại.
let handler = null;

export function setConfirmHandler(fn) {
  handler = fn;
}

export function askConfirm(message) {
  if (handler) return handler(message);
  return Promise.resolve(window.confirm(message));
}
