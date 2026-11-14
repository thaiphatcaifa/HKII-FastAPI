import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, CircleHelp, Info, TriangleAlert, X } from 'lucide-react'

// Thông báo nổi (toast) và hộp xác nhận dùng chung cho cả ứng dụng.
//   const toast = useToast();     toast.success('Đã lưu.');  toast.error('Lỗi ...')
//   const confirm = useConfirm(); if (await confirm({ title, message, tone: 'danger' })) { ... }
const UiContext = createContext(null)

const TOAST_TONES = {
  success: { icon: CircleCheck, color: 'text-emerald-500', role: 'status' },
  error: { icon: CircleAlert, color: 'text-rose-500', role: 'alert' },
  info: { icon: Info, color: 'text-sky-500', role: 'status' },
}

let nextToastId = 1

function Toast({ toast, onClose }) {
  const { icon: Icon, color, role } = TOAST_TONES[toast.tone]
  return (
    <div
      role={role}
      className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg ring-1 ring-black/5"
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
      <p className="min-w-0 flex-1 text-sm text-slate-700">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="-mr-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="Đóng thông báo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ConfirmDialog({ options, onAnswer }) {
  const { title = 'Xác nhận', message, confirmLabel = 'Đồng ý', cancelLabel = 'Hủy', tone = 'primary' } = options
  const danger = tone === 'danger'
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const okRef = useRef(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const previous = document.activeElement
    // Thao tác nguy hiểm: đặt tiêu điểm vào nút Hủy để Enter không xóa nhầm
    ;(danger ? cancelRef : okRef).current?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onAnswer(false)
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      // Giữ tiêu điểm trong hộp thoại
      const buttons = [...dialogRef.current.querySelectorAll('button:not([disabled])')]
      if (buttons.length === 0) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [danger, onAnswer])

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onAnswer(false)
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className="w-full max-w-md animate-pop-in rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {danger ? <TriangleAlert className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {message && (
              <p id={descId} className="mt-1 text-sm text-slate-600">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn-ghost" onClick={() => onAnswer(false)}>
            {cancelLabel}
          </button>
          <button ref={okRef} type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => onAnswer(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const timers = useRef(new Map())
  const pending = useRef(null)

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone, message, ms) => {
      if (!message) return
      const id = nextToastId++
      setToasts((list) => [...list.slice(-2), { id, tone, message }])
      timers.current.set(id, setTimeout(() => dismiss(id), ms))
    },
    [dismiss],
  )

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        pending.current?.resolve(false) // chỉ giữ một hộp xác nhận mở cùng lúc
        pending.current = { resolve }
        setDialog(options)
      }),
    [],
  )

  const answer = useCallback((value) => {
    const current = pending.current
    pending.current = null
    setDialog(null)
    current?.resolve(value)
  }, [])

  useEffect(() => {
    const live = timers.current
    return () => live.forEach((t) => clearTimeout(t))
  }, [])

  const value = useMemo(
    () => ({
      toast: {
        success: (message) => push('success', message, 4000),
        error: (message) => push('error', message, 7000),
        info: (message) => push('info', message, 4000),
      },
      confirm,
    }),
    [push, confirm],
  )

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
      {dialog && <ConfirmDialog options={dialog} onAnswer={answer} />}
    </UiContext.Provider>
  )
}

function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useToast / useConfirm phải được dùng bên trong <UiProvider>.')
  return ctx
}

export const useToast = () => useUi().toast
export const useConfirm = () => useUi().confirm
