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

const MAX_DAYS = 10
const dayMonth = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}` // "2026-11-16" -> "16/11"

// Dải điểm danh dạng lưới: mỗi hàng là một lớp, mỗi cột là một ngày học, ngày mới nhất ở bên phải.
// Học viên học nhiều lớp vẫn đọc được từng buổi của từng lớp; lớp không có buổi vào ngày đó hiện ô trống.
// records: [{ id, class_id, date, status }] (thứ tự bất kỳ); classLabel: (class_id) => tên hiển thị của lớp.
export function AttendanceStrip({ records, classLabel = (id) => `Lớp #${id}`, days = MAX_DAYS }) {
  const dates = [...new Set(records.map((r) => r.date))].sort().slice(-days) // cũ -> mới
  const inWindow = new Set(dates)
  const rows = new Map() // class_id -> Map(ngày -> bản ghi)
  for (const r of records) {
    if (!inWindow.has(r.date)) continue
    if (!rows.has(r.class_id)) rows.set(r.class_id, new Map())
    rows.get(r.class_id).set(r.date, r)
  }
  const classIds = [...rows.keys()].sort((a, b) => a - b)
  const gutter = 'w-20 shrink-0 sm:w-24'
  return (
    <div>
      <p className="mb-3 text-xs text-slate-600">
        {dates.length} ngày học gần nhất{classIds.length > 1 ? `, ${classIds.length} lớp` : ''}
      </p>
      <div className="space-y-1.5" aria-hidden="true">
        {classIds.map((cid) => (
          <div key={cid} className="flex items-center gap-2">
            <span className={`${gutter} truncate text-xs font-medium text-slate-700`} title={classLabel(cid)}>
              {classLabel(cid)}
            </span>
            <div className="flex min-w-0 flex-1 gap-1.5">
              {dates.map((d) => {
                const a = rows.get(cid).get(d)
                return a ? (
                  <span
                    key={d}
                    title={`${fmtDate(d)} · ${classLabel(cid)}: ${STRIP[a.status][1]}`}
                    className={`h-6 min-w-0 flex-1 rounded-md sm:h-8 ${STRIP[a.status][0]}`}
                  />
                ) : (
                  <span
                    key={d}
                    title={`${fmtDate(d)} · ${classLabel(cid)}: không có buổi học`}
                    className="h-6 min-w-0 flex-1 rounded-md bg-slate-100 ring-1 ring-inset ring-slate-200 sm:h-8"
                  />
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className={gutter} />
          <div className="flex min-w-0 flex-1 gap-1.5">
            {dates.map((d, i) => (
              <span
                key={d}
                className={`w-0 min-w-0 flex-1 text-center text-[10px] leading-none tabular-nums text-slate-600 ${
                  i === dates.length - 1 ? 'font-bold' : ''
                } ${(dates.length - 1 - i) % 2 ? 'max-sm:invisible' : ''}`}
              >
                {dayMonth(d)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ul className="sr-only">
        {classIds.map((cid) => (
          <li key={cid}>
            {classLabel(cid)}:{' '}
            {dates
              .filter((d) => rows.get(cid).has(d))
              .map((d) => `${dayMonth(d)} ${STRIP[rows.get(cid).get(d).status][1]}`)
              .join('; ')}
          </li>
        ))}
      </ul>
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
