import { useMemo, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { api } from '../api'
import StudentPicker, { useStudentChoice } from '../components/StudentPicker'
import {
  ATTENDANCE,
  Badge,
  EmptyRow,
  ErrorBox,
  Loading,
  PageTitle,
  Ring,
  Segmented,
  attendanceTone,
  fmtDate,
  useAsync,
} from '../components/ui'

const RING_COLOR = { green: '#059669', amber: '#d97706', red: '#e11d48', gray: '#94a3b8' }

const COUNTS = [
  ['present', 'Có mặt', 'text-emerald-600'],
  ['late', 'Đi trễ', 'text-amber-600'],
  ['absent', 'Vắng', 'text-rose-600'],
  ['excused', 'Vắng có phép', 'text-sky-600'],
]

export default function Attendance() {
  const { list, studentId, setPicked, loading: pl } = useStudentChoice()
  const [classId, setClassId] = useState('') // '' là tất cả các lớp
  const { data, error, loading } = useAsync(async () => {
    if (!studentId) return null
    const [summary, rows, classes] = await Promise.all([
      api.get(`/attendance/summary/${studentId}`),
      api.getAll(`/attendance?student_id=${studentId}`),
      api.getAll('/classes'),
    ])
    return { summary, rows, classes }
  }, [studentId])

  const rows = data?.rows
  const shown = useMemo(() => (rows || []).filter((a) => !classId || a.class_id === Number(classId)), [rows, classId])

  if (pl || loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>

  const { summary, classes } = data
  const classCode = (id) => classes.find((c) => c.id === id)?.code || `#${id}`
  const classIds = [...new Set(data.rows.map((a) => a.class_id))]

  return (
    <>
      <PageTitle title="Chuyên cần" subtitle="Lịch sử điểm danh theo từng buổi học.">
        <StudentPicker
          list={list}
          value={studentId}
          onChange={(id) => {
            setClassId('')
            setPicked(id)
          }}
        />
      </PageTitle>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <Ring
            value={summary.attendance_rate}
            color={RING_COLOR[attendanceTone(summary.attendance_rate)]}
            label="Tỷ lệ chuyên cần"
            caption={`${summary.present + summary.late}/${summary.total - summary.excused} buổi có mặt`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {COUNTS.map(([key, label, color]) => (
            <div key={key} className="card flex items-center justify-between">
              <span className="text-sm text-slate-500">{label}</span>
              <span className={`text-2xl font-bold tabular-nums ${color}`}>{summary[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {classIds.length > 1 && (
        <div className="mb-4">
          <Segmented
            label="Lọc theo lớp"
            value={classId}
            onChange={setClassId}
            options={[
              { value: '', label: 'Tất cả lớp', count: data.rows.length },
              ...classIds.map((id) => ({
                value: String(id),
                label: classCode(id),
                count: data.rows.filter((a) => a.class_id === id).length,
              })),
            ]}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <CalendarCheck className="mb-2 h-8 w-8 text-slate-300" />
          <span className="text-sm text-slate-500">Chưa có buổi học nào được ghi nhận.</span>
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {shown.map((a) => (
              <li key={a.id} className="card !p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{fmtDate(a.date)}</div>
                    <div className="text-xs text-slate-500">{classCode(a.class_id)}</div>
                  </div>
                  <Badge tone={ATTENDANCE[a.status].tone}>{ATTENDANCE[a.status].label}</Badge>
                </div>
                {a.note && <p className="mt-2 text-sm text-slate-500">{a.note}</p>}
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto !p-0 md:block">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Ngày</th>
                  <th className="th">Lớp</th>
                  <th className="th">Trạng thái</th>
                  <th className="th">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((a) => (
                  <tr key={a.id}>
                    <td className="td font-medium text-slate-900">{fmtDate(a.date)}</td>
                    <td className="td">{classCode(a.class_id)}</td>
                    <td className="td">
                      <Badge tone={ATTENDANCE[a.status].tone}>{ATTENDANCE[a.status].label}</Badge>
                    </td>
                    <td className="td text-slate-500">{a.note || '—'}</td>
                  </tr>
                ))}
                {shown.length === 0 && <EmptyRow cols={4}>Chưa có buổi học nào được ghi nhận.</EmptyRow>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
