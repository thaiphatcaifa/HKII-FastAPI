import { useState } from 'react'
import { api } from '../api'
import { ROLE_LABEL, useAuth } from '../auth'
import { Avatar, ErrorBox, Field, Notice, PageTitle } from '../components/ui'

const EMPTY = { old_password: '', new_password: '', confirm: '' }

export default function Account() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setMsg('')
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
      setMsg('Đã đổi mật khẩu.')
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
        <div className="card flex items-center gap-4">
          <Avatar name={user.full_name} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-slate-900">{user.full_name}</div>
            <div className="text-sm text-slate-500">@{user.username}</div>
            <div className="mt-1 text-sm text-slate-500">{ROLE_LABEL[user.role]}</div>
          </div>
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
          <Notice message={msg} />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </>
  )
}
