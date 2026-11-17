import { useMemo, useState } from 'react'
import { CalendarClock, CircleCheck, Download, Plus, TriangleAlert, Wallet, X } from 'lucide-react'
import { api, download } from '../api'
import { useAuth } from '../auth'
import { useConfirm, useToast } from '../components/feedback'
import StudentPicker, { useStudentChoice } from '../components/StudentPicker'
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  ProgressBar,
  SearchBox,
  Segmented,
  Spinner,
  StatCard,
  TUITION,
  daysFromToday,
  fmtDate,
  fold,
  money,
  percent,
  useAsync,
} from '../components/ui'

const EMPTY_FORM = { student_id: '', amount: '', due_date: '', note: '' }

// Khoản quá hạn lên đầu, rồi chưa đóng (hạn gần nhất trước), cuối cùng là đã đóng (mới nhất trước)
const RANK = { overdue: 0, unpaid: 1, paid: 2 }
const byUrgency = (a, b) =>
  RANK[a.status] - RANK[b.status] ||
  (a.status === 'paid' ? b.due_date.localeCompare(a.due_date) : a.due_date.localeCompare(b.due_date))

// Gợi ý ngắn dưới hạn đóng: còn bao nhiêu ngày, trễ bao nhiêu ngày, hoặc ngày đã đóng
function DueHint({ row }) {
  if (row.status === 'paid') {
    return row.paid_at ? <span className="text-xs text-slate-500">Đóng ngày {fmtDate(row.paid_at)}</span> : null
  }
  const days = daysFromToday(row.due_date)
  if (days < 0) return <span className="text-xs font-medium text-rose-600">Trễ {-days} ngày</span>
  if (days === 0) return <span className="text-xs font-medium text-amber-700">Đến hạn hôm nay</span>
  return (
    <span className={`text-xs ${days <= 7 ? 'font-medium text-amber-700' : 'text-slate-500'}`}>Còn {days} ngày</span>
  )
}

const StatusBadge = ({ status }) => <Badge tone={TUITION[status].tone}>{TUITION[status].label}</Badge>

const NameCell = ({ name }) => (
  <div className="flex items-center gap-3">
    <Avatar name={name} size="sm" />
    <span className="whitespace-nowrap font-medium text-slate-900">{name}</span>
  </div>
)

// Bảng trên máy tính, danh sách thẻ trên điện thoại
function TuitionList({ rows, nameOf, onPay, payingId, emptyHint }) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={Wallet} title="Không có khoản học phí nào">
        {emptyHint}
      </EmptyState>
    )
  }
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((t) => (
          <li key={t.id} className="card !p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {nameOf && (
                  <div className="mb-2">
                    <NameCell name={nameOf(t.student_id)} />
                  </div>
                )}
                <div className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{money(t.amount)}</div>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-600">
              <span>
                Hạn đóng: <b className="text-slate-900">{fmtDate(t.due_date)}</b>
              </span>
              <DueHint row={t} />
            </div>
            {t.note && <p className="mt-1 text-sm text-slate-500">{t.note}</p>}
            {onPay && t.status !== 'paid' && (
              <button className="btn-ghost mt-3 w-full" disabled={payingId === t.id} onClick={() => onPay(t)}>
                {payingId === t.id ? <Spinner /> : <CircleCheck className="h-4 w-4" />}
                Ghi nhận đã đóng
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto !p-0 md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200">
            <tr>
              {nameOf && <th className="th">Học viên</th>}
              <th className="th text-right">Số tiền</th>
              <th className="th">Hạn đóng</th>
              <th className="th">Trạng thái</th>
              <th className="th">Ghi chú</th>
              {onPay && <th className="th" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((t) => (
              <tr key={t.id}>
                {nameOf && (
                  <td className="td">
                    <NameCell name={nameOf(t.student_id)} />
                  </td>
                )}
                <td className="td text-right font-semibold tabular-nums text-slate-900">{money(t.amount)}</td>
                <td className="td">
                  <div>{fmtDate(t.due_date)}</div>
                  <DueHint row={t} />
                </td>
                <td className="td">
                  <StatusBadge status={t.status} />
                </td>
                <td className="td text-slate-500">{t.note || '—'}</td>
                {onPay && (
                  <td className="td text-right">
                    {t.status !== 'paid' && (
                      <button className="btn-ghost btn-sm" disabled={payingId === t.id} onClick={() => onPay(t)}>
                        {payingId === t.id ? <Spinner /> : <CircleCheck className="h-4 w-4" />}
                        Ghi nhận đã đóng
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function CreateTuition({ students, onCreated, onCancel }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const amount = Number(form.amount)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/tuition', {
        student_id: Number(form.student_id),
        amount,
        due_date: form.due_date,
        note: form.note.trim() || null,
      })
      toast.success('Đã tạo khoản học phí.')
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
        <h2 className="font-semibold text-slate-900">Tạo khoản học phí</h2>
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
        <Field label="Học viên">
          <select className="input" value={form.student_id} onChange={set('student_id')} required autoFocus>
            <option value="">— Chọn —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Số tiền (₫)" hint={amount >= 1000 ? `= ${money(amount)}` : undefined}>
          <input
            className="input"
            type="number"
            min="1000"
            step="1000"
            value={form.amount}
            onChange={set('amount')}
            required
          />
        </Field>
        <Field label="Hạn đóng">
          <input className="input" type="date" value={form.due_date} onChange={set('due_date')} required />
        </Field>
        <Field label="Ghi chú">
          <input className="input" value={form.note} onChange={set('note')} placeholder="Ví dụ: Học phí tháng 11" />
        </Field>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Hủy
        </button>
        <button className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
          {busy ? 'Đang tạo…' : 'Tạo khoản'}
        </button>
      </div>
    </form>
  )
}

function AdminTuition() {
  const toast = useToast()
  const confirm = useConfirm()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState('') // 'overdue' | 'export' khi đang chạy
  const [payingId, setPayingId] = useState(null)
  const { data, error, loading, reload } = useAsync(async () => {
    const [rows, students, summary] = await Promise.all([
      api.getAll('/tuition'),
      api.getAll('/students'),
      api.get('/tuition/summary'),
    ])
    return { rows, students, summary }
  }, [])

  const nameMap = useMemo(() => new Map((data?.students || []).map((s) => [s.id, s.full_name])), [data])
  const nameOf = (id) => nameMap.get(id) || `#${id}`
  const rows = data?.rows
  // Lọc ngay trên trình duyệt: đổi trạng thái hay gõ tên không phải tải lại trang
  const visible = useMemo(() => {
    const needle = fold(q.trim())
    return (rows || [])
      .filter((t) => (!status || t.status === status) && (!needle || fold(nameMap.get(t.student_id)).includes(needle)))
      .sort(byUrgency)
  }, [rows, status, q, nameMap])

  const markOverdue = async () => {
    const ok = await confirm({
      title: 'Đánh dấu các khoản quá hạn?',
      message: 'Mọi khoản chưa đóng đã qua hạn đóng sẽ chuyển sang trạng thái Quá hạn.',
      confirmLabel: 'Đánh dấu',
    })
    if (!ok) return
    setBusy('overdue')
    try {
      const r = await api.post('/tuition/mark-overdue')
      toast.success(r.updated ? `Đã đánh dấu quá hạn ${r.updated} khoản.` : 'Không có khoản nào cần đánh dấu quá hạn.')
      await reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  const exportXlsx = async () => {
    setBusy('export')
    try {
      await download('/reports/tuition/export.xlsx', 'bao-cao-hoc-phi.xlsx')
      toast.success('Đã tải báo cáo học phí.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  const pay = async (t) => {
    const ok = await confirm({
      title: 'Ghi nhận đã đóng học phí?',
      message: `Khoản ${money(t.amount)} của ${nameOf(t.student_id)} sẽ được đánh dấu là đã đóng.`,
      confirmLabel: 'Ghi nhận',
    })
    if (!ok) return
    setPayingId(t.id)
    try {
      await api.post(`/tuition/${t.id}/pay`)
      toast.success(`Đã ghi nhận ${nameOf(t.student_id)} đóng ${money(t.amount)}.`)
      await reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPayingId(null)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  const { students, summary } = data
  const counts = summary.count_by_status
  const total = summary.paid + summary.unpaid + summary.overdue
  const rate = total ? summary.paid / total : null
  const shownTotal = visible.reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <PageTitle title="Học phí" subtitle="Các khoản học phí và trạng thái thanh toán.">
        <button className="btn-ghost" onClick={markOverdue} disabled={busy === 'overdue'}>
          {busy === 'overdue' ? <Spinner /> : <CalendarClock className="h-4 w-4" />}
          Đánh dấu quá hạn
        </button>
        <button className="btn-ghost" onClick={exportXlsx} disabled={busy === 'export'}>
          {busy === 'export' ? <Spinner /> : <Download className="h-4 w-4" />}
          Xuất Excel
        </button>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
          <Plus className="h-4 w-4" />
          Tạo khoản
        </button>
      </PageTitle>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} tone="amber" label="Chưa đóng" value={money(summary.unpaid)} hint={`${counts.unpaid} khoản`} />
        <StatCard icon={TriangleAlert} tone="rose" label="Quá hạn" value={money(summary.overdue)} hint={`${counts.overdue} khoản`} />
        <StatCard icon={CircleCheck} tone="emerald" label="Đã thu" value={money(summary.paid)} hint={`${counts.paid} khoản`} />
      </div>

      {total > 0 && (
        <div className="card mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">Tỷ lệ đã thu</span>
            <span className="font-semibold tabular-nums text-slate-900">{percent(rate)}</span>
          </div>
          <ProgressBar value={rate} tone="green" label="Tỷ lệ học phí đã thu" />
          <div className="mt-2 text-xs text-slate-500">
            {money(summary.paid)} trên tổng {money(total)}
          </div>
        </div>
      )}

      {showForm && (
        <CreateTuition
          students={students}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            reload()
          }}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Lọc theo trạng thái"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Tất cả', count: counts.unpaid + counts.overdue + counts.paid },
            { value: 'overdue', label: 'Quá hạn', count: counts.overdue },
            { value: 'unpaid', label: 'Chưa đóng', count: counts.unpaid },
            { value: 'paid', label: 'Đã đóng', count: counts.paid },
          ]}
        />
        <SearchBox className="w-full sm:w-64" value={q} onChange={setQ} placeholder="Tìm học viên…" />
      </div>

      <TuitionList
        rows={visible}
        nameOf={nameOf}
        onPay={pay}
        payingId={payingId}
        emptyHint={q || status ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Bấm "Tạo khoản" để thêm khoản học phí đầu tiên.'}
      />
      {visible.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          Hiển thị {visible.length} khoản · tổng <b className="tabular-nums text-slate-700">{money(shownTotal)}</b>
        </p>
      )}
    </>
  )
}

function FamilyTuition() {
  const { list, studentId, setPicked, loading: pl } = useStudentChoice()
  const { data, error, loading } = useAsync(
    () => (studentId ? api.getAll(`/tuition?student_id=${studentId}`) : Promise.resolve([])),
    [studentId],
  )
  if (pl || loading) return <Loading />
  if (error) return <ErrorBox message={error} />

  const title = (
    <PageTitle title="Học phí" subtitle="Các khoản học phí và trạng thái thanh toán.">
      <StudentPicker list={list} value={studentId} onChange={setPicked} />
    </PageTitle>
  )
  if (!studentId) {
    return (
      <>
        {title}
        <EmptyState icon={Wallet} title="Chưa có học viên nào được liên kết">
          Liên hệ trung tâm để liên kết tài khoản với học viên.
        </EmptyState>
      </>
    )
  }

  const rows = [...data].sort(byUrgency)
  const sum = (test) => rows.filter(test).reduce((s, t) => s + t.amount, 0)
  const owed = sum((t) => t.status !== 'paid')
  const overdue = rows.filter((t) => t.status === 'overdue')
  const next = rows.find((t) => t.status === 'unpaid') // đã sắp theo hạn gần nhất
  const nextDays = next ? daysFromToday(next.due_date) : null

  return (
    <>
      {title}
      {overdue.length > 0 && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            Có <b>{overdue.length} khoản quá hạn</b> với tổng <b>{money(sum((t) => t.status === 'overdue'))}</b>. Vui lòng liên hệ
            trung tâm để được hỗ trợ.
          </span>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={owed > 0 ? Wallet : CircleCheck}
          tone={owed > 0 ? 'amber' : 'emerald'}
          label="Còn phải đóng"
          value={money(owed)}
          hint={owed > 0 ? `${rows.filter((t) => t.status !== 'paid').length} khoản` : 'Không có khoản nào còn nợ'}
        />
        <StatCard
          icon={TriangleAlert}
          tone={overdue.length > 0 ? 'rose' : 'emerald'}
          label="Quá hạn"
          value={money(sum((t) => t.status === 'overdue'))}
          hint={`${overdue.length} khoản`}
        />
        <StatCard
          icon={CircleCheck}
          tone="emerald"
          label="Đã đóng"
          value={money(sum((t) => t.status === 'paid'))}
          hint={`${rows.filter((t) => t.status === 'paid').length} khoản`}
        />
        <StatCard
          icon={CalendarClock}
          tone="sky"
          label="Hạn đóng kế tiếp"
          value={next ? fmtDate(next.due_date) : '—'}
          hint={next ? `${money(next.amount)} · ${nextDays > 0 ? `còn ${nextDays} ngày` : nextDays === 0 ? 'hôm nay' : `trễ ${-nextDays} ngày`}` : 'Không có khoản sắp đến hạn'}
        />
      </div>
      <TuitionList rows={rows} emptyHint="Học viên này chưa có khoản học phí nào." />
    </>
  )
}

export default function Tuition() {
  const { user } = useAuth()
  return user.role === 'admin' ? <AdminTuition /> : <FamilyTuition />
}
