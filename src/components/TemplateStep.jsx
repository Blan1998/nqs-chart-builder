import { useState } from 'react';

const TYPE_LABELS = {
  category: 'Chữ (văn bản)',
  number: 'Số',
  'series-name': 'Chữ (tên chuỗi)',
  text: 'Chữ (văn bản)',
};

// Bước 4: hiển thị cấu trúc cột và tạo file Excel mẫu
export default function TemplateStep({ spec }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function createTemplate() {
    if (!window.excelApi) {
      setMessage('Chức năng này chỉ hoạt động trong app desktop.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await window.excelApi.saveTemplate(spec);
      setMessage(res.ok ? `Đã lưu file mẫu: ${res.filePath}` : 'Đã hủy lưu.');
    } catch (e) {
      setMessage(`Tạo file thất bại: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        File mẫu có 2 sheet: <b>Dữ liệu</b> để nhập số liệu và <b>Hướng dẫn</b> để xem ý nghĩa từng cột.
      </p>

      <h3 className="section-title">Các cột cần có</h3>
      <table className="col-table">
        <thead>
          <tr>
            <th>Cột</th>
            <th>Kiểu dữ liệu</th>
            <th>Bắt buộc</th>
          </tr>
        </thead>
        <tbody>
          {spec.columns.map((c) => (
            <tr key={c.key}>
              <td>{c.label}</td>
              <td>{TYPE_LABELS[c.type] ?? c.type}</td>
              <td>{c.required ? 'Có' : 'Không'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="section-title">Cách dùng</h3>
      <ol>
        <li>Bấm nút bên dưới và chọn nơi lưu file.</li>
        <li>Mở file, xóa các dòng ví dụ (chữ xám), rồi nhập dữ liệu thật.</li>
        <li>Không sửa tên cột. Lưu file và giữ lại để dùng ở bước 5.</li>
      </ol>

      <div className="actions">
        <button onClick={createTemplate} disabled={busy}>
          {busy ? 'Đang tạo...' : 'Tạo file Excel mẫu'}
        </button>
      </div>
      {message && <p className="status-inline">{message}</p>}
    </div>
  );
}
