// @ts-nocheck
import React from 'react'
import { LucideIcon, Plus } from 'lucide-react'

export type StatChip = { label: string; value: number | string; tone?: 'default' | 'amber' | 'sky' | 'emerald' | 'violet' | 'rose' }

const toneClasses: Record<NonNullable<StatChip['tone']>, string> = {
  default: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-700/50 dark:text-slate-200 dark:ring-slate-600',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
}

export interface ListPageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  iconGradient?: string
  addLabel?: string
  onAdd?: () => void
  stats?: StatChip[]
  rightExtra?: React.ReactNode
}

export default function ListPageHeader({
  icon: Icon,
  title,
  subtitle,
  iconGradient = 'from-sky-500 to-indigo-500',
  addLabel,
  onAdd,
  stats,
  rightExtra,
}: ListPageHeaderProps){
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${iconGradient} text-white flex items-center justify-center shadow-sm`}>
          <Icon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {stats && stats.length > 0 && (
          <div className="hidden sm:flex items-center gap-2">
            {stats.map((s, i) => (
              <div key={i} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ${toneClasses[s.tone ?? 'default']} shadow-sm`}>
                <span className="text-xs font-medium opacity-80">{s.label}</span>
                <span className="text-sm font-semibold tabular-nums">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</span>
              </div>
            ))}
          </div>
        )}
        {rightExtra}
        {onAdd && addLabel && (
          <button
            aria-label={addLabel}
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <Plus size={16} />
            <span>{addLabel}</span>
          </button>
        )}
      </div>
    </div>
  )
}
