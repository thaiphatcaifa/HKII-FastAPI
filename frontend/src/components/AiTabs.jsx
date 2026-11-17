import { Fragment, useState } from 'react'
import {
  CircleCheck,
  EyeOff,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { api } from '../api'
import { useConfirm, useToast } from './feedback'
import {
  Avatar,
  Badge,
  EmptyRow,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  Metric,
  ProgressBar,
  Segmented,
  Spinner,
  attendanceTone,
  averageTone,
  fmtDate,
  fmtScore,
  percent,
  useAsync,
} from './ui'

const PROVIDER = {
  gemini: { label: 'Gemini', tone: 'blue' },
  rules: { label: 'Theo luật', tone: 'gray' },
}

const LEVEL = {
  high: { label: 'Rủi ro cao', tone: 'red', bar: 'red' },
  medium: { label: 'Rủi ro trung bình', tone: 'amber', bar: 'amber' },
  low: { label: 'Ổn định', tone: 'green', bar: 'green' },
}

const NameCell = ({ name }) => (
  <div className="flex items-center gap-3">
    <Avatar name={name} size="sm" />
    <span className="whitespace-nowrap font-medium text-slate-900">{name}</span>
  </div>
)

const ProviderBadge = ({ provider }) => {
  const p = PROVIDER[provider] || PROVIDER.rules
  return <Badge tone={p.tone}>{p.label}</Badge>
}

const TILES = [
  ['high', 'Rủi ro cao', ShieldAlert, 'bg-rose-50 text-rose-600'],
  ['medium', 'Rủi ro trung bình', TriangleAlert, 'bg-amber-50 text-amber-600'],
  ['low', 'Ổn định', CircleCheck, 'bg-emerald-50 text-emerald-600'],
]

// ---------- Tab: cảnh báo học viên có rủi ro ----------
// API: GET /ai/risk (luật), POST /ai/risk/advice (AI gợi ý hành động)
export function RiskTab({ classId }) {
  const toast = useToast()
  const risk = useAsync(() => api.get(`/ai/risk?class_id=${classId}`), [classId])
  const [advice, setAdvice] = useState({}) // student_id -> { content, provider }
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all') // all | high | medium | low

  const ask = async (studentId) => {
    setBusyId(studentId)
    try {
      const note = await api.post('/ai/risk/advice', { class_id: Number(classId), student_id: studentId })
      setAdvice((prev) => ({ ...prev, [studentId]: note }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (risk.loading) return <Loading />
  if (risk.error) return <ErrorBox message={risk.error} />
  const all = risk.data || []
  const count = (level) => all.filter((r) => r.enough_data && r.level === level).length
  const noData = all.filter((r) => !r.enough_data).length
  const rows = all.filter((r) => filter === 'all' || (r.enough_data && r.level === filter))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {TILES.map(([level, label, Icon, iconTone]) => {
          const on = filter === level
          return (
            <button
              key={level}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(on ? 'all' : level)}
              className={`card flex items-center gap-3.5 !p-4 text-left transition hover:border-brand-300 ${
                on ? '!border-brand-400 ring-2 ring-brand-200' : ''
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-500">{label}</span>
                <span className="block text-2xl font-bold tabular-nums text-slate-900">{count(level)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Mức rủi ro được tính bằng luật minh bạch từ điểm danh và điểm số. AI chỉ gợi ý hành động và không nhận tên
            học viên; giáo viên là người quyết định.
            {noData > 0 && ` ${noData} học viên chưa đủ dữ liệu để đánh giá.`}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {filter !== 'all' && (
            <button className="btn-ghost btn-sm" onClick={() => setFilter('all')}>
              <X className="h-4 w-4" />
              Bỏ lọc
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={risk.reload} disabled={risk.refreshing}>
            {risk.refreshing ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            Tính lại
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Học viên</th>
              <th className="th">Mức rủi ro</th>
              <th className="th">Dấu hiệu</th>
              <th className="th">Chuyên cần</th>
              <th className="th">Điểm TB</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <Fragment key={r.student_id}>
                <tr>
                  <td className="td">
                    <NameCell name={r.full_name} />
                  </td>
                  <td className="td">
                    {r.enough_data ? (
                      <div className="space-y-1.5">
                        <Badge tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Badge>
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            className="w-20"
                            value={r.points / 100}
                            tone={LEVEL[r.level].bar}
                            label={`Điểm rủi ro ${r.points} trên 100`}
                          />
                          <span className="text-xs tabular-nums text-slate-500">{r.points}/100</span>
                        </div>
                      </div>
                    ) : (
                      <Badge tone="gray">Chưa đủ dữ liệu</Badge>
                    )}
                  </td>
                  <td className="td text-sm text-slate-600">
                    {r.reasons.length ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {r.reasons.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td">
                    <Metric tone={attendanceTone(r.attendance_rate)}>{percent(r.attendance_rate)}</Metric>
                  </td>
                  <td className="td">
                    <Metric tone={averageTone(r.average_10)}>{r.average_10 === null ? '—' : fmtScore(r.average_10)}</Metric>
                  </td>
                  <td className="td text-right">
                    {r.reasons.length > 0 && (
                      <button className="btn-ghost btn-sm whitespace-nowrap" disabled={busyId === r.student_id} onClick={() => ask(r.student_id)}>
                        {busyId === r.student_id ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                        {busyId === r.student_id ? 'Đang soạn…' : advice[r.student_id] ? 'Gợi ý lại' : 'Gợi ý hành động'}
                      </button>
                    )}
                  </td>
                </tr>
                {advice[r.student_id] && (
                  <tr className="hover:!bg-transparent">
                    <td colSpan={6} className="bg-brand-50/50 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-900">
                            Gợi ý cho giáo viên
                            <ProviderBadge provider={advice[r.student_id].provider} />
                          </div>
                          <p className="whitespace-pre-line text-sm text-slate-700">{advice[r.student_id].content}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <EmptyRow cols={6}>
                {all.length === 0 ? 'Lớp chưa có học viên.' : 'Không có học viên nào ở mức này.'}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Tab: nhận xét học viên (AI soạn nháp -> giáo viên duyệt -> công bố) ----------
// API: POST/GET /ai/reviews, PATCH /ai/reviews/{id}, POST /ai/reviews/{id}/publish|unpublish, DELETE /ai/reviews/{id}
const MIN_REVIEW = 10
const MAX_REVIEW = 3000

export function ReviewsTab({ classId, students }) {
  const toast = useToast()
  const confirm = useConfirm()
  const reviews = useAsync(() => api.getAll(`/ai/reviews?class_id=${classId}`), [classId])
  const [studentId, setStudentId] = useState('')
  const [editing, setEditing] = useState(null) // { id, text }
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all') // all | draft | published
  const name = (id) => students.find((s) => s.id === id)?.full_name || `#${id}`

  const run = async (fn, done = '') => {
    setBusy(true)
    try {
      await fn()
      if (done) toast.success(done)
      await reviews.reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const draft = (e) => {
    e.preventDefault()
    if (!studentId) return
    run(
      () => api.post('/ai/reviews', { class_id: Number(classId), student_id: Number(studentId) }),
      'AI đã soạn bản nháp. Hãy đọc, chỉnh sửa rồi bấm Công bố.',
    )
  }

  const remove = async (n) => {
    const ok = await confirm({
      title: 'Xóa nhận xét này?',
      message: `Nhận xét về ${name(n.student_id)} sẽ bị xóa vĩnh viễn${
        n.status === 'published' ? ' và học viên, phụ huynh sẽ không còn thấy nữa' : ''
      }.`,
      confirmLabel: 'Xóa nhận xét',
      tone: 'danger',
    })
    if (ok) run(() => api.del(`/ai/reviews/${n.id}`), 'Đã xóa nhận xét.')
  }

  const all = reviews.data || []
  const nDraft = all.filter((n) => n.status === 'draft').length
  const nPublished = all.length - nDraft
  const shown = all.filter((n) => filter === 'all' || n.status === filter)

  return (
    <div className="space-y-4">
      <form onSubmit={draft} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label="Chọn học viên để AI soạn nhận xét">
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">— Chọn học viên —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button className="btn-primary" disabled={!studentId || busy}>
          {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Đang xử lý…' : 'AI soạn nháp'}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Bản nháp chỉ giáo viên phụ trách lớp và quản trị viên xem được. Học viên và phụ huynh chỉ đọc được sau khi bấm <b>Công bố</b>.
      </p>
      <ErrorBox message={reviews.error} />

      {reviews.loading ? (
        <Loading />
      ) : (
        <>
          {all.length > 0 && (
            <Segmented
              label="Lọc nhận xét"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tất cả', count: all.length },
                { value: 'draft', label: 'Bản nháp', count: nDraft },
                { value: 'published', label: 'Đã công bố', count: nPublished },
              ]}
            />
          )}
          <div className="space-y-3">
            {shown.map((n) => {
              const isEditing = editing?.id === n.id
              const len = isEditing ? editing.text.trim().length : 0
              return (
                <div key={n.id} className="card space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <NameCell name={name(n.student_id)} />
                    <Badge tone={n.status === 'published' ? 'green' : 'amber'}>
                      {n.status === 'published' ? 'Đã công bố' : 'Bản nháp'}
                    </Badge>
                    <ProviderBadge provider={n.provider} />
                    <span className="ml-auto text-xs text-slate-500">{fmtDate(n.created_at)}</span>
                  </div>
                  {isEditing ? (
                    <div>
                      <textarea
                        className="input min-h-32"
                        value={editing.text}
                        maxLength={MAX_REVIEW}
                        onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                        aria-label="Nội dung nhận xét"
                        autoFocus
                      />
                      <div className="mt-1 text-right text-xs tabular-nums text-slate-500">
                        {editing.text.length}/{MAX_REVIEW} ký tự
                        {len < MIN_REVIEW && <span className="text-amber-700"> · tối thiểu {MIN_REVIEW} ký tự</span>}
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{n.content}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button
                          className="btn-primary btn-sm"
                          disabled={busy || len < MIN_REVIEW}
                          onClick={() =>
                            run(async () => {
                              await api.patch(`/ai/reviews/${n.id}`, { content: editing.text })
                              setEditing(null)
                            }, 'Đã lưu nội dung.')
                          }
                        >
                          <Save className="h-4 w-4" />
                          Lưu
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" />
                          Hủy
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-ghost btn-sm" onClick={() => setEditing({ id: n.id, text: n.content })}>
                          <Pencil className="h-4 w-4" />
                          Sửa
                        </button>
                        {n.status === 'draft' ? (
                          <button
                            className="btn-primary btn-sm"
                            disabled={busy}
                            onClick={() =>
                              run(() => api.post(`/ai/reviews/${n.id}/publish`), 'Đã công bố cho học viên và phụ huynh.')
                            }
                          >
                            <Send className="h-4 w-4" />
                            Công bố
                          </button>
                        ) : (
                          <button
                            className="btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => run(() => api.post(`/ai/reviews/${n.id}/unpublish`), 'Đã thu hồi về bản nháp.')}
                          >
                            <EyeOff className="h-4 w-4" />
                            Thu hồi
                          </button>
                        )}
                        <button
                          className="btn-ghost btn-sm text-rose-600 hover:!bg-rose-50"
                          disabled={busy}
                          onClick={() => remove(n)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {all.length === 0 && (
              <EmptyState icon={MessageSquareText} title="Chưa có nhận xét nào cho lớp này">
                Chọn một học viên ở trên để AI soạn bản nháp, rồi bạn chỉnh sửa và công bố.
              </EmptyState>
            )}
            {all.length > 0 && shown.length === 0 && (
              <EmptyState icon={MessageSquareText} title="Không có nhận xét nào trong mục này" />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Thẻ cho học viên / phụ huynh: nhận xét ĐÃ CÔNG BỐ ----------
// API: GET /ai/reviews?student_id= (học viên và phụ huynh chỉ nhận được bản đã công bố)
export function PublishedReviews({ studentId }) {
  const { data, error, loading } = useAsync(() => api.get(`/ai/reviews?student_id=${studentId}&limit=3`), [studentId])
  if (loading) return null
  if (error) return <ErrorBox message={error} />
  if (!data || data.length === 0) return null
  return (
    <div className="card mt-6 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <MessageSquareText className="h-[18px] w-[18px]" />
        </span>
        Nhận xét của giáo viên
      </div>
      {data.map((n) => (
        <div key={n.id} className="rounded-xl border-l-4 border-brand-300 bg-slate-50 px-4 py-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{n.content}</p>
          <div className="mt-2 text-xs text-slate-500">{fmtDate(n.published_at || n.created_at)}</div>
        </div>
      ))}
    </div>
  )
}
