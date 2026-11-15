import { useState } from 'react'
import { Check } from 'lucide-react'
import { THEMES, getTheme, setTheme } from '../theme'

// Chọn bảng màu giao diện; đổi ngay và được lưu trên trình duyệt này.
export default function ThemePicker() {
  const [current, setCurrent] = useState(getTheme)
  const choose = (id) => {
    setTheme(id)
    setCurrent(id)
  }

  return (
    <section className="card">
      <h2 className="text-base font-semibold text-slate-900">Giao diện</h2>
      <p className="mt-1 text-sm text-slate-500">Chọn bảng màu bạn thấy dễ chịu nhất. Lựa chọn được lưu trên trình duyệt này.</p>
      <div role="radiogroup" aria-label="Bảng màu giao diện" className="mt-4 grid gap-3">
        {THEMES.map((t) => {
          const on = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(t.id)}
              className={`flex items-center gap-4 rounded-2xl border p-3.5 text-left transition ${
                on ? 'border-brand-400 bg-brand-50/70 ring-2 ring-brand-200' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="flex -space-x-2" aria-hidden="true">
                {t.swatch.map((c) => (
                  <span key={c} className="h-8 w-8 rounded-full ring-2 ring-white" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.hint}</span>
              </span>
              {on && <Check className="h-5 w-5 shrink-0 text-brand-700" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
