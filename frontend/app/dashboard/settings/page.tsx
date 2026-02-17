'use client';

import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Globe,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';

import { useState } from 'react';

import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/auth-context';
import { Language, useLanguage } from '@/contexts/language-context';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout, isLoading } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);

  const isDark = theme === 'dark';

  // Get user initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Split name into first and last
  const getFirstName = (name: string) => name.split(' ')[0] || '';
  const getLastName = (name: string) =>
    name.split(' ').slice(1).join(' ') || '';

  const handleLanguageChange = (value: string) => {
    setLanguage(value as Language);
  };

  return (
    <div className="flex h-screen min-h-screen bg-slate-50 dark:bg-[#09090b]">
      <DashboardSidebar activePath="settings" />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8 dark:border-[#27272a] dark:bg-[#18181b]">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#124AB9] dark:text-zinc-400"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.settings.backToDashboard}
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8 border-2 border-[#124AB9]/20">
                  <AvatarFallback className="bg-linear-to-br from-[#124AB9] to-[#0d3a94] font-semibold text-white">
                    {user ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t.common.myAccount}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t.common.profile}</DropdownMenuItem>
              <DropdownMenuItem>{t.common.settings}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  onClick={logout}
                  className="flex w-full cursor-pointer items-center"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.common.logout}
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Settings Content */}
        <div className="space-y-6 p-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {t.settings.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {t.settings.subtitle}
            </p>
          </div>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                {t.settings.appearance}
              </CardTitle>
              <CardDescription>{t.settings.appearanceDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="dark-mode" className="text-base font-medium">
                    {t.settings.darkMode}
                  </Label>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {t.settings.darkModeDesc}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Sun className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                  <Switch
                    id="dark-mode"
                    checked={isDark}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? 'dark' : 'light')
                    }
                    className="data-[state=checked]:bg-[#124AB9]"
                  />
                  <Moon className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t.settings.languageRegion}
              </CardTitle>
              <CardDescription>{t.settings.languageRegionDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language Selection */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">
                    {t.settings.language}
                  </Label>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {t.settings.languageDesc}
                  </p>
                </div>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hindi">हिंदी (Hindi)</SelectItem>
                    <SelectItem value="marathi">मराठी (Marathi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t.settings.notifications}
              </CardTitle>
              <CardDescription>{t.settings.notificationsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label
                    htmlFor="email-notifications"
                    className="text-base font-medium"
                  >
                    {t.settings.emailNotifications}
                  </Label>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {t.settings.emailNotificationsDesc}
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  className="data-[state=checked]:bg-[#124AB9]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t.settings.profile}
              </CardTitle>
              <CardDescription>{t.settings.profileDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-[#124AB9]/20">
                  <AvatarFallback className="bg-linear-to-br from-[#124AB9] to-[#0d3a94] text-xl font-semibold text-white">
                    {user ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    {t.settings.changeAvatar}
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">{t.settings.firstName}</Label>
                  <Input
                    id="first-name"
                    defaultValue={user ? getFirstName(user.name) : ''}
                    placeholder={isLoading ? 'Loading...' : 'Enter first name'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">{t.settings.lastName}</Label>
                  <Input
                    id="last-name"
                    defaultValue={user ? getLastName(user.name) : ''}
                    placeholder={isLoading ? 'Loading...' : 'Enter last name'}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">{t.settings.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email || ''}
                    placeholder={isLoading ? 'Loading...' : 'Enter email'}
                  />
                </div>
              </div>
              <Button className="bg-[#124AB9] hover:bg-[#0d3a94]">
                {t.settings.saveChanges}
              </Button>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t.settings.security}
              </CardTitle>
              <CardDescription>{t.settings.securityDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{t.settings.twoFactorAuth}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {t.settings.twoFactorAuthDesc}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  {t.settings.enable}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{t.settings.changePassword}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {t.settings.changePasswordDesc}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  {t.settings.update}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
