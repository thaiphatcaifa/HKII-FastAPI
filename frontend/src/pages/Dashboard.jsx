import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  Clock,
  GraduationCap,
  School,
  ShieldAlert,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '../api'
import { ROLE_LABEL, useAuth } from '../auth'
import { PublishedReviews } from '../components/AiTabs'
import { AttendanceStrip, BarList, Donut, Legend } from '../components/charts'
import Hero, { HeroLink } from '../components/Hero'
import StudentPicker, { useStudentChoice } from '../components/StudentPicker'
import {
  ATTENDANCE,
  Avatar,
  Badge,
  ClassMark,
  ErrorBox,
  Loading,
  Metric,
  ProgressBar,
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
  scoreTone,
  useAsync,
} from '../components/ui'

const EYEBROW = {
  admin: 'Bảng điều khiển',
  teacher: 'Không gian giảng dạy',
  student: 'Góc học tập',
  parent: 'Góc phụ huynh',
}

const SUBTITLE = {
  admin: 'Toàn cảnh hoạt động của trung tâm.',
  teacher: 'Các lớp bạn đang phụ trách.',
  student: 'Tình hình học tập của bạn.',
  parent: 'Tình hình học tập của con.',
}

const LEVEL = {
  high: { label: 'Rủi ro cao', tone: 'red' },
  medium: { label: 'Rủi ro trung bình', tone: 'amber' },
}

const heroProps = (user) => ({
  eyebrow: EYEBROW[user.role],
  title: `Xin chào, ${user.full_name}`,
  subtitle: SUBTITLE[user.role],
  docTitle: 'Tổng quan',
})

function SectionCard({ title, action, children }) {
  return (
    <section className="card !p-0">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="font-display text-[15px] font-bold text-slate-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

const SeeAll = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
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

function AdminHome({ user }) {
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
  const paidRate = total ? tuition.paid / total : null
  const lateFirst = [...overdue].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const overdueCount = tuition.count_by_status.overdue
  // Trung bình có trọng số theo số học viên của từng lớp
  const weighted = (key) => {
    const parts = reports.filter((r) => r && r.student_count > 0 && r[key] !== null && r[key] !== undefined)
    const n = parts.reduce((s, r) => s + r.student_count, 0)
    return n ? parts.reduce((s, r) => s + r[key] * r.student_count, 0) / n : null
  }
  const attendanceAvg = weighted('average_attendance_rate')
  const scoreAvg = weighted('average_score_10')
  const roles = [
    ['admin', 'brand'],
    ['teacher', 'blue'],
    ['student', 'green'],
    ['parent', 'amber'],
  ]

  return (
    <>
      <Hero
        {...heroProps(user)}
        chips={[
          [CalendarCheck, `Chuyên cần trung bình ${percent(attendanceAvg)}`],
          [GraduationCap, `Điểm trung bình ${scoreAvg === null ? '—' : fmtScore(scoreAvg)}`],
          ...(overdueCount > 0 ? [[TriangleAlert, `${overdueCount} khoản học phí quá hạn`]] : []),
        ]}
        action={overdueCount > 0 ? <HeroLink to="/tuition">Xử lý học phí</HeroLink> : null}
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={School} tone="brand" label="Lớp học" value={classes.length} />
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
          amount={tuition.unpaid}
          format={money}
          hint={`${tuition.count_by_status.unpaid} khoản`}
        />
        <StatCard
          icon={TriangleAlert}
          tone="rose"
          label="Học phí quá hạn"
          amount={tuition.overdue}
          format={money}
          hint={`${overdueCount} khoản`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
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
                      <ClassMark code={c.code} />
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
                      <div className="font-display text-sm font-bold tabular-nums text-slate-900">{money(t.amount)}</div>
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

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Tình hình học phí" action={<span className="text-sm text-slate-500">Tổng {money(total)}</span>}>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 p-5">
              <Donut
                label="Tình hình học phí"
                segments={[
                  { label: 'Đã thu', value: tuition.paid, color: '#10b981' },
                  { label: 'Chưa đóng', value: tuition.unpaid, color: '#f59e0b' },
                  { label: 'Quá hạn', value: tuition.overdue, color: '#f43f5e' },
                ]}
              >
                <div className="font-display text-3xl font-extrabold text-slate-900">{percent(paidRate)}</div>
                <div className="text-xs text-slate-500">đã thu</div>
              </Donut>
              <div className="min-w-40">
                <Legend
                  items={[
                    { label: 'Đã thu', display: money(tuition.paid), color: '#10b981', hint: `${tuition.count_by_status.paid} khoản` },
                    { label: 'Chưa đóng', display: money(tuition.unpaid), color: '#f59e0b', hint: `${tuition.count_by_status.unpaid} khoản` },
                    { label: 'Quá hạn', display: money(tuition.overdue), color: '#f43f5e', hint: `${overdueCount} khoản` },
                  ]}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Người dùng theo vai trò">
            <div className="p-5">
              <BarList
                items={roles.map(([role, tone]) => ({
                  label: ROLE_LABEL[role],
                  value: users.length ? count(role) / users.length : 0,
                  display: String(count(role)),
                  tone,
                }))}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}

function TeacherHome({ user }) {
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
  const evaluated = risks.flat().filter((r) => r.enough_data)
  const attention = risks
    .flatMap((list, i) =>
      list.filter((r) => r.enough_data && r.level !== 'low').map((r) => ({ ...r, classroom: classes[i] })),
    )
    .sort((a, b) => b.points - a.points)
  const levelCount = (level) => evaluated.filter((r) => r.level === level).length
  const studentCount = new Set(risks.flat().map((r) => r.student_id)).size

  return (
    <>
      <Hero
        {...heroProps(user)}
        chips={[
          [School, `${classes.length} lớp học`],
          [Users, `${studentCount} học viên`],
          attention.length > 0
            ? [ShieldAlert, `${attention.length} học viên cần chú ý`]
            : [CircleCheck, 'Chưa có học viên cần chú ý'],
        ]}
        action={
          attention.length > 0 ? (
            <HeroLink to={`/classes/${attention[0].classroom.id}?tab=risk`}>Xem cảnh báo</HeroLink>
          ) : null
        }
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c, i) => (
          <Link
            key={c.id}
            to={`/classes/${c.id}`}
            className="card group block transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
          >
            <div className="flex items-center gap-4">
              <ClassMark code={c.code} large />
              <div className="min-w-0">
                <div className="truncate font-display font-bold text-slate-900 group-hover:text-brand-800">{c.name}</div>
                <div className="text-xs font-medium text-slate-500">{c.code}</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {c.schedule || 'Chưa có lịch'}
                </div>
              </div>
            </div>
            {reports[i] && (
              <>
                <div className="mt-4">
                  <ProgressBar
                    value={reports[i].average_attendance_rate}
                    tone={{ green: 'green', amber: 'amber', red: 'red', gray: 'brand' }[attendanceTone(reports[i].average_attendance_rate)]}
                    label={`Chuyên cần lớp ${c.code}`}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <ClassStats report={reports[i]} />
                </dl>
              </>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionCard title="Mức rủi ro học viên">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5 p-5">
              <Donut
                size={148}
                thickness={18}
                label="Phân bố mức rủi ro"
                segments={[
                  { label: 'Rủi ro cao', value: levelCount('high'), color: '#f43f5e' },
                  { label: 'Rủi ro trung bình', value: levelCount('medium'), color: '#f59e0b' },
                  { label: 'Ổn định', value: levelCount('low'), color: '#10b981' },
                ]}
              >
                <div className="font-display text-3xl font-extrabold text-slate-900">{evaluated.length}</div>
                <div className="text-xs text-slate-500">lượt đánh giá</div>
              </Donut>
              <div className="min-w-32">
                <Legend
                  items={[
                    { label: 'Rủi ro cao', display: String(levelCount('high')), color: '#f43f5e' },
                    { label: 'Trung bình', display: String(levelCount('medium')), color: '#f59e0b' },
                    { label: 'Ổn định', display: String(levelCount('low')), color: '#10b981' },
                  ]}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-3">
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
          <p className="mt-2 text-xs text-slate-600">
            Mức rủi ro tính bằng luật từ điểm danh và điểm số. Mở lớp, tab Cảnh báo để xem lý do và nhờ AI gợi ý hành động.
          </p>
        </div>
      </div>
    </>
  )
}

const COUNTS = [
  ['present', 'Có mặt', 'text-emerald-600'],
  ['late', 'Đi trễ', 'text-amber-600'],
  ['absent', 'Vắng', 'text-rose-600'],
  ['excused', 'Vắng có phép', 'text-sky-600'],
]

function FamilyHome({ user }) {
  const { list, studentId, setPicked, loading: pl } = useStudentChoice()
  const { data, error, loading } = useAsync(async () => {
    if (!studentId) return null
    const [att, grades, tuition, recentAtt, recentScores, classes] = await Promise.all([
      api.get(`/attendance/summary/${studentId}`),
      api.get(`/scores/student/${studentId}/summary`),
      api.getAll(`/tuition?student_id=${studentId}`),
      api.get(`/attendance?student_id=${studentId}&limit=100`), // đủ để phủ 10 ngày học kể cả khi học nhiều lớp cùng ngày
      api.get(`/scores?student_id=${studentId}&limit=5`),
      api.getAll('/classes'),
    ])
    const avg = grades.length ? grades.reduce((s, g) => s + g.average_10, 0) / grades.length : null
    const owed = tuition.filter((t) => t.status !== 'paid').reduce((s, t) => s + t.amount, 0)
    return { att, avg, owed, grades, recentAtt, recentScores, classCode: new Map(classes.map((c) => [c.id, c.code])) }
  }, [studentId])

  if (pl || loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return <div className="card text-sm text-slate-500">Chưa có học viên nào được liên kết.</div>
  const { att, avg, owed, grades, recentAtt, recentScores, classCode } = data
  const code = (id) => classCode.get(id) || `#${id}`
  return (
    <>
      <Hero
        {...heroProps(user)}
        chips={[
          [CalendarCheck, `Chuyên cần ${percent(att.attendance_rate)}`],
          [GraduationCap, `Điểm trung bình ${avg === null ? '—' : fmtScore(avg)}`],
          owed > 0 ? [Wallet, `Còn nợ ${money(owed)}`] : [CircleCheck, 'Học phí đã đóng đủ'],
        ]}
      />
      {list.length > 1 && (
        <div className="mb-4">
          <StudentPicker list={list} value={studentId} onChange={setPicked} />
        </div>
      )}

      <div className="stagger grid gap-4 md:grid-cols-3">
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
            label="Điểm trung bình"
            display={avg === null ? '—' : avg.toFixed(2)}
            caption={avg === null ? 'Chưa có điểm' : 'Trên thang 10'}
          />
        </div>
        <StatCard
          icon={owed > 0 ? Wallet : CircleCheck}
          tone={owed > 0 ? 'amber' : 'emerald'}
          label="Học phí còn nợ"
          amount={owed}
          format={money}
          hint={owed > 0 ? 'Vui lòng liên hệ trung tâm' : 'Không có khoản nào còn nợ'}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionCard title="Điểm danh các buổi gần nhất">
            <div className="p-5">
              <div className="mb-2 grid grid-cols-4 gap-3 text-center">
                {COUNTS.map(([key, label, color]) => (
                  <div key={key}>
                    <div className={`font-display text-2xl font-extrabold tabular-nums ${color}`}>{att[key]}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              <p className="mb-5 text-center text-xs text-slate-600">Tổng cộng {att.total} buổi đã điểm danh</p>
              {recentAtt.length > 0 ? (
                <AttendanceStrip records={recentAtt} classLabel={code} />
              ) : (
                <p className="text-center text-sm text-slate-500">Chưa có buổi học nào được ghi nhận.</p>
              )}
            </div>
          </SectionCard>
        </div>
        <div className="lg:col-span-2">
          <SectionCard title="Điểm trung bình theo lớp">
            <div className="p-5">
              {grades.length === 0 ? (
                <p className="text-center text-sm text-slate-500">Chưa có điểm nào.</p>
              ) : (
                <BarList
                  items={grades.map((g) => ({
                    label: code(g.class_id),
                    sub: `${g.count} đầu điểm`,
                    value: g.average_10 / 10,
                    display: g.average_10.toFixed(2),
                    tone: scoreTone(g.average_10),
                  }))}
                />
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Buổi học gần đây" action={<SeeAll to="/attendance">Xem tất cả</SeeAll>}>
          {recentAtt.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Chưa có buổi học nào được ghi nhận.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAtt.slice(0, 5).map((a) => (
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
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-600">
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
      {user.role === 'admin' && <AdminHome user={user} />}
      {user.role === 'teacher' && <TeacherHome user={user} />}
      {(user.role === 'student' || user.role === 'parent') && <FamilyHome user={user} />}
    </>
  )
}
