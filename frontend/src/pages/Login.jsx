import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CalendarCheck, Eye, EyeOff, Sparkles, Wallet } from 'lucide-react'
import { useAuth } from '../auth'
import { ErrorBox, Field, Spinner } from '../components/ui'

const FEATURES = [
  [CalendarCheck, 'Điểm danh và điểm số', 'Ghi nhận từng buổi học, tổng hợp chuyên cần và điểm trung bình.'],
  [Wallet, 'Học phí rõ ràng', 'Theo dõi khoản đã đóng, chưa đóng và quá hạn.'],
  [Sparkles, 'AI Coach', 'Nhận xét bài viết, bài nói tiếng Anh ngay trong hệ thống.'],
]

const GRADIENT = 'bg-gradient-to-br from-brand-200 via-accent-100 to-brand-100'

const Logo = ({ className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 font-display text-xl font-extrabold text-white shadow-lg shadow-brand-500/30">
      E
    </div>
    <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900">EduCenter</span>
  </div>
)

// Vòng phần trăm nhỏ cho thẻ minh họa (số liệu chỉ để trang trí)
function MiniRing({ value }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" style={{ stroke: 'rgb(var(--brand-100))' }} />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#10b981"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-extrabold text-slate-900">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

const MiniBar = ({ label, value, color }) => (
  <div>
    <div className="mb-1 flex justify-between text-[11px] text-slate-600">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value.toFixed(1)}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
    </div>
  </div>
)

// Ba thẻ kính nổi minh họa các chức năng chính của hệ thống. Chỉ hiện khi màn hình đủ cao để không đè lên nội dung.
function Showcase() {
  return (
    <div className="relative mt-8 hidden h-[19rem] w-full max-w-lg [@media(min-height:860px)]:block" aria-hidden="true">
      <div className="glass absolute left-0 top-0 w-60 animate-float rounded-2xl p-4 shadow-xl shadow-brand-900/10">
        <div className="flex items-center gap-4">
          <MiniRing value={0.92} />
          <div>
            <div className="text-xs text-slate-600">Chuyên cần tháng này</div>
            <div className="font-display text-lg font-bold text-slate-900">23/25 buổi</div>
          </div>
        </div>
      </div>

      <div
        className="glass absolute right-0 top-8 w-56 animate-float-slow rounded-2xl p-4 shadow-xl shadow-brand-900/10"
        style={{ animationDelay: '-3s' }}
      >
        <div className="text-xs text-slate-600">Học phí đã thu</div>
        <div className="mt-1 font-display text-xl font-extrabold text-slate-900">13.600.000 ₫</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
        </div>
        <div className="mt-1.5 text-[11px] text-slate-600">68% tổng học phí</div>
      </div>

      <div
        className="glass absolute bottom-0 left-12 w-72 animate-float rounded-2xl p-4 shadow-xl shadow-brand-900/10"
        style={{ animationDelay: '-5s' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-brand-700" />
            AI Coach
          </div>
          <div className="font-display text-xl font-extrabold text-slate-900">
            8.0<span className="text-xs font-medium text-slate-600"> / 10</span>
          </div>
        </div>
        <div className="space-y-2.5">
          <MiniBar label="Từ vựng" value={8.5} color="bg-emerald-500" />
          <MiniBar label="Mạch lạc" value={7.5} color="bg-amber-400" />
          <MiniBar label="Triển khai ý" value={8} color="bg-sky-500" />
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    document.title = 'Đăng nhập · EduCenter'
  }, [])

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <div className={`relative hidden overflow-hidden p-10 text-slate-900 lg:flex lg:flex-col lg:justify-between lg:gap-10 xl:p-12 ${GRADIENT}`}>
        <div className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-accent-200/70 blur-3xl" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgb(var(--brand-400))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--brand-400))_1px,transparent_1px)] [background-size:48px_48px] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          aria-hidden="true"
        />

        <Logo className="relative" />

        <div className="relative">
          <h2 className="max-w-md text-balance font-display text-[38px] font-extrabold leading-[1.1] tracking-tight">
            Quản lý trung tâm gọn gàng, rõ ràng.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(([Icon, title, desc]) => (
              <li key={title} className="flex gap-4">
                <div className="glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display font-bold">{title}</div>
                  <div className="text-sm text-slate-700">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
          <Showcase />
        </div>

        <div className="relative text-sm text-slate-600">FastAPI · PostgreSQL · Docker</div>
      </div>

      <div className="relative flex flex-col overflow-hidden">
        <div className={`relative px-6 pb-12 pt-8 text-slate-900 lg:hidden ${GRADIENT}`}>
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
          <Logo className="relative" />
          <p className="relative mt-4 max-w-xs font-display text-xl font-bold leading-snug">Quản lý trung tâm gọn gàng, rõ ràng.</p>
        </div>

        <div className="pointer-events-none absolute -right-24 top-1/4 hidden h-80 w-80 rounded-full bg-brand-200/40 blur-3xl lg:block" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 hidden h-72 w-72 rounded-full bg-accent-200/40 blur-3xl lg:block" aria-hidden="true" />

        <div className="relative -mt-5 flex flex-1 items-center justify-center rounded-t-3xl bg-[rgb(var(--page))] p-6 lg:mt-0 lg:rounded-none lg:bg-transparent">
          <form
            onSubmit={submit}
            className="w-full max-w-sm space-y-5 lg:rounded-3xl lg:bg-white/85 lg:p-8 lg:shadow-xl lg:shadow-brand-900/10 lg:ring-1 lg:ring-slate-200/70 lg:backdrop-blur"
          >
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Chào mừng trở lại</div>
              <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900">Đăng nhập</h1>
              <p className="mt-1 text-sm text-slate-600">Nhập tài khoản do trung tâm cấp để tiếp tục.</p>
            </div>
            <ErrorBox message={error} />
            <Field label="Tên đăng nhập">
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
            <Field label="Mật khẩu">
              <div className="relative">
                <input
                  className="input !pr-11"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy && <Spinner />}
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
