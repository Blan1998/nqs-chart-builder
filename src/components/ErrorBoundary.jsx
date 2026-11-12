import { Component } from 'react';

// Bắt lỗi khi giao diện đang dựng, hiện thông báo thay vì màn hình trắng
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ color: '#b91c1c' }}>Có lỗi khi hiển thị ứng dụng</h2>
          <p>Vui lòng chụp ảnh màn hình này và gửi cho người phát triển:</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', padding: 16, borderRadius: 8 }}>
            {String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
