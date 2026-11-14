import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ChevronRight,
  CircleCheck,
  Lightbulb,
  MessageSquareText,
  Mic,
  PenLine,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
  WandSparkles,
} from 'lucide-react'
import { api } from '../api'
import { useToast } from '../components/feedback'
import {
  Badge,
  EmptyState,
  ErrorBox,
  PageTitle,
  ProgressBar,
  Ring,
  ScoreChip,
  Segmented,
  Spinner,
  StatCard,
  fmtDateTime,
  fmtScore,
  scoreTone,
  useAsync,
} from '../components/ui'

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

const RING_COLOR = { green: '#059669', amber: '#d97706', red: '#e11d48' }

const MIN_CHARS = 20
const MAX_CHARS = 4000

// Bài mẫu có vài lỗi quen thuộc (i viết thường, a/an, từ lặp, chia động từ) để thử hoặc demo nhanh
const SAMPLE_TEXT =
  'i like learning english because it help me talk with many people. Yesterday I go to the the library and read a interesting book. My teacher say that practice every day is very important.'

const shortDate = (iso) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

function ScoreBar({ label, value }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{fmtScore(value)}</span>
      </div>
      <ProgressBar value={value / 10} tone={scoreTone(value)} label={`${label}: ${fmtScore(value)} trên 10`} />
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
  const hasOverall = item.overall !== null && item.overall !== undefined
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        {hasOverall && (
          <Ring
            compact
            value={item.overall / 10}
            color={RING_COLOR[scoreTone(item.overall)]}
            label="Điểm tổng"
            display={fmtScore(item.overall)}
            caption="Thang điểm 10"
          />
        )}
        <div className="grid min-w-[16rem] flex-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {Object.entries(CRITERIA)
            .filter(([key]) => a.scores[key] !== undefined)
            .map(([key, label]) => (
              <ScoreBar key={key} label={label} value={a.scores[key]} />
            ))}
        </div>
      </div>

      {item.provider !== 'gemini' && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          <Badge tone={provider.tone}>{provider.label}</Badge>
          <span className="pt-0.5">Chưa chấm ngữ pháp, chỉ bắt một vài lỗi chắc chắn. Bật Gemini để chấm đầy đủ.</span>
        </p>
      )}

      {a.strengths && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <div className="font-semibold">Điểm mạnh</div>
            <div className="mt-0.5 text-emerald-800">{a.strengths}</div>
          </div>
        </div>
      )}

      {a.errors.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-900">Lỗi cần sửa ({a.errors.length})</div>
          <ul className="space-y-2">
            {a.errors.map((e, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-md bg-rose-50 px-1.5 py-0.5 font-medium text-rose-700 line-through decoration-rose-300">
                    {e.original}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">{e.corrected}</span>
                </div>
                {e.explanation && <div className="mt-1.5 text-slate-500">{e.explanation}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.tips.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">Gợi ý cải thiện</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-800">
              {a.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function GradingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang chấm bài">
      <div className="flex flex-wrap items-center gap-6">
        <div className="skeleton h-20 w-20 !rounded-full" />
        <div className="grid min-w-[16rem] flex-1 gap-3 sm:grid-cols-2">
          <div className="skeleton h-8" />
          <div className="skeleton h-8" />
          <div className="skeleton h-8" />
          <div className="skeleton h-8" />
        </div>
      </div>
      <div className="skeleton h-16" />
      <div className="skeleton h-24" />
    </div>
  )
}

// Đo chiều rộng khung chứa để vẽ biểu đồ đúng cỡ chữ ở mọi màn hình
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

// Biểu đồ đường điểm tổng theo thời gian (SVG thuần, không cần thư viện)
function ProgressChart({ points }) {
  const [ref, width] = useWidth()
  const H = 220
  const pad = { l: 34, r: 20, t: 24, b: 32 }
  const W = Math.max(width, 240)
  const n = points.length
  const inner = W - pad.l - pad.r
  const x = (i) => pad.l + (n === 1 ? inner / 2 : (i * inner) / (n - 1))
  const y = (v) => pad.t + (1 - v / 10) * (H - pad.t - pad.b)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.overall).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`
  const last = points[n - 1]
  return (
    <div ref={ref}>
      {width > 0 && (
        <svg width={W} height={H} role="img" aria-label="Biểu đồ điểm tổng theo thời gian">
          <defs>
            <linearGradient id="coach-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray={v === 0 ? undefined : '3 4'} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {v}
              </text>
            </g>
          ))}
          <path d={area} fill="url(#coach-area)" />
          <path d={line} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle
              key={p.id}
              cx={x(i)}
              cy={y(p.overall)}
              r={i === n - 1 ? 6 : 4.5}
              fill={p.provider === 'gemini' ? '#4f46e5' : '#94a3b8'}
              stroke="#fff"
              strokeWidth="2"
            >
              <title>{`${fmtDateTime(p.created_at)}: ${fmtScore(p.overall)}/10 (${(PROVIDER[p.provider] || PROVIDER.rules).label})`}</title>
            </circle>
          ))}
          <text x={x(n - 1)} y={y(last.overall) - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#312e81">
            {fmtScore(last.overall)}
          </text>
          <text x={x(0)} y={H - 8} textAnchor={n === 1 ? 'middle' : 'start'} fontSize="11" fill="#94a3b8">
            {shortDate(points[0].created_at)}
          </text>
          {n > 1 && (
            <text x={x(n - 1)} y={H - 8} textAnchor="end" fontSize="11" fill="#94a3b8">
              {shortDate(last.created_at)}
            </text>
          )}
        </svg>
      )}
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
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

const SectionSkeleton = () => <div className="skeleton h-40" aria-busy="true" aria-label="Đang tải" />

export default function Coach() {
  const toast = useToast()
  const [kind, setKind] = useState('writing')
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const resultRef = useRef(null)
  const history = useAsync(() => api.get('/coach/history?limit=10'), [])
  const progress = useAsync(() => api.get('/coach/progress?limit=30'), [])

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  const chars = text.trim().length
  const words = chars ? text.trim().split(/\s+/).length : 0
  const tooShort = chars < MIN_CHARS

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setResult(await api.post('/coach/feedback', { kind, text }))
      toast.success('Đã chấm xong bài của bạn.')
      history.reload()
      progress.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const points = progress.data?.points || []
  const items = history.data || []

  return (
    <>
      <PageTitle title="AI Coach" subtitle="Chấm bài viết hoặc bài nói tiếng Anh của bạn theo từng tiêu chí." />

      <form onSubmit={submit} className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Loại bài"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'writing', label: 'Bài viết', icon: PenLine },
              { value: 'speaking', label: 'Bài nói', icon: Mic },
            ]}
          />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
            onClick={() => setText(SAMPLE_TEXT)}
            disabled={busy}
          >
            <WandSparkles className="h-4 w-4" />
            Dùng bài mẫu để thử
          </button>
        </div>

        <div>
          <label htmlFor="coach-text" className="mb-1.5 block text-sm font-medium text-slate-700">
            {kind === 'writing' ? 'Bài viết của bạn' : 'Nội dung bài nói (dạng văn bản)'}
          </label>
          <textarea
            id="coach-text"
            className="input min-h-48"
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={MIN_CHARS}
            maxLength={MAX_CHARS}
            placeholder={
              kind === 'writing'
                ? 'Viết hoặc dán bài tiếng Anh của bạn vào đây…'
                : 'Gõ lại hoặc dán nội dung bài nói của bạn vào đây…'
            }
            disabled={busy}
            required
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="tabular-nums text-slate-500">
              {words} từ · {text.length}/{MAX_CHARS} ký tự
            </span>
            <span className={tooShort ? 'text-amber-600' : 'text-emerald-600'}>
              {tooShort ? `Cần thêm ${MIN_CHARS - chars} ký tự nữa` : 'Đủ độ dài để chấm'}
            </span>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Nếu hệ thống bật Gemini, bài của bạn sẽ được gửi tới Google để chấm. Đừng dán thông tin cá nhân (họ tên, số điện
          thoại, địa chỉ) vào bài.
        </p>
        <ErrorBox message={error} />
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy || tooShort}>
            {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Đang chấm…' : 'Chấm bài'}
          </button>
        </div>
      </form>

      {(busy || result) && (
        <div ref={resultRef} className="card mt-5 scroll-mt-20 animate-pop-in">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Kết quả chấm bài</h2>
            {!busy && result && (
              <div className="flex items-center gap-2">
                <Badge tone={(PROVIDER[result.provider] || PROVIDER.rules).tone}>
                  {(PROVIDER[result.provider] || PROVIDER.rules).label}
                </Badge>
                <span className="text-xs text-slate-400">{fmtDateTime(result.created_at)}</span>
              </div>
            )}
          </div>
          {busy ? <GradingSkeleton /> : <Result item={result} />}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Tiến bộ của bạn</h2>
        {progress.loading ? (
          <SectionSkeleton />
        ) : progress.error ? (
          <ErrorBox message={progress.error} />
        ) : points.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Chưa có lượt chấm nào có điểm">
            Hãy nộp bài đầu tiên để bắt đầu theo dõi tiến bộ.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={MessageSquareText} tone="indigo" label="Số lượt chấm" value={points.length} />
              <StatCard icon={TrendingUp} tone="sky" label="Điểm trung bình" value={fmtScore(progress.data.average)} hint="Thang điểm 10" />
              <StatCard icon={Trophy} tone="amber" label="Điểm cao nhất" value={fmtScore(progress.data.best)} hint="Thang điểm 10" />
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
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Lịch sử gần đây</h2>
        {history.loading ? (
          <div className="space-y-2">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
        ) : history.error ? (
          <ErrorBox message={history.error} />
        ) : items.length === 0 ? (
          <EmptyState icon={MessageSquareText} title="Chưa có lượt chấm nào">
            Các bài bạn đã nộp sẽ hiện ở đây để xem lại.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {items.map((h) => {
              const provider = PROVIDER[h.provider] || PROVIDER.rules
              return (
                <details key={h.id} className="group card overflow-hidden !p-0">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      {h.kind === 'writing' ? <PenLine className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">
                        {h.kind === 'writing' ? 'Bài viết' : 'Bài nói'}
                      </span>
                      <span className="block text-xs text-slate-500">{fmtDateTime(h.created_at)}</span>
                    </span>
                    <span className="hidden sm:block">
                      <Badge tone={provider.tone}>{provider.label}</Badge>
                    </span>
                    {h.overall !== null && h.overall !== undefined && <ScoreChip value={h.overall} />}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-t border-slate-100 px-4 py-4">
                    <Result item={h} />
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
