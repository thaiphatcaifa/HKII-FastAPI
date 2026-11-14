import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Sparkles,
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

// Mỗi vai trò một danh sách nhóm: [tên nhóm (null: không có tiêu đề), các mục]
const NAV = {
  admin: [
    [null, [HOME]],
    ['Quản lý', [CLASSES, USERS, TUITION]],
    ['Học tập', [COACH]],
    ['Cá nhân', [ACCOUNT]],
  ],
  teacher: [
    [null, [HOME]],
    ['Giảng dạy', [CLASSES, COACH]],
    ['Cá nhân', [ACCOUNT]],
  ],
  student: [
    [null, [HOME]],
    ['Học tập', [ATT, GRADES, COACH]],
    ['Tài chính', [TUITION]],
    ['Cá nhân', [ACCOUNT]],
  ],
  parent: [
    [null, [HOME]],
    ['Theo dõi con', [ATT, GRADES, TUITION]],
    ['Cá nhân', [ACCOUNT]],
  ],
}

const TODAY = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const groups = NAV[user.role] || NAV.student
  const canCoach = groups.some(([, items]) => items.includes(COACH))
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden bg-slate-950 text-slate-300 transition-[transform,visibility] duration-200 md:visible md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${
          open ? 'visible translate-x-0 shadow-2xl' : 'invisible -translate-x-full'
        }`}
      >
        {/* Nền chuyển màu và hai quầng sáng mờ */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1026] via-[#10173a] to-[#1a1858]" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center justify-between gap-3 px-5 py-5 md:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 font-display text-lg font-extrabold text-white shadow-lg shadow-indigo-500/40 ring-1 ring-white/20">
              H
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-extrabold tracking-tight text-white">HKII</div>
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

        <nav className="relative flex-1 overflow-y-auto px-3 pb-4" aria-label="Điều hướng chính">
          {groups.map(([title, items]) => (
            <div key={title || 'main'} className="space-y-1">
              {title && (
                <div className="px-3.5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
              )}
              {items.map(([to, label, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-gradient-to-b before:from-indigo-300 before:to-violet-400 before:transition-opacity ${
                      isActive
                        ? 'bg-white/10 text-white shadow-inner ring-1 ring-inset ring-white/10 before:opacity-100'
                        : 'text-slate-400 before:opacity-0 hover:bg-white/5 hover:text-white'
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
            </div>
          ))}
        </nav>

        {canCoach && !location.pathname.startsWith('/coach') && (
          <div className="relative px-3 pb-3">
            <Link
              to="/coach"
              className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-4 text-white shadow-lg shadow-indigo-950/50 ring-1 ring-white/20 transition hover:brightness-110"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-8 right-6 h-16 w-16 rounded-full bg-white/10" aria-hidden="true" />
              <Sparkles className="relative h-5 w-5" />
              <div className="relative mt-2 font-display text-sm font-bold">Luyện cùng AI Coach</div>
              <div className="relative mt-0.5 text-xs leading-snug text-indigo-100">Chấm bài viết, bài nói theo từng tiêu chí.</div>
              <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}

        <div className="relative border-t border-white/5 px-5 py-4 text-xs text-slate-400">FastAPI · PostgreSQL · Docker</div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6">
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
          <span className="font-display text-base font-extrabold tracking-tight text-slate-900 md:hidden">HKII</span>
          <div className="hidden items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200/70 md:flex">
            <CalendarDays className="h-4 w-4 text-indigo-500" />
            {TODAY.format(new Date())}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-full bg-white py-1 pl-1 pr-4 shadow-sm ring-1 ring-slate-200/70 max-sm:pr-1">
              <Avatar name={user.full_name} />
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-sm font-semibold text-slate-900">{user.full_name}</div>
                <div className="text-xs font-medium text-indigo-600">{ROLE_LABEL[user.role]}</div>
              </div>
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
