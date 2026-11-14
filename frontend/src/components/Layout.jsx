import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bot,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../auth'
import ErrorBoundary from './ErrorBoundary'
import { Avatar } from './ui'

const HOME = ['/', 'Tổng quan', LayoutDashboard]
const CLASSES = ['/classes', 'Lớp học', School]
const USERS = ['/users', 'Người dùng', Users]
const TUITION = ['/tuition', 'Học phí', Wallet]
const COACH = ['/coach', 'AI Coach', Bot]
const ATT = ['/attendance', 'Chuyên cần', CalendarCheck]
const GRADES = ['/grades', 'Điểm số', GraduationCap]
const ACCOUNT = ['/account', 'Tài khoản', KeyRound]

const NAV = {
  admin: [HOME, CLASSES, USERS, TUITION, COACH, ACCOUNT],
  teacher: [HOME, CLASSES, COACH, ACCOUNT],
  student: [HOME, ATT, GRADES, TUITION, COACH, ACCOUNT],
  parent: [HOME, ATT, GRADES, TUITION, ACCOUNT],
}

const TODAY = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const items = NAV[user.role] || NAV.student
  const [open, setOpen] = useState(false) // ngăn kéo điều hướng trên màn hình nhỏ

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [open])

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Bỏ qua điều hướng
      </a>

      {open && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-slate-900/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-[transform,visibility] duration-200 md:visible md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${
          open ? 'visible translate-x-0 shadow-2xl' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-5 md:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-extrabold text-white shadow-lg shadow-indigo-900/40">
              H
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold text-white">HKII</div>
              <div className="text-xs text-slate-400">Quản lý trung tâm</div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4" aria-label="Điều hướng chính">
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-indigo-300' : ''}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/5 px-5 py-4 text-xs text-slate-500">FastAPI · PostgreSQL · Docker</div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2 md:hidden"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-bold text-slate-900 md:hidden">HKII</span>
          <div className="hidden items-center gap-2 text-sm text-slate-500 md:flex">
            <CalendarDays className="h-4 w-4" />
            {TODAY.format(new Date())}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Avatar name={user.full_name} />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold text-slate-900">{user.full_name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
            </div>
            <button className="btn-ghost btn-sm" onClick={logout} aria-label="Đăng xuất">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl p-4 outline-none sm:p-6 lg:p-8">
          <ErrorBoundary key={location.pathname}>
            <div className="animate-slide-up">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
