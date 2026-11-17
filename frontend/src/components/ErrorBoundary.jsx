import { Component } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'

// Bắt lỗi khi vẽ giao diện để một trang hỏng không làm cả ứng dụng thành màn hình trắng.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Giao diện gặp lỗi:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={this.props.fullPage ? 'flex min-h-screen items-center justify-center p-6' : 'py-10'}>
        <div role="alert" className="card mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Trang này gặp lỗi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Có sự cố khi hiển thị nội dung. Bạn thử tải lại trang; nếu vẫn lỗi, hãy báo cho quản trị viên.
          </p>
          <div className="mt-5 flex gap-2">
            <button className="btn-ghost" onClick={() => this.setState({ error: null })}>
              Thử lại
            </button>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Tải lại trang
            </button>
          </div>
        </div>
      </div>
    )
  }
}
