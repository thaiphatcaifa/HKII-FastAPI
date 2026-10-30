import { Fragment, useRef, useState } from 'react'
import { Download, Link2, Pencil, Upload } from 'lucide-react'
import { api, download } from '../api'
import { useAuth } from '../auth'
import { ROLE_LABEL } from '../auth'
import { Badge, ErrorBox, Field, Loading, Notice, PageTitle, useAsync } from '../components/ui'
import { Avatar } from '../components/ui'

const EMPTY = { username: '', full_name: '', password: '', role: 'student' }
const ROLE_TONE = { admin: 'indigo', teacher: 'blue', student: 'green', parent: 'amber' }

// ---------- Nhập nhiều tài khoản từ file CSV (API: POST /users/import) ----------
function ImportCard({ onDone }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const input = useRef(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await api.upload('/users/import', file)
      setResult(res)
      setFile(null)
      if (input.current) input.current.value = ''
      if (res.created > 0) onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const template = async () => {
    setError('')
    try {
      await download('/users/import/template', 'mau-nhap-nguoi-dung.csv')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit} className="card mb-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Nhập nhiều tài khoản từ file CSV</h2>
          <p className="text-sm text-slate-500">
            Cột: username, full_name, password, role (student, teacher hoặc parent). Tối đa 100 dòng mỗi lần.
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={template}>
          <Download className="h-4 w-4" />
          Tải file mẫu
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="input !w-auto"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button className="btn-primary" disabled={!file || busy}>
          <Upload className="h-4 w-4" />
          {busy ? 'Đang nhập…' : 'Nhập'}
        </button>
      </div>
      <ErrorBox message={error} />
      {result && (
        <div className="space-y-2">
          <Notice message={`Đã tạo ${result.created} tài khoản, bỏ qua ${result.skipped} dòng.`} />
          {result.errors.length > 0 && (
            <ul className="list-inside list-disc text-sm text-rose-700">
              {result.errors.map((er) => (
                <li key={er.line}>
                  Dòng {er.line}
                  {er.username ? ` (${er.username})` : ''}: {er.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}

// ---------- Sửa thông tin / đặt lại mật khẩu (API: PATCH /users/{id}) ----------
function EditPanel({ u, isSelf, act }) {
  const [form, setForm] = useState({ full_name: u.full_name, role: u.role, password: '' })
  const [note, setNote] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = (e) => {
    e.preventDefault()
    const body = {}
    if (form.full_name.trim() !== u.full_name) body.full_name = form.full_name.trim()
    if (form.role !== u.role) body.role = form.role
    if (form.password) body.password = form.password
    if (Object.keys(body).length === 0) {
      setNote('Chưa có thay đổi nào.')
      return
    }
    setNote('')
    act(() => api.patch(`/users/${u.id}`, body), 'Đã lưu thay đổi tài khoản.')
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="text-sm font-semibold text-slate-700">Sửa thông tin</div>
      <Field label="Họ tên">
        <input className="input" value={form.full_name} onChange={set('full_name')} required />
      </Field>
      <Field label="Vai trò">
        <select className="input" value={form.role} onChange={set('role')} disabled={isSelf}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Đặt lại mật khẩu (để trống nếu giữ nguyên)">
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={form.password}
          onChange={set('password')}
        />
      </Field>
      {note && <p className="text-sm text-slate-500">{note}</p>}
      <button className="btn-primary">Lưu thay đổi</button>
    </form>
  )
}

// ---------- Liên kết phụ huynh với học viên (API: GET/POST /users/{id}/children) ----------
function ChildrenPanel({ parent }) {
  const children = useAsync(() => api.get(`/users/${parent.id}/children`), [parent.id])
  const students = useAsync(() => api.getAll('/students'), [])
  const [pick, setPick] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const linked = new Set((children.data || []).map((c) => c.id))
  const candidates = (students.data || []).filter((s) => !linked.has(s.id))

  const link = async (e) => {
    e.preventDefault()
    if (!pick) return
    setError('')
    setMsg('')
    try {
      await api.post(`/users/${parent.id}/children`, { student_id: Number(pick) })
      setPick('')
      setMsg('Đã liên kết học viên.')
      children.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-700">Học viên đã liên kết</div>
      {children.loading ? (
        <div className="skeleton h-8 w-48" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {(children.data || []).map((c) => (
            <Badge key={c.id} tone="green">
              {c.full_name}
            </Badge>
          ))}
          {(children.data || []).length === 0 && <span className="text-sm text-slate-500">Chưa liên kết học viên nào.</span>}
        </div>
      )}
      <form onSubmit={link} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label="Liên kết thêm học viên">
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
        <button className="btn-primary" disabled={!pick}>
          <Link2 className="h-4 w-4" />
          Liên kết
        </button>
      </form>
      <ErrorBox message={error || children.error || students.error} />
      <Notice message={msg} />
    </div>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(null)
  const { data, error: loadError, loading, reload } = useAsync(() => {
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (q.trim()) params.set('q', q.trim())
    const qs = params.toString()
    return api.getAll(`/users${qs ? `?${qs}` : ''}`)
  }, [role, q])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const act = async (fn, okMessage) => {
    setError('')
    setMsg('')
    try {
      await fn()
      if (okMessage) setMsg(okMessage)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const create = (e) => {
    e.preventDefault()
    act(async () => {
      await api.post('/users', { ...form, username: form.username.trim(), full_name: form.full_name.trim() })
      setForm(EMPTY)
    }, 'Đã tạo tài khoản.')
  }

  return (
    <>
      <PageTitle title="Người dùng" subtitle="Tạo tài khoản, sửa thông tin, liên kết phụ huynh, khóa hoặc mở khóa người dùng." />
      <form onSubmit={create} className="card mb-5 grid gap-3 sm:grid-cols-5">
        <Field label="Tên đăng nhập">
          <input className="input" value={form.username} onChange={set('username')} minLength={3} required />
        </Field>
        <Field label="Họ tên">
          <input className="input" value={form.full_name} onChange={set('full_name')} required />
        </Field>
        <Field label="Mật khẩu (≥ 8 ký tự)">
          <input className="input" type="password" value={form.password} onChange={set('password')} minLength={8} required />
        </Field>
        <Field label="Vai trò">
          <select className="input" value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button className="btn-primary w-full">Tạo tài khoản</button>
        </div>
      </form>

      <ImportCard onDone={reload} />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input className="input !w-56" placeholder="Tìm theo tên…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ErrorBox message={error || loadError} />
        <Notice message={msg} />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Họ tên</th>
                <th className="th">Tên đăng nhập</th>
                <th className="th">Vai trò</th>
                <th className="th">Trạng thái</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td className="td"><div className="flex items-center gap-3"><Avatar name={u.full_name} size="sm" /><span className="font-medium text-slate-900">{u.full_name}</span></div></td>
                    <td className="td text-slate-500">{u.username}</td>
                    <td className="td"><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td className="td">
                      <Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Hoạt động' : 'Đã khóa'}</Badge>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-ghost"
                          aria-expanded={open === u.id}
                          onClick={() => setOpen(open === u.id ? null : u.id)}
                        >
                          <Pencil className="h-4 w-4" />
                          Quản lý
                        </button>
                        {u.id !== me.id && (
                          <button
                            className="btn-ghost"
                            onClick={() =>
                              act(
                                () => api.patch(`/users/${u.id}`, { is_active: !u.is_active }),
                                u.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
                              )
                            }
                          >
                            {u.is_active ? 'Khóa' : 'Mở khóa'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === u.id && (
                    <tr className="hover:!bg-transparent">
                      <td colSpan={5} className="bg-slate-50/70 px-4 py-4">
                        <div className="grid gap-6 md:grid-cols-2">
                          <EditPanel u={u} isSelf={u.id === me.id} act={act} />
                          {u.role === 'parent' && <ChildrenPanel parent={u} />}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
