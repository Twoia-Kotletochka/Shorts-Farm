import {
  Captions,
  Clapperboard,
  LayoutDashboard,
  Library,
  ListChecks,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Дашборд', icon: LayoutDashboard, end: true },
  { path: '/library', label: 'Библиотека', icon: Library },
  { path: '/create', label: 'Создание шортсов', icon: Sparkles },
  { path: '/queue', label: 'Очередь', icon: ListChecks },
  { path: '/shorts', label: 'Готовые шортсы', icon: Clapperboard },
  { path: '/subtitles', label: 'Субтитры', icon: Captions },
  { path: '/settings', label: 'Настройки', icon: Settings },
]

export function titleForPath(pathname: string): string {
  if (pathname === '/') return 'Дашборд'
  const item = NAV_ITEMS.find((n) => n.path !== '/' && pathname.startsWith(n.path))
  return item?.label ?? 'Shorts Farm'
}
