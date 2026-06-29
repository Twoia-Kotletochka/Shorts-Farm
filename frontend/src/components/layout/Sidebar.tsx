import { NavLink } from 'react-router-dom'
import { Clapperboard } from 'lucide-react'
import { NAV_ITEMS } from '@/app/nav'
import { IS_MOCK } from '@/api/http'
import { cn } from '@/lib/cn'

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-bg-elev">
      {/* Лого */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Clapperboard className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-content">Shorts Farm</div>
          <div className="text-xs text-content-faint">ферма шортсов</div>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/12 text-primary'
                  : 'text-content-muted hover:bg-surface-2 hover:text-content',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Футер: индикатор режима данных */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
          <span
            className={cn('h-2 w-2 rounded-full', IS_MOCK ? 'bg-warning' : 'bg-success')}
          />
          <span className="text-content-muted">
            {IS_MOCK ? 'Демо-данные (MSW)' : 'Живой API'}
          </span>
        </div>
      </div>
    </aside>
  )
}
