import { useEffect, useState } from 'react'
import { ProgressBar, fmtDate } from './ui'

// Các biểu đồ vẽ bằng SVG thuần, không cần thêm thư viện.

// true sau khung hình đầu tiên, để các hình chạy hiệu ứng vẽ từ trạng thái rỗng
function useMounted() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return on
}

// Vòng tròn chia phần. segments: [{ label, value, color }]; children hiện ở giữa vòng.
export function Donut({ segments, size = 176, thickness = 20, label, children }) {
  const ready = useMounted()
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const visible = segments.filter((s) => s.value > 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const gap = visible.length > 1 ? 3 : 0
  let offset = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} style={{ stroke: 'rgb(var(--neutral-100))' }} />
        {total > 0 &&
          visible.map((s) => {
            const len = (s.value / total) * c
            const dash = ready ? Math.max(0, len - gap) : 0
            const start = offset
            offset += len
            return (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-start}
                style={{ stroke: s.color, transition: 'stroke-dasharray 1000ms cubic-bezier(0.2, 0.7, 0.2, 1)' }}
              />
            )
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

// Chú giải cho Donut. items: [{ label, display, color, hint? }]
export function Legend({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-500">{i.label}</div>
            <div className="truncate font-display text-[15px] font-bold tabular-nums text-slate-900">{i.display}</div>
          </div>
          {i.hint && <div className="text-xs tabular-nums text-slate-500">{i.hint}</div>}
        </li>
      ))}
    </ul>
  )
}

// Danh sách thanh ngang so sánh. items: [{ label, sub?, value (0..1), display, tone }]
export function BarList({ items }) {
  return (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <span className="truncate text-sm font-semibold text-slate-800">{i.label}</span>
              {i.sub && <span className="ml-2 text-xs text-slate-500">{i.sub}</span>}
            </div>
            <span className="shrink-0 font-display text-sm font-bold tabular-nums text-slate-900">{i.display}</span>
          </div>
          <ProgressBar value={i.value} tone={i.tone} label={`${i.label}: ${i.display}`} />
        </li>
      ))}
    </ul>
  )
}

const STRIP = {
  present: ['bg-emerald-500', 'Có mặt'],
  late: ['bg-amber-400', 'Đi trễ'],
  absent: ['bg-rose-500', 'Vắng'],
  excused: ['bg-sky-400', 'Vắng có phép'],
}

// Dải điểm danh: mỗi buổi một thanh màu, buổi mới nhất ở bên phải. records: [{ date, status }] (mới nhất trước)
export function AttendanceStrip({ records }) {
  const ordered = [...records].reverse()
  return (
    <div>
      <div className="flex items-end gap-1.5" role="img" aria-label="Điểm danh các buổi gần nhất">
        {ordered.map((a, i) => (
          <span
            key={a.id ?? i}
            title={`${fmtDate(a.date)}: ${STRIP[a.status][1]}`}
            className={`h-9 flex-1 rounded-lg ${STRIP[a.status][0]} ${i === ordered.length - 1 ? 'opacity-100' : 'opacity-80'}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {Object.values(STRIP).map(([bg, text]) => (
          <span key={text} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${bg}`} />
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
