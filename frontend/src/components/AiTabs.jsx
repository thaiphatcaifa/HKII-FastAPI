import { Fragment, useState } from 'react'
import { EyeOff, MessageSquareText, Pencil, Save, Send, ShieldAlert, Sparkles, X } from 'lucide-react'
import { api } from '../api'
import {
  Avatar,
  Badge,
  EmptyRow,
  ErrorBox,
  Field,
  Loading,
  Notice,
  fmtDate,
  percent,
  useAsync,
} from './ui'

const PROVIDER = {
  gemini: { label: 'Gemini', tone: 'blue' },
  rules: { label: 'Theo luật', tone: 'gray' },
}

const LEVEL = {
  high: { label: 'Rủi ro cao', tone: 'red' },
  medium: { label: 'Rủi ro trung bình', tone: 'amber' },
  low: { label: 'Ổn định', tone: 'green' },
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

// ---------- Tab: cảnh báo học viên có rủi ro ----------
// API: GET /ai/risk (luật), POST /ai/risk/advice (AI gợi ý hành động)
export function RiskTab({ classId }) {
  const risk = useAsync(() => api.get(`/ai/risk?class_id=${classId}`), [classId])
  const [advice, setAdvice] = useState({}) // student_id -> { content, provider }
  const [busyId, setBusyId] = useState(null)
  const [onlyRisk, setOnlyRisk] = useState(false)
  const [error, setError] = useState('')

  const ask = async (studentId) => {
    setBusyId(studentId)
    setError('')
    try {
      const note = await api.post('/ai/risk/advice', { class_id: Number(classId), student_id: studentId })
      setAdvice((prev) => ({ ...prev, [studentId]: note }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (risk.loading) return <Loading />
  if (risk.error) return <ErrorBox message={risk.error} />
  const rows = (risk.data || []).filter((r) => !onlyRisk || r.level !== 'low')
  const count = (level) => (risk.data || []).filter((r) => r.level === level).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="red">{count('high')} rủi ro cao</Badge>
        <Badge tone="amber">{count('medium')} trung bình</Badge>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />
          Chỉ hiện học viên cần chú ý
        </label>
        <button className="btn-ghost" onClick={risk.reload}>
          Tính lại
        </button>
      </div>
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Mức rủi ro được tính bằng luật minh bạch từ điểm danh và điểm số. AI chỉ gợi ý hành động và không nhận tên học
        viên; giáo viên là người quyết định.
      </p>
      <ErrorBox message={error} />
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
                  <td className="td"><NameCell name={r.full_name} /></td>
                  <td className="td">
                    {r.enough_data ? (
                      <Badge tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Badge>
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
                  <td className="td">{percent(r.attendance_rate)}</td>
                  <td className="td">{r.average_10 ?? '—'}</td>
                  <td className="td text-right">
                    {r.reasons.length > 0 && (
                      <button className="btn-ghost" disabled={busyId === r.student_id} onClick={() => ask(r.student_id)}>
                        <Sparkles className="h-4 w-4" />
                        {busyId === r.student_id ? 'Đang soạn…' : advice[r.student_id] ? 'Gợi ý lại' : 'Gợi ý hành động'}
                      </button>
                    )}
                  </td>
                </tr>
                {advice[r.student_id] && (
                  <tr>
                    <td colSpan={6} className="bg-indigo-50/40 px-4 py-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-indigo-700">
                        <Sparkles className="h-4 w-4" />
                        Gợi ý cho giáo viên
                        <ProviderBadge provider={advice[r.student_id].provider} />
                      </div>
                      <p className="whitespace-pre-line text-sm text-slate-700">{advice[r.student_id].content}</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <EmptyRow cols={6}>{onlyRisk ? 'Không có học viên nào cần chú ý.' : 'Lớp chưa có học viên.'}</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Tab: nhận xét học viên (AI soạn nháp -> giáo viên duyệt -> công bố) ----------
// API: POST/GET /ai/reviews, PATCH /ai/reviews/{id}, POST /ai/reviews/{id}/publish|unpublish, DELETE /ai/reviews/{id}
export function ReviewsTab({ classId, students }) {
  const reviews = useAsync(() => api.getAll(`/ai/reviews?class_id=${classId}`), [classId])
  const [studentId, setStudentId] = useState('')
  const [editing, setEditing] = useState(null) // { id, text }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const name = (id) => students.find((s) => s.id === id)?.full_name || `#${id}`

  const run = async (fn, done = '') => {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await fn()
      if (done) setMsg(done)
      await reviews.reload()
    } catch (err) {
      setError(err.message)
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
          <Sparkles className="h-4 w-4" />
          {busy ? 'Đang xử lý…' : 'AI soạn nháp'}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Bản nháp chỉ mình bạn thấy. Học viên và phụ huynh chỉ đọc được sau khi bạn bấm <b>Công bố</b>.
      </p>
      <ErrorBox message={error || reviews.error} />
      <Notice message={msg} />
      {reviews.loading ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          {(reviews.data || []).map((n) => (
            <div key={n.id} className="card space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <NameCell name={name(n.student_id)} />
                <Badge tone={n.status === 'published' ? 'green' : 'amber'}>
                  {n.status === 'published' ? 'Đã công bố' : 'Bản nháp'}
                </Badge>
                <ProviderBadge provider={n.provider} />
                <span className="ml-auto text-xs text-slate-400">{fmtDate(n.created_at)}</span>
              </div>
              {editing?.id === n.id ? (
                <textarea
                  className="input min-h-32"
                  value={editing.text}
                  maxLength={3000}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  aria-label="Nội dung nhận xét"
                />
              ) : (
                <p className="whitespace-pre-line text-sm text-slate-700">{n.content}</p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {editing?.id === n.id ? (
                  <>
                    <button
                      className="btn-primary btn-sm"
                      disabled={busy || editing.text.trim().length < 10}
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
                        onClick={() => run(() => api.post(`/ai/reviews/${n.id}/publish`), 'Đã công bố cho học viên và phụ huynh.')}
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
                    <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api.del(`/ai/reviews/${n.id}`), 'Đã xóa.')}>
                      Xóa
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {(reviews.data || []).length === 0 && (
            <div className="card py-10 text-center text-sm text-slate-500">Chưa có nhận xét nào cho lớp này.</div>
          )}
        </div>
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
        <MessageSquareText className="h-5 w-5 text-indigo-600" />
        Nhận xét của giáo viên
      </div>
      {data.map((n) => (
        <div key={n.id} className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="whitespace-pre-line text-sm text-slate-700">{n.content}</p>
          <div className="mt-2 text-xs text-slate-400">{fmtDate(n.published_at || n.created_at)}</div>
        </div>
      ))}
    </div>
  )
}
