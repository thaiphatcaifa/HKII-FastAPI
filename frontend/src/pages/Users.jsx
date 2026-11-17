import { Fragment, useMemo, useRef, useState } from 'react'
import { Download, Eye, EyeOff, FileUp, Link2, Lock, LockOpen, Pencil, Upload, UserPlus, X } from 'lucide-react'
import { api, download } from '../api'
import { ROLE_LABEL, useAuth } from '../auth'
import { useConfirm, useToast } from '../components/feedback'
import {
  Avatar,
  Badge,
  EmptyRow,
  ErrorBox,
  Field,
  Loading,
  Notice,
  PageTitle,
  SearchBox,
  Segmented,
  Spinner,
  fold,
  useAsync,
} from '../components/ui'

const EMPTY = { username: '', full_name: '', password: '', role: 'student' }
const ROLE_TONE = { admin: 'brand', teacher: 'blue', student: 'green', parent: 'amber' }

const CloseButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Đóng biểu mẫu"
    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
  >
    <X className="h-4 w-4" />
  </button>
)

// ---------- Tạo một tài khoản (API: POST /users) ----------
function CreateUser({ onCreated, onCancel }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/users', { ...form, username: form.username.trim(), full_name: form.full_name.trim() })
      toast.success(`Đã tạo tài khoản ${form.username.trim()}.`)
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
        <h2 className="font-semibold text-slate-900">Thêm người dùng</h2>
        <CloseButton onClick={onCancel} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tên đăng nhập">
          <input className="input" value={form.username} onChange={set('username')} minLength={3} required autoFocus />
        </Field>
        <Field label="Họ tên">
          <input className="input" value={form.full_name} onChange={set('full_name')} required />
        </Field>
        <Field label="Mật khẩu (≥ 8 ký tự)">
          <div className="relative">
            <input
              className="input !pr-11"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              minLength={8}
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
        <Field label="Vai trò">
          <select className="input" value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
          {busy ? <Spinner /> : <UserPlus className="h-4 w-4" />}
          {busy ? 'Đang tạo…' : 'Tạo tài khoản'}
        </button>
      </div>
    </form>
  )
}

// ---------- Nhập nhiều tài khoản từ file CSV (API: POST /users/import) ----------
function ImportCard({ onDone, onCancel }) {
  const toast = useToast()
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
      if (res.created > 0) {
        toast.success(`Đã tạo ${res.created} tài khoản từ file CSV.`)
        onDone()
      }
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
    <form onSubmit={submit} className="card mb-6 animate-pop-in space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Nhập nhiều tài khoản từ file CSV</h2>
          <p className="text-sm text-slate-500">
            Cột: username, full_name, password, role (student, teacher hoặc parent). Tối đa 100 dòng mỗi lần.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={template}>
            <Download className="h-4 w-4" />
            Tải file mẫu
          </button>
          <CloseButton onClick={onCancel} />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 transition hover:border-brand-400 hover:bg-brand-50/40 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
        <FileUp className="h-6 w-6 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 text-sm">
          {file ? (
            <>
              <span className="font-medium text-slate-900">{file.name}</span>
              <span className="ml-2 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
            </>
          ) : (
            <span className="text-slate-600">
              Bấm để chọn file <b>.csv</b>
            </span>
          )}
        </span>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>

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
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!file || busy}>
          {busy ? <Spinner /> : <Upload className="h-4 w-4" />}
          {busy ? 'Đang nhập…' : 'Nhập'}
        </button>
      </div>
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
      <Field label="Vai trò" hint={isSelf ? 'Bạn không thể đổi vai trò của chính mình.' : undefined}>
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
  const toast = useToast()
  const children = useAsync(() => api.get(`/users/${parent.id}/children`), [parent.id])
  const students = useAsync(() => api.getAll('/students'), [])
  const [pick, setPick] = useState('')
  const [error, setError] = useState('')
  const linked = new Set((children.data || []).map((c) => c.id))
  const candidates = (students.data || []).filter((s) => !linked.has(s.id))

  const link = async (e) => {
    e.preventDefault()
    if (!pick) return
    setError('')
    try {
      await api.post(`/users/${parent.id}/children`, { student_id: Number(pick) })
      setPick('')
      toast.success('Đã liên kết học viên.')
      await children.reload()
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
    </div>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [panel, setPanel] = useState('') // '' | 'create' | 'import'
  const [open, setOpen] = useState(null)
  const [busyId, setBusyId] = useState(null)
  // Tải cả danh sách một lần rồi lọc trên trình duyệt: đổi vai trò hay gõ tên không phải tải lại
  const { data, error, loading, reload } = useAsync(() => api.getAll('/users'), [])

  const users = data || []
  const counts = useMemo(() => {
    const c = { '': users.length }
    users.forEach((u) => {
      c[u.role] = (c[u.role] || 0) + 1
    })
    return c
  }, [users])
  const visible = useMemo(() => {
    const needle = fold(q.trim())
    return users.filter(
      (u) => (!role || u.role === role) && (!needle || fold(`${u.full_name} ${u.username}`).includes(needle)),
    )
  }, [users, role, q])

  const act = async (fn, okMessage) => {
    try {
      await fn()
      if (okMessage) toast.success(okMessage)
      await reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const toggleActive = async (u) => {
    if (u.is_active) {
      const ok = await confirm({
        title: 'Khóa tài khoản này?',
        message: `${u.full_name} (${u.username}) sẽ không đăng nhập được cho tới khi bạn mở khóa.`,
        confirmLabel: 'Khóa tài khoản',
        tone: 'danger',
      })
      if (!ok) return
    }
    setBusyId(u.id)
    await act(
      () => api.patch(`/users/${u.id}`, { is_active: !u.is_active }),
      u.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
    )
    setBusyId(null)
  }

  const togglePanel = (name) => setPanel((p) => (p === name ? '' : name))

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />

  return (
    <>
      <PageTitle title="Người dùng" subtitle="Tạo tài khoản, sửa thông tin, liên kết phụ huynh, khóa hoặc mở khóa người dùng.">
        <button className="btn-ghost" onClick={() => togglePanel('import')} aria-expanded={panel === 'import'}>
          <Upload className="h-4 w-4" />
          Nhập từ CSV
        </button>
        <button className="btn-primary" onClick={() => togglePanel('create')} aria-expanded={panel === 'create'}>
          <UserPlus className="h-4 w-4" />
          Thêm người dùng
        </button>
      </PageTitle>

      {panel === 'create' && (
        <CreateUser
          onCancel={() => setPanel('')}
          onCreated={() => {
            setPanel('')
            reload()
          }}
        />
      )}
      {panel === 'import' && <ImportCard onCancel={() => setPanel('')} onDone={reload} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Lọc theo vai trò"
          value={role}
          onChange={setRole}
          options={[
            { value: '', label: 'Tất cả', count: counts[''] },
            ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label, count: counts[value] || 0 })),
          ]}
        />
        <SearchBox className="w-full sm:w-64" value={q} onChange={setQ} placeholder="Tìm người dùng…" />
      </div>

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
            {visible.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} size="sm" />
                      <span className="font-medium text-slate-900">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="td text-slate-500">{u.username}</td>
                  <td className="td">
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td className="td">
                    <Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Hoạt động' : 'Đã khóa'}</Badge>
                  </td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn-ghost btn-sm"
                        aria-expanded={open === u.id}
                        onClick={() => setOpen(open === u.id ? null : u.id)}
                      >
                        <Pencil className="h-4 w-4" />
                        Quản lý
                      </button>
                      {u.id !== me.id && (
                        <button className="btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => toggleActive(u)}>
                          {busyId === u.id ? <Spinner /> : u.is_active ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
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
            {visible.length === 0 && (
              <EmptyRow cols={5}>{users.length === 0 ? 'Chưa có người dùng nào.' : 'Không tìm thấy người dùng phù hợp.'}</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Hiển thị {visible.length} trên {users.length} người dùng
      </p>
    </>
  )
}
