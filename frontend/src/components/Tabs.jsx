import { useRef } from 'react'

// Thanh tab dùng được bằng bàn phím (mũi tên trái/phải, Home, End).
// tabs: [{ key, label, icon?, count? }]
export default function Tabs({ tabs, value, onChange, label, idPrefix = 'tab' }) {
  const refs = useRef({})

  const onKeyDown = (e) => {
    const index = tabs.findIndex((t) => t.key === value)
    let next = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].key)
    refs.current[tabs[next].key]?.focus()
  }

  return (
    <div className="mb-6 max-w-full overflow-x-auto pb-1">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="inline-flex gap-1 rounded-xl bg-slate-200/60 p-1"
      >
        {tabs.map(({ key, label: text, icon: Icon, count }) => {
          const on = value === key
          return (
            <button
              key={key}
              ref={(el) => {
                refs.current[key] = el
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-${key}`}
              aria-selected={on}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(key)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                on ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {text}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-xs font-bold tabular-nums ${
                    on ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-300/60 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
