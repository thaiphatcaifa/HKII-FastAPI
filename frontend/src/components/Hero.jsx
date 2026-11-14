import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, GraduationCap } from 'lucide-react'

// Banner đầu trang nền chuyển màu.
//  - chips: [[Icon, 'chữ'], ...] hiện dưới tiêu đề; action: nút hành động (xem HeroLink)
//  - compact: bản gọn cho trang chi tiết (có back, lead là biểu tượng đứng trước tiêu đề, action nằm bên phải)
export default function Hero({ eyebrow, title, subtitle, chips = [], action, docTitle, compact = false, back, lead }) {
  useEffect(() => {
    if (docTitle) document.title = `${docTitle} · HKII`
  }, [docTitle])

  const chipRow = chips.length > 0 && (
    <div className={`flex flex-wrap items-center gap-2.5 ${compact ? 'mt-4' : 'mt-5'}`}>
      {chips.map(([Icon, text]) => (
        <span
          key={text}
          className={`glass inline-flex items-center gap-2 rounded-full font-medium ${compact ? 'px-3 py-1 text-xs sm:text-sm' : 'px-3.5 py-1.5 text-sm'}`}
        >
          <Icon className="h-4 w-4" />
          {text}
        </span>
      ))}
      {!compact && action}
    </div>
  )

  return (
    <section
      className={`relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white shadow-glow ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/25 blur-3xl" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:22px_22px] [-webkit-mask-image:linear-gradient(to_left,black,transparent_65%)] [mask-image:linear-gradient(to_left,black,transparent_65%)]"
        aria-hidden="true"
      />
      {!compact && (
        <GraduationCap
          className="pointer-events-none absolute -bottom-8 right-8 hidden h-52 w-52 -rotate-12 text-white/10 sm:block"
          strokeWidth={1.2}
          aria-hidden="true"
        />
      )}

      <div className="relative">
        {back && (
          <Link
            to={back.to}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-100 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {lead}
            <div className="min-w-0 max-w-2xl">
              {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-100">{eyebrow}</div>}
              <h1
                className={`text-balance font-display font-extrabold leading-tight tracking-tight ${
                  compact ? 'text-2xl sm:text-3xl' : 'text-[28px] sm:text-4xl'
                }`}
              >
                {title}
              </h1>
              {subtitle && <p className={`mt-1.5 max-w-xl text-indigo-100 ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>{subtitle}</p>}
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
      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-md shadow-indigo-900/20 transition hover:bg-indigo-50"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}
