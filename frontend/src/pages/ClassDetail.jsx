import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarCheck,
  ChartNoAxesColumn,
  Clock,
  Download,
  GraduationCap,
  MessageSquareText,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { api, download } from '../api'
import { useAuth } from '../auth'
import { ReviewsTab, RiskTab } from '../components/AiTabs'
import { useConfirm, useToast } from '../components/feedback'
import Hero from '../components/Hero'
import Tabs from '../components/Tabs'
import {
  ATTENDANCE,
  Avatar,
  Badge,
  ClassMark,
  EmptyRow,
  ErrorBox,
  Field,
  Loading,
  Metric,
  ProgressBar,
  ScoreChip,
  SearchBox,
  Spinner,
  StatCard,
  attendanceTone,
  averageTone,
  fmtDate,
  fmtScore,
  fold,
  percent,
  scoreKindLabel,
  useAsync,
} from '../components/ui'

const today = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const CHIP_ON = {
  green: 'border-emerald-500 bg-emerald-500 text-white',
  amber: 'border-amber-500 bg-amber-500 text-white',
  red: 'border-rose-500 bg-rose-500 text-white',
  blue: 'border-sky-500 bg-sky-500 text-white',
}

const NameCell = ({ name }) => (
  <div className="flex items-center gap-3">
    <Avatar name={name} size="sm" />
    <span className="whitespace-nowrap font-medium text-slate-900">{name}</span>
  </div>
)

// ---------- Tab: học viên ----------
function StudentsTab({ classId, code, students, reload }) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isAdmin = user.role === 'admin'
  const all = useAsync(() => (isAdmin ? api.getAll('/students') : Promise.resolve([])), [isAdmin])
  const [pick, setPick] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const enrolled = new Set(students.map((s) => s.id))
  const candidates = (all.data || []).filter((s) => !enrolled.has(s.id))
  const needle = fold(q.trim())
  const shown = students.filter((s) => !needle || fold(`${s.full_name} ${s.username}`).includes(needle))

  const add = async (e) => {
    e.preventDefault()
    if (!pick) return
    const added = candidates.find((s) => s.id === Number(pick))
    setBusy(true)
    try {
      await api.post(`/classes/${classId}/students`, { student_id: Number(pick) })
      setPick('')
      toast.success(`Đã thêm ${added?.full_name || 'học viên'} vào lớp.`)
      await reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (s) => {
    const ok = await confirm({
      title: 'Xóa học viên khỏi lớp?',
      message: `${s.full_name} sẽ không còn trong danh sách lớp ${code}. Bạn có thể thêm lại sau.`,
      confirmLabel: 'Xóa khỏi lớp',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingId(s.id)
    try {
      await api.del(`/classes/${classId}/students/${s.id}`)
      toast.success(`Đã xóa ${s.full_name} khỏi lớp.`)
      await reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Thêm học viên vào lớp">
              <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">— Chọn học viên —</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.username})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button className="btn-primary" disabled={!pick || busy}>
            {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
            Thêm
          </button>
        </form>
      )}
      <ErrorBox message={all.error} />
      {students.length > 6 && (
        <SearchBox className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Tìm học viên trong lớp…" />
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Học viên</th>
              <th className="th">Tên đăng nhập</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((s) => (
              <tr key={s.id}>
                <td className="td">
                  <NameCell name={s.full_name} />
                </td>
                <td className="td text-slate-500">{s.username}</td>
                <td className="td text-right">
                  {isAdmin && (
                    <button
                      className="btn-ghost btn-sm text-rose-600 hover:!bg-rose-50"
                      disabled={removingId === s.id}
                      onClick={() => remove(s)}
                    >
                      {removingId === s.id ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                      Xóa khỏi lớp
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <EmptyRow cols={3}>{students.length === 0 ? 'Lớp chưa có học viên.' : 'Không tìm thấy học viên phù hợp.'}</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Nút chọn trạng thái điểm danh (có mặt, trễ, vắng, vắng có phép)
function StatusChips({ name, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Trạng thái của ${name}`}>
      {Object.entries(ATTENDANCE).map(([key, { label, tone }]) => {
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              on ? CHIP_ON[tone] : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Tab: điểm danh ----------
function AttendanceTab({ classId, students }) {
  const toast = useToast()
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState({})
  const [baseline, setBaseline] = useState('') // trạng thái lúc tải hoặc lúc lưu gần nhất, để biết có thay đổi chưa lưu
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingDay, setLoadingDay] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingDay(true)
    setError('')
    api
      .get(`/attendance?class_id=${classId}&date_from=${date}&date_to=${date}`)
      .then((existing) => {
        if (cancelled) return
        const next = {}
        students.forEach((s) => {
          const found = existing.find((a) => a.student_id === s.id)
          next[s.id] = { status: found?.status || 'present', note: found?.note || '' }
        })
        setRows(next)
        setBaseline(JSON.stringify(next))
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingDay(false))
    return () => {
      cancelled = true
    }
  }, [classId, date, students])

  const update = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  const dirty = JSON.stringify(rows) !== baseline
  const counts = Object.values(rows).reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {})

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await api.post('/attendance/batch', {
        class_id: Number(classId),
        date,
        records: students.map((s) => ({
          student_id: s.id,
          status: rows[s.id]?.status || 'present',
          note: rows[s.id]?.note || null,
        })),
      })
      setBaseline(JSON.stringify(rows))
      toast.success(`Đã lưu điểm danh ngày ${fmtDate(date)}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (students.length === 0) {
    return <p className="card text-sm text-slate-500">Lớp chưa có học viên để điểm danh.</p>
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Ngày học">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button
          className="btn-ghost"
          type="button"
          onClick={() =>
            setRows((r) => Object.fromEntries(students.map((st) => [st.id, { status: 'present', note: r[st.id]?.note || '' }])))
          }
        >
          Tất cả có mặt
        </button>
        <button className="btn-primary" onClick={save} disabled={busy || loadingDay || !dirty}>
          {busy && <Spinner />}
          {busy ? 'Đang lưu…' : 'Lưu điểm danh'}
        </button>
        {dirty && !loadingDay && <Badge tone="amber">Có thay đổi chưa lưu</Badge>}
      </div>
      <ErrorBox message={error} />
      <div className="flex flex-wrap gap-2" aria-live="polite">
        {Object.entries(ATTENDANCE).map(([key, { label, tone }]) => (
          <Badge key={key} tone={tone}>
            {label} {counts[key] || 0}
          </Badge>
        ))}
      </div>

      <ul className="space-y-3 md:hidden">
        {students.map((s) => (
          <li key={s.id} className="card space-y-3 !p-4">
            <NameCell name={s.full_name} />
            <StatusChips
              name={s.full_name}
              value={rows[s.id]?.status || 'present'}
              onChange={(status) => update(s.id, { status })}
            />
            <input
              className="input"
              placeholder="Ghi chú"
              aria-label={`Ghi chú của ${s.full_name}`}
              value={rows[s.id]?.note || ''}
              maxLength={300}
              onChange={(e) => update(s.id, { note: e.target.value })}
            />
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto !p-0 md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Học viên</th>
              <th className="th">Trạng thái</th>
              <th className="th">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="td">
                  <NameCell name={s.full_name} />
                </td>
                <td className="td">
                  <StatusChips
                    name={s.full_name}
                    value={rows[s.id]?.status || 'present'}
                    onChange={(status) => update(s.id, { status })}
                  />
                </td>
                <td className="td">
                  <input
                    className="input"
                    aria-label={`Ghi chú của ${s.full_name}`}
                    value={rows[s.id]?.note || ''}
                    maxLength={300}
                    onChange={(e) => update(s.id, { note: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Tab: điểm số ----------
function ScoresTab({ classId, students }) {
  const toast = useToast()
  const confirm = useConfirm()
  const scores = useAsync(() => api.getAll(`/scores?class_id=${classId}`), [classId])
  const [form, setForm] = useState({ student_id: '', kind: 'quiz', value: '', max_value: '10' })
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // { id, value, note } khi đang sửa một điểm
  const name = (id) => students.find((s) => s.id === id)?.full_name || `#${id}`
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const add = async (e) => {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      await api.post('/scores', {
        class_id: Number(classId),
        student_id: Number(form.student_id),
        kind: form.kind.trim(),
        value: Number(form.value),
        max_value: Number(form.max_value),
      })
      toast.success(`Đã thêm điểm cho ${name(Number(form.student_id))}.`)
      setForm({ ...form, value: '' })
      await scores.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }
  const saveEdit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.patch(`/scores/${editing.id}`, { value: Number(editing.value), note: editing.note.trim() })
      setEditing(null)
      toast.success('Đã cập nhật điểm.')
      await scores.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async (s) => {
    const ok = await confirm({
      title: 'Xóa điểm này?',
      message: `Điểm ${fmtScore(s.value)}/${fmtScore(s.max_value)} (${scoreKindLabel(s.kind)}) của ${name(s.student_id)} sẽ bị xóa.`,
      confirmLabel: 'Xóa điểm',
      tone: 'danger',
    })
    if (!ok) return
    setError('')
    try {
      await api.del(`/scores/${s.id}`)
      toast.success('Đã xóa điểm.')
      await scores.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card grid gap-3 sm:grid-cols-5">
        <Field label="Học viên">
          <select className="input" value={form.student_id} onChange={set('student_id')} required>
            <option value="">— Chọn —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Loại điểm">
          <input className="input" list="score-kinds" value={form.kind} onChange={set('kind')} required />
          <datalist id="score-kinds">
            <option value="quiz" />
            <option value="midterm" />
            <option value="final" />
            <option value="homework" />
          </datalist>
        </Field>
        <Field label="Điểm">
          <input className="input" type="number" step="0.1" min="0" value={form.value} onChange={set('value')} required />
        </Field>
        <Field label="Tối đa">
          <input className="input" type="number" step="0.1" min="1" value={form.max_value} onChange={set('max_value')} required />
        </Field>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={adding}>
            {adding ? <Spinner /> : <Plus className="h-4 w-4" />}
            Thêm điểm
          </button>
        </div>
      </form>
      <ErrorBox message={error || scores.error} />
      {scores.loading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Học viên</th>
                <th className="th">Loại</th>
                <th className="th">Điểm</th>
                <th className="th">Ghi chú</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(scores.data || []).map((s) =>
                editing?.id === s.id ? (
                  <tr key={s.id}>
                    <td className="td">
                      <NameCell name={name(s.student_id)} />
                    </td>
                    <td className="td">{scoreKindLabel(s.kind)}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <input
                          className="input !w-24"
                          type="number"
                          step="0.1"
                          min="0"
                          max={s.max_value}
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          aria-label="Điểm"
                          required
                          autoFocus
                        />
                        <span className="text-slate-500">/ {fmtScore(s.max_value)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <input
                        className="input"
                        maxLength={300}
                        value={editing.note}
                        onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                        aria-label="Ghi chú"
                      />
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <button className="btn-primary btn-sm" onClick={saveEdit}>
                          Lưu
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" />
                          Hủy
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <td className="td">
                      <NameCell name={name(s.student_id)} />
                    </td>
                    <td className="td">{scoreKindLabel(s.kind)}</td>
                    <td className="td">
                      <ScoreChip value={s.value} max={s.max_value} />
                    </td>
                    <td className="td text-slate-500">{s.note || '—'}</td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setEditing({ id: s.id, value: String(s.value), note: s.note || '' })}
                        >
                          <Pencil className="h-4 w-4" />
                          Sửa
                        </button>
                        <button className="btn-ghost btn-sm text-rose-600 hover:!bg-rose-50" onClick={() => remove(s)}>
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {(scores.data || []).length === 0 && <EmptyRow cols={5}>Chưa có điểm nào.</EmptyRow>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Tab: báo cáo ----------
function ReportTab({ classId, code }) {
  const toast = useToast()
  const report = useAsync(() => api.get(`/reports/class/${classId}/summary`), [classId])
  const [exporting, setExporting] = useState(false)

  const exportXlsx = async () => {
    setExporting(true)
    try {
      await download(`/reports/class/${classId}/export.xlsx`, `bao-cao-lop-${code}.xlsx`)
      toast.success('Đã tải báo cáo lớp.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setExporting(false)
    }
  }

  if (report.loading) return <Loading />
  if (report.error) return <ErrorBox message={report.error} />
  const r = report.data
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} tone="sky" label="Học viên" value={r.student_count} />
        <StatCard
          icon={CalendarCheck}
          tone="emerald"
          label="Chuyên cần trung bình"
          value={percent(r.average_attendance_rate)}
        />
        <StatCard
          icon={GraduationCap}
          tone="indigo"
          label="Điểm trung bình"
          value={r.average_score_10 === null ? '—' : fmtScore(r.average_score_10)}
          hint="Thang điểm 10"
        />
      </div>
      <div className="flex justify-end">
        <button className="btn-ghost" onClick={exportXlsx} disabled={exporting}>
          {exporting ? <Spinner /> : <Download className="h-4 w-4" />}
          Xuất Excel
        </button>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="th">Học viên</th>
              <th className="th">Số buổi</th>
              <th className="th">Có mặt</th>
              <th className="th">Trễ</th>
              <th className="th">Vắng</th>
              <th className="th">Có phép</th>
              <th className="th">Chuyên cần</th>
              <th className="th">Điểm TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.students.map((s) => (
              <tr key={s.student_id}>
                <td className="td">
                  <NameCell name={s.full_name} />
                </td>
                <td className="td tabular-nums">{s.sessions}</td>
                <td className="td tabular-nums">{s.present}</td>
                <td className="td tabular-nums">{s.late}</td>
                <td className="td tabular-nums">{s.absent}</td>
                <td className="td tabular-nums">{s.excused}</td>
                <td className="td">
                  <div className="w-24 space-y-1">
                    <Metric tone={attendanceTone(s.attendance_rate)}>{percent(s.attendance_rate)}</Metric>
                    <ProgressBar
                      value={s.attendance_rate}
                      tone={{ green: 'green', amber: 'amber', red: 'red', gray: 'indigo' }[attendanceTone(s.attendance_rate)]}
                      label={`Chuyên cần của ${s.full_name}`}
                    />
                  </div>
                </td>
                <td className="td">
                  <Metric tone={averageTone(s.average_10)}>{s.average_10 === null ? '—' : fmtScore(s.average_10)}</Metric>
                </td>
              </tr>
            ))}
            {r.students.length === 0 && <EmptyRow cols={8}>Lớp chưa có học viên.</EmptyRow>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Sửa thông tin lớp (admin) - API: PATCH /classes/{id} ----------
function EditClass({ classroom, onSaved, onCancel }) {
  const toast = useToast()
  const teachers = useAsync(() => api.getAll('/users?role=teacher'), [])
  const [form, setForm] = useState({
    name: classroom.name,
    schedule: classroom.schedule || '',
    teacher_id: classroom.teacher_id ?? '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.patch(`/classes/${classroom.id}`, {
        name: form.name.trim(),
        schedule: form.schedule.trim() || null,
        teacher_id: form.teacher_id === '' ? null : Number(form.teacher_id),
      })
      toast.success('Đã lưu thông tin lớp.')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="card mb-6 grid animate-pop-in gap-3 sm:grid-cols-4">
      <Field label="Tên lớp">
        <input className="input" value={form.name} onChange={set('name')} maxLength={120} required autoFocus />
      </Field>
      <Field label="Lịch học">
        <input className="input" value={form.schedule} onChange={set('schedule')} maxLength={200} />
      </Field>
      <Field label="Giáo viên phụ trách">
        <select className="input" value={form.teacher_id} onChange={set('teacher_id')}>
          <option value="">— Chưa phân công —</option>
          {(teachers.data || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end gap-2">
        <button className="btn-primary flex-1" disabled={busy}>
          {busy && <Spinner />}
          Lưu
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Hủy
        </button>
      </div>
      <div className="sm:col-span-4">
        <ErrorBox message={error || teachers.error} />
      </div>
    </form>
  )
}

const TAB_DEFS = [
  { key: 'students', label: 'Học viên', icon: Users },
  { key: 'attendance', label: 'Điểm danh', icon: CalendarCheck },
  { key: 'scores', label: 'Điểm số', icon: GraduationCap },
  { key: 'report', label: 'Báo cáo', icon: ChartNoAxesColumn },
  { key: 'risk', label: 'Cảnh báo', icon: ShieldAlert },
  { key: 'reviews', label: 'Nhận xét AI', icon: MessageSquareText },
]

export default function ClassDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [editingClass, setEditingClass] = useState(false)
  const { data, error, loading, reload } = useAsync(async () => {
    const [classroom, students] = await Promise.all([api.get(`/classes/${id}`), api.get(`/classes/${id}/students`)])
    return { classroom, students }
  }, [id])

  // Tab nằm trên đường dẫn (?tab=risk) để mở thẳng từ trang Tổng quan và giữ nguyên khi tải lại trang
  const tab = TAB_DEFS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'students'
  const setTab = (key) => setParams(key === 'students' ? {} : { tab: key }, { replace: true })

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  const { classroom, students } = data

  return (
    <>
      <Hero
        compact
        docTitle={classroom.name}
        eyebrow={classroom.code}
        title={classroom.name}
        back={{ to: '/classes', label: 'Lớp học' }}
        lead={<ClassMark code={classroom.code} large />}
        chips={[
          [Users, `${students.length} học viên`],
          [Clock, classroom.schedule || 'Chưa có lịch học'],
        ]}
        action={
          user.role === 'admin' && !editingClass ? (
            <button className="btn-ghost" onClick={() => setEditingClass(true)}>
              <Pencil className="h-4 w-4" />
              Sửa thông tin lớp
            </button>
          ) : null
        }
      />
      {editingClass && (
        <EditClass
          classroom={classroom}
          onSaved={() => {
            setEditingClass(false)
            reload()
          }}
          onCancel={() => setEditingClass(false)}
        />
      )}
      <Tabs
        label="Nội dung lớp học"
        idPrefix="class-tab"
        value={tab}
        onChange={setTab}
        tabs={TAB_DEFS.map((t) => (t.key === 'students' ? { ...t, count: students.length } : t))}
      />
      <div role="tabpanel" id="class-tab-panel" aria-labelledby={`class-tab-${tab}`}>
        {tab === 'students' && <StudentsTab classId={id} code={classroom.code} students={students} reload={reload} />}
        {tab === 'attendance' && <AttendanceTab classId={id} students={students} />}
        {tab === 'scores' && <ScoresTab classId={id} students={students} />}
        {tab === 'report' && <ReportTab classId={id} code={classroom.code} />}
        {tab === 'risk' && <RiskTab classId={id} />}
        {tab === 'reviews' && <ReviewsTab classId={id} students={students} />}
      </div>
    </>
  )
}
