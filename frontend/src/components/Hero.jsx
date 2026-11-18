import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, GraduationCap } from 'lucide-react'

// Banner đầu trang nền pastel chuyển màu, chữ tối nên rất dễ đọc.
//  - chips: [[Icon, 'chữ'], ...] hiện dưới tiêu đề; action: nút hành động (xem HeroLink)
//  - compact: bản gọn cho trang chi tiết (có back, lead là biểu tượng đứng trước tiêu đề, action nằm bên phải)
export default function Hero({ eyebrow, title, subtitle, chips = [], action, docTitle, compact = false, back, lead }) {
  useEffect(() => {
    if (docTitle) document.title = `${docTitle} · EduCenter`
  }, [docTitle])

  const chipRow = chips.length > 0 && (
    <div className={`flex flex-wrap items-center gap-2.5 ${compact ? 'mt-4' : 'mt-5'}`}>
      {chips.map(([Icon, text]) => (
        <span
          key={text}
          className={`glass inline-flex items-center gap-2 rounded-full font-medium text-slate-700 ${
            compact ? 'px-3 py-1 text-xs sm:text-sm' : 'px-3.5 py-1.5 text-sm'
          }`}
        >
          <Icon className="h-4 w-4 text-brand-700" />
          {text}
        </span>
      ))}
      {!compact && action}
    </div>
  )

  return (
    <section
      className={`relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-100 via-accent-100 to-brand-50 text-slate-900 shadow-[0_18px_44px_-22px_rgb(var(--brand-600)/0.4)] ring-1 ring-inset ring-brand-200/80 ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-white/60 blur-2xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-accent-200/70 blur-3xl" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.3] [background-image:radial-gradient(circle,rgb(var(--brand-400))_1px,transparent_1px)] [background-size:22px_22px] [-webkit-mask-image:linear-gradient(to_left,black,transparent_65%)] [mask-image:linear-gradient(to_left,black,transparent_65%)]"
        aria-hidden="true"
      />
      {!compact && (
        <GraduationCap
          className="pointer-events-none absolute -bottom-8 right-8 hidden h-52 w-52 -rotate-12 text-white/60 sm:block"
          strokeWidth={1.2}
          aria-hidden="true"
        />
      )}

      <div className="relative">
        {back && (
          <Link
            to={back.to}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition hover:text-brand-900"
          >
            <ChevronLeft className="h-4 w-4" />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {lead}
            <div className="min-w-0 max-w-2xl">
              {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</div>}
              <h1
                className={`text-balance font-display font-extrabold leading-tight tracking-tight text-slate-900 ${
                  compact ? 'text-2xl sm:text-3xl' : 'text-[28px] sm:text-4xl'
                }`}
              >
                {title}
              </h1>
              {subtitle && <p className={`mt-1.5 max-w-xl text-slate-700 ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>{subtitle}</p>}
            </div>
          </div>
          {compact && action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
        {chipRow}
      </div>
    </section>
  )
}

export function HeroLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition hover:bg-brand-800"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
