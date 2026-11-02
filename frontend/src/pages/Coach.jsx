import { useState } from 'react'
import { ArrowRight, MessageSquareText, TrendingUp, Trophy } from 'lucide-react'
import { api } from '../api'
import { Badge, ErrorBox, Field, Loading, PageTitle, StatCard, useAsync } from '../components/ui'

const CRITERIA = {
  grammar: 'Ngữ pháp',
  vocabulary: 'Từ vựng',
  coherence: 'Mạch lạc',
  development: 'Triển khai ý',
}

const PROVIDER = {
  gemini: { label: 'Gemini', tone: 'blue' },
  rules: { label: 'Ước lượng theo luật', tone: 'gray' },
}

const barColor = (v) => (v >= 7 ? 'bg-emerald-500' : v >= 5 ? 'bg-amber-500' : 'bg-rose-500')
const fmtScore = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const fmtTime = (iso) => new Date(iso).toLocaleString('vi-VN')

function ScoreBar({ label, value }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{fmtScore(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor(value)}`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  )
}

// Kết quả chấm: điểm theo tiêu chí, lỗi kèm câu sửa, gợi ý. Lượt cũ chưa có analysis thì hiện bản chữ.
function Result({ item }) {
  const provider = PROVIDER[item.provider] || PROVIDER.rules
  const a = item.analysis
  if (!a) {
    return <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{item.feedback}</pre>
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-3xl font-bold tracking-tight text-slate-900">
          {fmtScore(item.overall)}
          <span className="text-base font-medium text-slate-400"> / 10</span>
        </div>
        <Badge tone={provider.tone}>{provider.label}</Badge>
        {item.provider !== 'gemini' && (
          <span className="text-xs text-slate-500">Chưa chấm ngữ pháp, chỉ bắt một vài lỗi chắc chắn. Bật Gemini để chấm đầy đủ.</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(CRITERIA)
          .filter(([key]) => a.scores[key] !== undefined)
          .map(([key, label]) => (
            <ScoreBar key={key} label={label} value={a.scores[key]} />
          ))}
      </div>
      {a.strengths && (
        <p className="text-sm text-slate-700">
          <b>Điểm mạnh:</b> {a.strengths}
        </p>
      )}
      {a.errors.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-900">Lỗi cần sửa</div>
          <ul className="space-y-2">
            {a.errors.map((e, i) => (
              <li key={i} className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-rose-600 line-through">{e.original}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-emerald-700">{e.corrected}</span>
                </div>
                {e.explanation && <div className="mt-1 text-slate-500">{e.explanation}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.tips.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-semibold text-slate-900">Gợi ý cải thiện</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {a.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Biểu đồ đường điểm tổng theo thời gian (SVG thuần, không cần thư viện)
function ProgressChart({ points }) {
  const W = 600
  const H = 180
  const pad = { l: 28, r: 12, t: 12, b: 16 }
  const n = points.length
  const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1))
  const y = (v) => pad.t + (1 - v / 10) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.overall).toFixed(1)}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Biểu đồ điểm tổng theo thời gian">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#a5b4fc" strokeWidth="2" />
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.overall)}
            r="5"
            fill={p.provider === 'gemini' ? '#4f46e5' : '#94a3b8'}
            stroke="#fff"
            strokeWidth="1.5"
          >
            <title>{`${fmtTime(p.created_at)}: ${fmtScore(p.overall)}/10 (${(PROVIDER[p.provider] || PROVIDER.rules).label})`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Gemini chấm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Ước lượng theo luật (không so sánh trực tiếp với Gemini)
        </span>
      </div>
    </div>
  )
}

export default function Coach() {
  const [kind, setKind] = useState('writing')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useAsync(() => api.get('/coach/history?limit=10'), [])
  const progress = useAsync(() => api.get('/coach/progress?limit=30'), [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setResult(await api.post('/coach/feedback', { kind, text }))
      history.reload()
      progress.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const points = progress.data?.points || []

  return (
    <>
      <PageTitle title="AI Coach" subtitle="Chấm bài viết hoặc bài nói tiếng Anh của bạn theo từng tiêu chí." />
      <form onSubmit={submit} className="card space-y-3">
        <Field label="Loại bài">
          <select className="input !w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="writing">Bài viết (Writing)</option>
            <option value="speaking">Bài nói (Speaking, dạng văn bản)</option>
          </select>
        </Field>
        <Field label="Nội dung (tối thiểu 20 ký tự)">
          <textarea
            className="input min-h-40"
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={20}
            maxLength={4000}
            required
          />
        </Field>
        <p className="text-xs text-slate-500">
          Nếu hệ thống bật Gemini, bài của bạn sẽ được gửi tới Google để chấm. Đừng dán thông tin cá nhân (họ tên, số điện thoại, địa chỉ) vào bài.
        </p>
        <ErrorBox message={error} />
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Đang chấm…' : 'Chấm bài'}
        </button>
      </form>

      {result && (
        <div className="card mt-5">
          <h2 className="mb-3 font-semibold">Kết quả</h2>
          <Result item={result} />
        </div>
      )}

      <h2 className="mb-2 mt-8 font-semibold">Tiến bộ của bạn</h2>
      {progress.loading ? (
        <Loading />
      ) : progress.error ? (
        <ErrorBox message={progress.error} />
      ) : points.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có lượt chấm nào có điểm. Hãy nộp bài đầu tiên.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={MessageSquareText} tone="indigo" label="Số lượt chấm" value={points.length} />
            <StatCard icon={TrendingUp} tone="sky" label="Điểm trung bình" value={fmtScore(progress.data.average)} />
            <StatCard icon={Trophy} tone="amber" label="Điểm cao nhất" value={fmtScore(progress.data.best)} />
          </div>
          <div className="card">
            {points.length < 2 ? (
              <p className="text-sm text-slate-500">Cần ít nhất 2 lượt chấm để vẽ biểu đồ.</p>
            ) : (
              <ProgressChart points={points} />
            )}
          </div>
        </div>
      )}

      <h2 className="mb-2 mt-8 font-semibold">Lịch sử gần đây</h2>
      {history.loading ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {(history.data || []).map((h) => (
            <details key={h.id} className="card !p-3">
              <summary className="cursor-pointer text-sm">
                <span className="font-semibold">{h.kind === 'writing' ? 'Writing' : 'Speaking'}</span>{' '}
                {h.overall !== null && h.overall !== undefined && (
                  <span className="font-semibold text-indigo-700">· {fmtScore(h.overall)}/10 </span>
                )}
                <span className="text-slate-500">· {fmtTime(h.created_at)}</span>
              </summary>
              <div className="mt-3">
                <Result item={h} />
              </div>
            </details>
          ))}
          {(history.data || []).length === 0 && <p className="text-sm text-slate-500">Chưa có lượt nào.</p>}
        </div>
      )}
    </>
  )
}
