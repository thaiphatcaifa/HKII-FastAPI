import { useMemo, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { api } from '../api'
import StudentPicker, { useStudentChoice } from '../components/StudentPicker'
import {
  EmptyState,
  ErrorBox,
  Loading,
  Metric,
  PageTitle,
  ProgressBar,
  ScoreChip,
  scoreKindLabel,
  scoreTone,
  useAsync,
} from '../components/ui'

export default function Grades() {
  const { list, studentId, setPicked, loading: pl } = useStudentChoice()
  const [classId, setClassId] = useState('') // '' là tất cả các lớp
  const { data, error, loading } = useAsync(async () => {
    if (!studentId) return null
    const [summary, scores, classes] = await Promise.all([
      api.get(`/scores/student/${studentId}/summary`),
      api.getAll(`/scores?student_id=${studentId}`),
      api.getAll('/classes'),
    ])
    return { summary, scores, classes }
  }, [studentId])

  const scores = data?.scores
  const shown = useMemo(() => (scores || []).filter((s) => !classId || s.class_id === Number(classId)), [scores, classId])

  if (pl || loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  if (!data) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>

  const { summary, classes } = data
  const classCode = (id) => classes.find((c) => c.id === id)?.code || `#${id}`

  return (
    <>
      <PageTitle title="Điểm số" subtitle="Từng đầu điểm và điểm trung bình theo lớp (thang 10).">
        <StudentPicker
          list={list}
          value={studentId}
          onChange={(id) => {
            setClassId('')
            setPicked(id)
          }}
        />
      </PageTitle>

      {summary.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Chưa có điểm nào">
          Điểm sẽ hiện ở đây sau khi giáo viên nhập.
        </EmptyState>
      ) : (
        <>
          <div className="mb-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.map((s) => {
              const on = classId === String(s.class_id)
              return (
                <button
                  key={s.class_id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setClassId(on ? '' : String(s.class_id))}
                  className={`card text-left transition hover:border-indigo-300 ${on ? '!border-indigo-400 ring-2 ring-indigo-200' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      {classCode(s.class_id)}
                    </span>
                    <span className="text-xs text-slate-500">{s.count} đầu điểm</span>
                  </div>
                  <div className="mt-3 text-3xl font-bold tracking-tight">
                    <Metric tone={scoreTone(s.average_10)}>{s.average_10.toFixed(2)}</Metric>
                  </div>
                  <div className="mb-2 text-xs text-slate-500">Điểm trung bình, thang 10</div>
                  <ProgressBar
                    value={s.average_10 / 10}
                    tone={scoreTone(s.average_10)}
                    label={`Điểm trung bình lớp ${classCode(s.class_id)}`}
                  />
                </button>
              )
            })}
          </div>
          <p className="mb-5 text-xs text-slate-600">
            {summary.length > 1 ? 'Bấm vào một lớp để chỉ xem điểm của lớp đó. ' : ''}
            Điểm tô màu: từ 8 trở lên là tốt, từ 5 đến dưới 8 là khá, dưới 5 cần cố gắng thêm.
          </p>

          <ul className="space-y-3 md:hidden">
            {shown.map((s) => (
              <li key={s.id} className="card !p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{scoreKindLabel(s.kind)}</div>
                    <div className="text-xs text-slate-500">{classCode(s.class_id)}</div>
                  </div>
                  <ScoreChip value={s.value} max={s.max_value} />
                </div>
                {s.note && <p className="mt-2 text-sm text-slate-500">{s.note}</p>}
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto !p-0 md:block">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Lớp</th>
                  <th className="th">Loại</th>
                  <th className="th">Điểm</th>
                  <th className="th">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td className="td">{classCode(s.class_id)}</td>
                    <td className="td font-medium text-slate-900">{scoreKindLabel(s.kind)}</td>
                    <td className="td">
                      <ScoreChip value={s.value} max={s.max_value} />
                    </td>
                    <td className="td text-slate-500">{s.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">{shown.length} đầu điểm</p>
        </>
      )}
    </>
  )
}
