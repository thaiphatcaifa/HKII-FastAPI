import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Plus, School, UserRound, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useToast } from '../components/feedback'
import {
  ClassMark,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  SearchBox,
  Spinner,
  fold,
  useAsync,
} from '../components/ui'

const EMPTY = { code: '', name: '', schedule: '', teacher_id: '' }

function CreateClass({ teachers, onCreated, onCancel }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/classes', {
        code: form.code.trim(),
        name: form.name.trim(),
        schedule: form.schedule.trim() || null,
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
      })
      toast.success(`Đã tạo lớp ${form.name.trim()}.`)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 animate-pop-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Tạo lớp mới</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Đóng biểu mẫu"
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Mã lớp">
          <input className="input" value={form.code} onChange={set('code')} placeholder="IELTS-C1" required autoFocus />
        </Field>
        <Field label="Tên lớp">
          <input className="input" value={form.name} onChange={set('name')} required />
        </Field>
        <Field label="Lịch học">
          <input className="input" value={form.schedule} onChange={set('schedule')} placeholder="T2-T4 18:00" />
        </Field>
        <Field label="Giáo viên">
          <select className="input" value={form.teacher_id} onChange={set('teacher_id')}>
            <option value="">— Chưa gán —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Hủy
        </button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
          {busy ? 'Đang tạo…' : 'Tạo lớp'}
        </button>
      </div>
    </form>
  )
}

export default function Classes() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const { data, error, loading, reload } = useAsync(async () => {
    const [classes, teachers] = await Promise.all([
      api.getAll('/classes'),
      isAdmin ? api.getAll('/users?role=teacher') : Promise.resolve([]),
    ])
    return { classes, teachers }
  }, [isAdmin])

  const teacherName = useMemo(() => new Map((data?.teachers || []).map((t) => [t.id, t.full_name])), [data])
  const visible = useMemo(() => {
    const needle = fold(q.trim())
    return (data?.classes || []).filter(
      (c) => !needle || fold(`${c.code} ${c.name} ${teacherName.get(c.teacher_id) || ''}`).includes(needle),
    )
  }, [data, q, teacherName])

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />

  return (
    <>
      <PageTitle
        title="Lớp học"
        subtitle={`${data.classes.length} lớp · giáo viên phụ trách và lịch học.`}
      >
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
            <Plus className="h-4 w-4" />
            Tạo lớp
          </button>
        )}
      </PageTitle>

      {isAdmin && showForm && (
        <CreateClass
          teachers={data.teachers}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            reload()
          }}
        />
      )}

      {data.classes.length > 3 && (
        <SearchBox className="mb-4 w-full sm:w-72" value={q} onChange={setQ} placeholder="Tìm theo mã, tên lớp…" />
      )}

      {visible.length === 0 ? (
        <EmptyState icon={School} title={data.classes.length === 0 ? 'Chưa có lớp nào' : 'Không tìm thấy lớp phù hợp'}>
          {data.classes.length === 0
            ? isAdmin
              ? 'Bấm "Tạo lớp" để thêm lớp đầu tiên.'
              : 'Bạn chưa được phân công lớp nào.'
            : 'Thử đổi từ khóa tìm kiếm.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <Link
              key={c.id}
              to={`/classes/${c.id}`}
              className="card group flex flex-col gap-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <ClassMark code={c.code} index={data.classes.indexOf(c)} large />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900 group-hover:text-indigo-700">{c.name}</div>
                  <span className="mt-1 inline-block rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                    {c.code}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  {c.schedule || 'Chưa có lịch'}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                    {teacherName.get(c.teacher_id) || 'Chưa phân công'}
                  </div>
                )}
              </div>
              <div className="mt-auto flex items-center justify-end gap-1 text-sm font-semibold text-indigo-600">
                Mở lớp
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
