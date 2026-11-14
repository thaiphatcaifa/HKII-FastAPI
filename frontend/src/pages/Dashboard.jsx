import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, Clock, GraduationCap, School, TriangleAlert, Users, Wallet } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { PublishedReviews } from '../components/AiTabs'
import StudentPicker, { useStudentChoice } from '../components/StudentPicker'
import {
  ATTENDANCE,
  Avatar,
  Badge,
  ClassMark,
  ErrorBox,
  Loading,
  Metric,
  PageTitle,
  Ring,
  ScoreChip,
  StatCard,
  attendanceTone,
  averageTone,
  daysFromToday,
  fmtDate,
  fmtScore,
  money,
  percent,
  scoreKindLabel,
  useAsync,
} from '../components/ui'

const GREETING = {
  admin: 'Toàn cảnh hoạt động của trung tâm.',
  teacher: 'Các lớp bạn đang phụ trách.',
  student: 'Tình hình học tập của bạn.',
  parent: 'Tình hình học tập của con.',
}

const LEVEL = {
  high: { label: 'Rủi ro cao', tone: 'red' },
  medium: { label: 'Rủi ro trung bình', tone: 'amber' },
}

function SectionCard({ title, action, children }) {
  return (
    <section className="card !p-0">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

const SeeAll = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
    {children}
    <ArrowRight className="h-4 w-4" />
  </Link>
)

// Số liệu nhỏ có nhãn (dùng trong dòng và thẻ lớp)
const Stat = ({ label, children }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
)

function ClassStats({ report }) {
  if (!report) return null
  return (
    <>
      <Stat label="Học viên">
        <span className="font-semibold tabular-nums text-slate-900">{report.student_count}</span>
      </Stat>
      <Stat label="Chuyên cần">
        <Metric tone={attendanceTone(report.average_attendance_rate)}>{percent(report.average_attendance_rate)}</Metric>
      </Stat>
      <Stat label="Điểm TB">
        <Metric tone={averageTone(report.average_score_10)}>
          {report.average_score_10 === null ? '—' : fmtScore(report.average_score_10)}
        </Metric>
      </Stat>
    </>
  )
}

function AdminHome() {
  const { data, error, loading } = useAsync(async () => {
    const [classes, users, tuition, overdue] = await Promise.all([
      api.getAll('/classes'),
      api.getAll('/users'),
      api.get('/tuition/summary'),
      api.getAll('/tuition?status=overdue'),
    ])
    const reports = await Promise.all(classes.map((c) => api.get(`/reports/class/${c.id}/summary`).catch(() => null)))
    return { classes, users, tuition, overdue, reports }
  }, [])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  const { classes, users, tuition, overdue, reports } = data
  const count = (role) => users.filter((u) => u.role === role).length
  const nameOf = new Map(users.map((u) => [u.id, u.full_name]))
  const total = tuition.paid + tuition.unpaid + tuition.overdue
  const pct = (v) => (total ? (v / total) * 100 : 0)
  const parts = [
    ['Đã thu', tuition.paid, 'bg-emerald-500', 'text-emerald-600'],
    ['Chưa đóng', tuition.unpaid, 'bg-amber-400', 'text-amber-600'],
    ['Quá hạn', tuition.overdue, 'bg-rose-500', 'text-rose-600'],
  ]
  const lateFirst = [...overdue].sort((a, b) => a.due_date.localeCompare(b.due_date))

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={School} tone="indigo" label="Lớp học" value={classes.length} />
        <StatCard
          icon={Users}
          tone="sky"
          label="Học viên"
          value={count('student')}
          hint={`${count('teacher')} giáo viên · ${count('parent')} phụ huynh`}
        />
        <StatCard
          icon={Wallet}
          tone="amber"
          label="Học phí chưa đóng"
          value={money(tuition.unpaid)}
          hint={`${tuition.count_by_status.unpaid} khoản`}
        />
        <StatCard
          icon={TriangleAlert}
          tone="rose"
          label="Học phí quá hạn"
          value={money(tuition.overdue)}
          hint={`${tuition.count_by_status.overdue} khoản`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionCard title="Lớp học" action={<SeeAll to="/classes">Tất cả lớp</SeeAll>}>
            {classes.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có lớp nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {classes.map((c, i) => (
                  <li key={c.id}>
                    <Link
                      to={`/classes/${c.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition hover:bg-slate-50"
                    >
                      <ClassMark code={c.code} index={i} />
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="truncate font-semibold text-slate-900">{c.name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {c.code} · {nameOf.get(c.teacher_id) || 'Chưa phân công'} · {c.schedule || 'Chưa có lịch'}
                        </div>
                      </div>
                      <dl className="flex gap-5 text-right">
                        <ClassStats report={reports[i]} />
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="Khoản học phí quá hạn" action={<SeeAll to="/tuition">Xem tất cả</SeeAll>}>
            {lateFirst.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <CircleCheck className="mb-2 h-8 w-8 text-emerald-500" />
                <div className="text-sm font-medium text-slate-900">Không có khoản nào quá hạn</div>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {lateFirst.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={nameOf.get(t.student_id)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {nameOf.get(t.student_id) || `#${t.student_id}`}
                        </div>
                        <div className="text-xs font-medium text-rose-600">
                          Trễ {-daysFromToday(t.due_date)} ngày · hạn {fmtDate(t.due_date)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-slate-900">{money(t.amount)}</div>
                    </li>
                  ))}
                </ul>
                {lateFirst.length > 5 && (
                  <div className="border-t border-slate-100 px-5 py-3 text-center text-xs text-slate-500">
                    và {lateFirst.length - 5} khoản khác
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="card mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Tình hình học phí</h2>
          <span className="text-sm text-slate-500">Tổng {money(total)}</span>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
          {parts.map(([label, value, bg]) => (
            <div key={label} className={bg} style={{ width: `${pct(value)}%` }} title={`${label}: ${money(value)}`} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {parts.map(([label, value, bg, text]) => (
            <div key={label} className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${bg}`} />
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div className={`font-semibold tabular-nums ${text}`}>{money(value)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function TeacherHome() {
  const { data, error, loading } = useAsync(async () => {
    const classes = await api.getAll('/classes')
    const [reports, risks] = await Promise.all([
      Promise.all(classes.map((c) => api.get(`/reports/class/${c.id}/summary`).catch(() => null))),
      Promise.all(classes.map((c) => api.get(`/ai/risk?class_id=${c.id}`).catch(() => []))),
    ])
    return { classes, reports, risks }
  }, [])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  const { classes, reports, risks } = data
  if (classes.length === 0) {
    return <div className="card text-sm text-slate-500">Bạn chưa phụ trách lớp nào.</div>
  }
  // Rủi ro do luật tính; chỉ nêu học viên đã đủ dữ liệu và ở mức trung bình trở lên
  const attention = risks
    .flatMap((list, i) =>
      list.filter((r) => r.enough_data && r.level !== 'low').map((r) => ({ ...r, classroom: classes[i] })),
    )
    .sort((a, b) => b.points - a.points)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c, i) => (
          <Link
            key={c.id}
            to={`/classes/${c.id}`}
            className="card group block transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <ClassMark code={c.code} index={i} large />
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900 group-hover:text-indigo-700">{c.name}</div>
                <div className="text-xs font-medium text-slate-500">{c.code}</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {c.schedule || 'Chưa có lịch'}
                </div>
              </div>
            </div>
            {reports[i] && (
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <ClassStats report={reports[i]} />
              </dl>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <SectionCard title="Học viên cần chú ý">
          {attention.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <CircleCheck className="mb-2 h-8 w-8 text-emerald-500" />
              <div className="text-sm font-medium text-slate-900">Chưa có học viên nào cần chú ý</div>
              <div className="mt-1 text-sm text-slate-500">Chuyên cần và điểm số của các lớp đang ổn.</div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((r) => (
                <li key={`${r.classroom.id}-${r.student_id}`}>
                  <Link
                    to={`/classes/${r.classroom.id}?tab=risk`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <Avatar name={r.full_name} size="sm" />
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="truncate text-sm font-medium text-slate-900">{r.full_name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {r.classroom.code}
                        {r.reasons[0] ? ` · ${r.reasons[0]}` : ''}
                      </div>
                    </div>
                    <Badge tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Badge>
                    <ArrowRight className="hidden h-4 w-4 text-slate-300 sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <p className="mt-2 text-xs text-slate-400">
          Mức rủi ro tính bằng luật từ điểm danh và điểm số. Mở lớp, tab Cảnh báo để xem lý do và nhờ AI gợi ý hành động.
        </p>
      </div>
    </>
  )
}

function FamilyHome() {
  const { list, studentId, setPicked, loading: pl } = useStudentChoice()
  const { data, error, loading } = useAsync(async () => {
    if (!studentId) return null
    const [att, grades, tuition, recentAtt, recentScores, classes] = await Promise.all([
      api.get(`/attendance/summary/${studentId}`),
      api.get(`/scores/student/${studentId}/summary`),
      api.getAll(`/tuition?student_id=${studentId}`),
      api.get(`/attendance?student_id=${studentId}&limit=5`),
      api.get(`/scores?student_id=${studentId}&limit=5`),
      api.getAll('/classes'),
    ])
    const avg = grades.length ? grades.reduce((s, g) => s + g.average_10, 0) / grades.length : null
    const owed = tuition.filter((t) => t.status !== 'paid').reduce((s, t) => s + t.amount, 0)
    return { att, avg, owed, recentAtt, recentScores, classCode: new Map(classes.map((c) => [c.id, c.code])) }
  }, [studentId])

  if (pl || loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return <div className="card text-sm text-slate-500">Chưa có học viên nào được liên kết.</div>
  const { att, avg, owed, recentAtt, recentScores, classCode } = data
  const code = (id) => classCode.get(id) || `#${id}`
  return (
    <>
      {list.length > 1 && (
        <div className="mb-4">
          <StudentPicker list={list} value={studentId} onChange={setPicked} />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <Ring
            value={att.attendance_rate}
            color="#059669"
            label="Chuyên cần"
            caption={`${att.present + att.late}/${att.total - att.excused} buổi có mặt`}
          />
        </div>
        <div className="card">
          <Ring
            value={avg === null ? null : avg / 10}
            color="#4f46e5"
            label="Điểm trung bình"
            display={avg === null ? '—' : avg.toFixed(2)}
            caption={avg === null ? 'Chưa có điểm' : 'Trên thang 10'}
          />
        </div>
        <StatCard
          icon={owed > 0 ? Wallet : CircleCheck}
          tone={owed > 0 ? 'amber' : 'emerald'}
          label="Học phí còn nợ"
          value={money(owed)}
          hint={owed > 0 ? 'Vui lòng liên hệ trung tâm' : 'Không có khoản nào còn nợ'}
        />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Có mặt', att.present, 'text-emerald-600'],
          ['Đi trễ', att.late, 'text-amber-600'],
          ['Vắng', att.absent, 'text-rose-600'],
          ['Vắng có phép', att.excused, 'text-sky-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="card flex items-center justify-between">
            <span className="text-sm text-slate-500">{label}</span>
            <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Buổi học gần đây" action={<SeeAll to="/attendance">Xem tất cả</SeeAll>}>
          {recentAtt.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Chưa có buổi học nào được ghi nhận.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAtt.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{fmtDate(a.date)}</div>
                    <div className="text-xs text-slate-500">{code(a.class_id)}</div>
                  </div>
                  <Badge tone={ATTENDANCE[a.status].tone}>{ATTENDANCE[a.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Điểm gần đây" action={<SeeAll to="/grades">Xem tất cả</SeeAll>}>
          {recentScores.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Chưa có điểm nào.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentScores.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{scoreKindLabel(s.kind)}</div>
                    <div className="text-xs text-slate-500">{code(s.class_id)}</div>
                  </div>
                  <ScoreChip value={s.value} max={s.max_value} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <PublishedReviews studentId={studentId} />
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <GraduationCap className="h-4 w-4" />
        Tỷ lệ chuyên cần = (có mặt + đi trễ) / (tổng số buổi trừ buổi vắng có phép).
      </p>
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <>
      <PageTitle title={`Xin chào, ${user.full_name}`} subtitle={GREETING[user.role]} />
      {user.role === 'admin' && <AdminHome />}
      {user.role === 'teacher' && <TeacherHome />}
      {(user.role === 'student' || user.role === 'parent') && <FamilyHome />}
    </>
  )
}
