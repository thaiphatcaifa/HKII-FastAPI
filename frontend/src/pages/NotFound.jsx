import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { PageTitle } from '../components/ui'

export default function NotFound() {
  return (
    <>
      <PageTitle title="Không tìm thấy trang" />
      <div className="card flex flex-col items-center py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Compass className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Trang bạn tìm không tồn tại</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Đường dẫn có thể đã bị đổi hoặc nhập sai. Bạn hãy quay về trang tổng quan để chọn lại.
        </p>
        <Link to="/" className="btn-primary mt-6">
          Về trang tổng quan
        </Link>
      </div>
    </>
  )
}
