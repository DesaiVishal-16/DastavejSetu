'use client';

import {
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';

interface DashboardSidebarProps {
  activePath: 'dashboard' | 'upload' | 'history' | 'settings';
}

export function DashboardSidebar({ activePath }: DashboardSidebarProps) {
  const { t } = useLanguage();
  const { logout } = useAuth();

  const navItems = [
    {
      href: '/dashboard',
      icon: LayoutDashboard,
      label: t.sidebar.dashboard,
      key: 'dashboard',
    },
    {
      href: '/dashboard/upload',
      icon: Upload,
      label: t.sidebar.upload,
      key: 'upload',
    },
    {
      href: '/dashboard/history',
      icon: History,
      label: t.sidebar.history,
      key: 'history',
    },
    {
      href: '/dashboard/settings',
      icon: Settings,
      label: t.sidebar.settings,
      key: 'settings',
    },
  ];

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white dark:border-[#27272a] dark:bg-[#18181b]">
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-6 dark:border-[#27272a]">
        <img
          src="/logo.png"
          alt="DastavejSetu Logo"
          className="h-10 w-10 object-contain"
        />
        <span className="text-lg font-semibold text-slate-900 dark:text-white">
          DastavejSetu
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
              activePath === item.key
                ? 'bg-[#124AB9]/10 text-[#124AB9] dark:bg-[#27272a] dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-[#27272a] dark:hover:text-white'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-200 p-4 dark:border-[#27272a]">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-[#27272a] dark:hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">{t.sidebar.logout}</span>
        </button>
      </div>
    </aside>
  );
}
