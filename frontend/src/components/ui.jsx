import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, CircleAlert, CircleCheck, Inbox, LoaderCircle, Search, X } from 'lucide-react'

// Tải dữ liệu bất đồng bộ: { data, error, loading, refreshing, reload }
//  - loading: chỉ true khi chưa có dữ liệu nào (lần tải đầu, hoặc khi đổi điều kiện tải như chọn học viên khác)
//  - reload(): tải lại sau khi thao tác; giữ nguyên dữ liệu cũ trên màn hình (refreshing = true) để trang không nháy
//  - kết quả của lần gọi cũ về muộn hơn lần gọi mới sẽ bị bỏ qua
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true, refreshing: false })
  const latest = useRef(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  const load = useCallback(
    (keep) => {
      const id = ++latest.current
      setState((s) =>
        keep && s.data !== null
          ? { ...s, error: '', refreshing: true }
          : { data: null, error: '', loading: true, refreshing: false },
      )
      return run().then(
        (data) => {
          if (id === latest.current) setState({ data, error: '', loading: false, refreshing: false })
        },
        (e) => {
          if (id === latest.current) {
            setState({ data: null, error: e.message || 'Có lỗi xảy ra.', loading: false, refreshing: false })
          }
        },
      )
    },
    [run],
  )

  useEffect(() => {
    load(false)
  }, [load])

  const reload = useCallback(() => load(true), [load])
  return { ...state, reload }
}

// Khung chờ thay cho dòng chữ "Đang tải…"
export function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      <div className="skeleton h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton h-48" />
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />
}

export function ErrorBox({ message }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function Notice({ message }) {
  if (!message) return null
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700"
    >
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// back: { to, label } hiện liên kết quay lại phía trên tiêu đề. Cũng đặt tiêu đề tab trình duyệt.
export function PageTitle({ title, subtitle, back, children }) {
  useEffect(() => {
    document.title = `${title} · EduCenter`
  }, [title])

  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function Badge({ tone = 'gray', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

// Dòng trống trong bảng
export function EmptyRow({ cols, children }) {
  return (
    <tr className="hover:!bg-transparent">
      <td colSpan={cols} className="px-4 py-12 text-center">
        <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <span className="text-sm text-slate-500">{children}</span>
      </td>
    </tr>
  )
}

// Khối trống dùng ngoài bảng (danh sách thẻ, trang chưa có dữ liệu)
export function EmptyState({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="card flex flex-col items-center py-14 text-center">
      <div className="relative mb-5 flex h-24 w-24 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-brand-50" />
        <span className="absolute inset-3 rounded-full bg-brand-100/70" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-md ring-1 ring-brand-100">
          <Icon className="h-7 w-7" />
        </span>
      </div>
      <div className="font-display text-base font-bold text-slate-900">{title}</div>
      {children && <div className="mt-1.5 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  )
}

// Số đếm tăng dần từ 0 (hoặc từ giá trị trước) tới value; tôn trọng chế độ "giảm chuyển động"
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 900 }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setShown(value)
      return undefined
    }
    const start = performance.now()
    const origin = from.current
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const next = origin + (value - origin) * (1 - Math.pow(1 - t, 3))
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{format(typeof value === 'number' ? shown : value)}</>
}

// Biểu tượng nền chuyển màu kèm quầng sáng cùng tông
const STAT_TONES = {
  brand: { badge: 'from-brand-500 to-accent-500 shadow-brand-500/30', wash: 'from-brand-500 to-accent-500' },
  emerald: { badge: 'from-emerald-500 to-teal-500 shadow-emerald-500/30', wash: 'from-emerald-500 to-teal-500' },
  amber: { badge: 'from-amber-400 to-orange-500 shadow-amber-500/30', wash: 'from-amber-400 to-orange-500' },
  rose: { badge: 'from-rose-500 to-pink-500 shadow-rose-500/30', wash: 'from-rose-500 to-pink-500' },
  sky: { badge: 'from-sky-500 to-cyan-500 shadow-sky-500/30', wash: 'from-sky-500 to-cyan-500' },
}

// Số liệu lớn kèm biểu tượng. Truyền value là số thì tự chạy hiệu ứng đếm; với số tiền thì truyền amount và format.
export function StatCard({ icon: Icon, tone = 'brand', label, value, amount, format, hint }) {
  const t = STAT_TONES[tone]
  const counted = typeof amount === 'number' ? amount : typeof value === 'number' ? value : null
  return (
    <div className="card relative overflow-hidden !p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover sm:!p-5">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.09] ${t.wash}`}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm font-medium text-slate-500">{label}</div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${t.badge}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative mt-3 whitespace-nowrap font-display text-[28px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
        {counted !== null ? <AnimatedNumber value={counted} format={format} /> : value}
      </div>
      {hint && <div className="relative mt-2 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

// Vòng tròn phần trăm (value từ 0 đến 1). color là màu CSS bất kỳ; mặc định theo màu chủ đạo của bảng màu.
export function Ring({ value, color = 'rgb(var(--brand-600))', label, caption, display, compact = false }) {
  const r = 44
  const c = 2 * Math.PI * r
  const v = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value))
  return (
    <div className={`flex items-center ${compact ? 'gap-4' : 'gap-5'}`}>
      <svg
        viewBox="0 0 100 100"
        className={`shrink-0 -rotate-90 ${compact ? 'h-20 w-20' : 'h-28 w-28'}`}
        role="img"
        aria-label={`${label}: ${Math.round(v * 100)}%`}
      >
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" style={{ stroke: 'rgb(var(--neutral-100))' }} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{
            stroke: color,
            transition: 'stroke-dasharray 800ms cubic-bezier(0.2, 0.7, 0.2, 1)',
            filter: `drop-shadow(0 2px 4px color-mix(in srgb, ${color} 35%, transparent))`,
          }}
        />
      </svg>
      <div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-display font-extrabold tracking-tight text-slate-900`}>
          {display ?? (value === null || value === undefined ? '—' : `${Math.round(v * 100)}%`)}
        </div>
        {caption && <div className="mt-0.5 text-xs text-slate-500">{caption}</div>}
      </div>
    </div>
  )
}

const AVATAR_COLORS = [
  'from-brand-500 to-accent-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-lime-500 to-green-500',
  'from-blue-500 to-brand-500',
  'from-teal-500 to-sky-500',
]

// Mỗi người một màu cố định (theo tên) để dễ phân biệt trong danh sách
const colorOf = (name) => AVATAR_COLORS[[...String(name || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length]

export function Avatar({ name, size = 'md' }) {
  const parts = (name || '?').trim().split(/\s+/)
  const initials = (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase()
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-bold text-white shadow-sm ring-2 ring-white ${colorOf(name)} ${sizes[size]}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

const CLASS_COLORS = [
  'from-brand-500 to-accent-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
]

// Ô vuông màu mang hai chữ đầu của mã lớp. Màu lấy theo mã lớp nên một lớp luôn cùng màu ở mọi trang.
export function ClassMark({ code, large = false }) {
  const hash = [...String(code || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11)
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-display font-extrabold text-white shadow-md ${
        CLASS_COLORS[hash % CLASS_COLORS.length]
      } ${large ? 'h-14 w-14 rounded-2xl text-base' : 'h-11 w-11 rounded-xl text-sm'}`}
      aria-hidden="true"
    >
      {String(code || '?').slice(0, 2)}
    </div>
  )
}

// Ô tìm kiếm có biểu tượng kính lúp và nút xóa nhanh
export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        inputMode="search"
        className="input !pl-10 !pr-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Xóa nội dung tìm kiếm"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// Bộ chọn dạng nút (lọc theo trạng thái, chọn loại bài...). options: [{ value, label, icon?, count? }]
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1">
      {options.map((o) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
              on ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {o.label}
            {o.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-xs font-bold tabular-nums ${
                  on ? 'bg-brand-50 text-brand-700' : 'bg-slate-300/60 text-slate-600'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const BAR_TONES = {
  brand: 'bg-brand-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  blue: 'bg-sky-500',
}

// Thanh tiến độ (value từ 0 đến 1)
export function ProgressBar({ value, tone = 'brand', label, className = '' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-full rounded-full transition-all duration-500 ${BAR_TONES[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Điểm tối đa 10 (hoặc max) được tô màu: từ 80% trở lên xanh, từ 50% vàng, dưới 50% đỏ
const SCORE_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function scoreTone(value, max = 10) {
  const ratio = max > 0 ? value / max : 0
  return ratio >= 0.8 ? 'green' : ratio >= 0.5 ? 'amber' : 'red'
}

export function ScoreChip({ value, max = 10 }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ring-1 ring-inset ${SCORE_TONES[scoreTone(value, max)]}`}
    >
      {fmtScore(value)}
      <span className="text-xs font-medium">/ {fmtScore(max)}</span>
    </span>
  )
}

// Màu theo ngưỡng của luật rủi ro ở backend (services/insights.py):
// chuyên cần dưới 60% là rất thấp, dưới 80% là thấp; điểm trung bình dưới 5 là rất thấp, dưới 6.5 là thấp.
const TEXT_TONE = { green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-rose-600', gray: 'text-slate-500' }

export const attendanceTone = (rate) =>
  rate === null || rate === undefined ? 'gray' : rate < 0.6 ? 'red' : rate < 0.8 ? 'amber' : 'green'
export const averageTone = (avg) =>
  avg === null || avg === undefined ? 'gray' : avg < 5 ? 'red' : avg < 6.5 ? 'amber' : 'green'

// Con số được tô màu theo tone ('green' | 'amber' | 'red' | 'gray')
export const Metric = ({ tone = 'gray', children }) => (
  <span className={`font-semibold tabular-nums ${TEXT_TONE[tone]}`}>{children}</span>
)

export const ATTENDANCE = {
  present: { label: 'Có mặt', tone: 'green' },
  late: { label: 'Đi trễ', tone: 'amber' },
  absent: { label: 'Vắng', tone: 'red' },
  excused: { label: 'Vắng có phép', tone: 'blue' },
}

export const TUITION = {
  unpaid: { label: 'Chưa đóng', tone: 'amber' },
  paid: { label: 'Đã đóng', tone: 'green' },
  overdue: { label: 'Quá hạn', tone: 'red' },
}

// Nhãn tiếng Việt cho các loại điểm hay dùng; loại khác giữ nguyên chữ giáo viên nhập (viết hoa chữ đầu)
export function scoreKindLabel(kind) {
  const k = String(kind || '').trim()
  const lower = k.toLowerCase()
  if (lower === 'midterm') return 'Giữa kỳ'
  if (lower === 'final') return 'Cuối kỳ'
  const quiz = /^quiz[\s_-]*(\d+)?$/.exec(lower)
  if (quiz) return quiz[1] ? `Quiz ${quiz[1]}` : 'Quiz'
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : '—'
}

// Chuỗi 'YYYY-MM-DD' phải đọc theo giờ địa phương, nếu không sẽ lệch ngày ở múi giờ phía tây Greenwich
function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
}

export const money = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' ₫'
export const percent = (r) => (r === null || r === undefined ? '—' : `${(r * 100).toFixed(0)}%`)
export const fmtDate = (iso) => (iso ? parseDate(iso).toLocaleDateString('vi-VN') : '—')
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—')
// Điểm: bỏ số 0 thừa (7 thay vì 7.00, 6.7 thay vì 6.70), tối đa 2 chữ số thập phân
export const fmtScore = (v) => (v === null || v === undefined ? '—' : String(Number(Number(v).toFixed(2))))

// Bỏ dấu tiếng Việt và đổi về chữ thường để tìm kiếm không phân biệt dấu ("hoang" khớp "Hoàng")
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')

// Số ngày từ hôm nay đến ngày iso (âm nghĩa là đã qua)
export function daysFromToday(iso) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((parseDate(iso) - today) / 86400000)
}
