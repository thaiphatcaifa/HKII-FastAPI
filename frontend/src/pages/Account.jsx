import { useState } from 'react'
import { api } from '../api'
import { ROLE_LABEL, useAuth } from '../auth'
import { useToast } from '../components/feedback'
import ThemePicker from '../components/ThemePicker'
import { Avatar, ErrorBox, Field, PageTitle, ProgressBar, Spinner } from '../components/ui'

const EMPTY = { old_password: '', new_password: '', confirm: '' }

// Độ mạnh mật khẩu mới chỉ để gợi ý; quy tắc thật (tối thiểu 8 ký tự) do máy chủ kiểm tra
const STRENGTH = [
  ['Rất yếu', 'red'],
  ['Yếu', 'red'],
  ['Trung bình', 'amber'],
  ['Khá', 'amber'],
  ['Mạnh', 'green'],
  ['Rất mạnh', 'green'],
]

function strengthOf(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

export default function Account() {
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const score = strengthOf(form.new_password)
  const [strengthLabel, strengthTone] = STRENGTH[score]

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.new_password !== form.confirm) {
      setError('Mật khẩu mới nhập lại chưa khớp.')
      return
    }
    if (form.new_password === form.old_password) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.')
      return
    }
    setBusy(true)
    try {
      await api.post('/auth/change-password', {
        old_password: form.old_password,
        new_password: form.new_password,
      })
      setForm(EMPTY)
      toast.success('Đã đổi mật khẩu.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageTitle title="Tài khoản" subtitle="Thông tin đăng nhập và đổi mật khẩu." />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5 self-start">
          <div className="card flex items-center gap-4">
            <Avatar name={user.full_name} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-slate-900">{user.full_name}</div>
              <div className="text-sm text-slate-500">@{user.username}</div>
              <div className="mt-1 text-sm text-slate-500">{ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          <ThemePicker />
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Đổi mật khẩu</h2>
          <Field label="Mật khẩu hiện tại">
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={form.old_password}
              onChange={set('old_password')}
              required
            />
          </Field>
          <div>
            <Field label="Mật khẩu mới (≥ 8 ký tự)">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={form.new_password}
                onChange={set('new_password')}
                required
              />
            </Field>
            {form.new_password && (
              <div className="mt-2 flex items-center gap-3" aria-live="polite">
                <ProgressBar className="flex-1" value={score / 5} tone={strengthTone} label="Độ mạnh mật khẩu mới" />
                <span className="w-20 text-right text-xs font-medium text-slate-500">{strengthLabel}</span>
              </div>
            )}
          </div>
          <Field label="Nhập lại mật khẩu mới">
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={form.confirm}
              onChange={set('confirm')}
              required
            />
          </Field>
          <ErrorBox message={error} />
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />}
            {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </>
  )
}
