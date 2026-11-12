import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useState, useEffect, useRef } from 'react';

import { Activity, BookOpen, User, LayoutDashboard, Menu, X, LogOut, Timer, CalendarDays, LineChart, BookHeart } from 'lucide-react';
import { useWorkingSession } from '@/services/WorkingSession';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', label: 'Сегодня', icon: LayoutDashboard },
  { name: 'WorkoutPlan', label: 'Мой план', icon: CalendarDays },
  { name: 'PainDiary', label: 'Дневник боли', icon: BookHeart },
  { name: 'Analytics', label: 'Прогресс', icon: LineChart },
  { name: 'Articles', label: 'Полезное', icon: BookOpen },
];
const secondaryItems = [
  { name: 'Timer', label: 'Работа и перерывы', icon: Timer },
  { name: 'ExerciseLibrary', label: 'Библиотека упражнений', icon: Activity },
  { name: 'Profile', label: 'Профиль и настройки', icon: User },
];

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const work = useWorkingSession();
  const sidebarRef=useRef(null);const contentRef=useRef(null);const menuRef=useRef(null);const wasOpen=useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 1023px)').matches);
  useEffect(()=>{if(sidebarRef.current)sidebarRef.current.inert=compact&&!sidebarOpen;if(contentRef.current)contentRef.current.inert=compact&&sidebarOpen;if(compact&&sidebarOpen)sidebarRef.current?.querySelector('button')?.focus();else if(compact&&wasOpen.current)menuRef.current?.focus();wasOpen.current=sidebarOpen;},[compact,sidebarOpen]);
  useEffect(()=>{const media=window.matchMedia('(max-width: 1023px)');const update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPageName]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event) => { if (event.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [sidebarOpen]);

  const displayName=user?.full_name?.trim()||user?.email||'Пользователь';
  const initial=(user?.full_name?.[0]||user?.email?.[0]||'П').toUpperCase();
  const profileTarget=user?.role==='admin'?'/admin':'/Profile';
  const UserBadge=({mobile=false})=>user&&<Link to={profileTarget} aria-label={`Профиль: ${displayName}`} className={cn('no-print flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors',mobile?'ml-auto p-1.5 max-w-[48%]':'px-3 py-2')}>
    <span className={cn('rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold flex-shrink-0',mobile?'w-7 h-7 text-xs':'w-9 h-9 text-sm')}>{initial}</span>
    <span className="min-w-0 text-left"><span className="block text-sm font-bold text-slate-800 truncate">{displayName}</span>{!mobile&&<span className="block text-xs text-slate-500">{user.role==='admin'?'Администратор':'Пользователь'} · профиль</span>}</span>
  </Link>;

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img src="/balance-icon.svg" alt="" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-200" />
          <div>
            <h1 className="font-bold text-slate-900 text-sm tracking-tight">Balance</h1>
            <p className="text-xs text-slate-400">Баланс работы и самочувствия</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {(user?.role==='admin'?[{name:'admin',label:'Управление',icon:LayoutDashboard}]:[...navItems, ...secondaryItems]).map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPageName === item.name;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.name)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                index === navItems.length && 'border-t border-slate-100 mt-4',
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-200/50'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {(user.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{user.full_name || user.email}</p>
              <button
                onClick={async()=>{if(work?.session&&work.session.state!=='finished')await work.commit('finished');await logout();}}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mt-0.5"
              >
                <LogOut className="w-3 h-3" /> Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (currentPageName === 'Onboarding') return <main className="min-h-screen bg-slate-50 p-4 lg:p-8">{children}</main>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-cyan-50/10 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-hidden={compact && !sidebarOpen}
        ref={sidebarRef}
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0 lg:shadow-none lg:border-r lg:border-slate-100'
        )}
      >
        <button aria-label="Закрыть меню" className="lg:hidden absolute right-3 top-3 p-2" onClick={() => setSidebarOpen(false)}><X className="w-4 h-4" /></button>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div ref={contentRef} className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden lg:flex min-h-[72px] items-center justify-end border-b border-slate-100 bg-white/80 backdrop-blur-sm px-8">
          <UserBadge />
        </header>
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center gap-4">
          <button
            aria-label={sidebarOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={sidebarOpen}
            ref={menuRef}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/balance-icon.svg" alt="" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-slate-900 text-sm">Balance</span>
          </div>
          <UserBadge mobile />
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {user?.role!=='admin'&&work?.session&&work.session.state!=='finished'&&currentPageName!=='Timer'&&<Link to="/Timer" className="no-print block max-w-5xl mx-auto mb-5 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{work.due?'Время перерыва':work.session.state==='paused'?'Работа на паузе':'Таймер работы запущен'} · Открыть →</Link>}
          {children}
        </main>
      </div>

      <style>{`
        :root {
          --primary-light: #eef2ff;
        }
        * { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
