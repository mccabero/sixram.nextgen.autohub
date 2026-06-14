// @ts-nocheck
import React from 'react'
import { Filter } from 'lucide-react'

export type FilterKey = string

export interface FilterOption<K extends FilterKey = FilterKey> {
  key: K
  label: string
  count: number
  activeClass?: string
}

export interface ClientTypeFilterProps<K extends FilterKey = FilterKey> {
  value: K
  options: FilterOption<K>[]
  onChange: (key: K) => void
  label?: string
}

export default function ClientTypeFilter<K extends FilterKey = FilterKey>({
  value,
  options,
  onChange,
  label = 'Type',
}: ClientTypeFilterProps<K>){
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500 mr-1">
        <Filter size={14} /> <span>{label}</span>
      </div>
      <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700">
        {options.map(opt => {
          const active = value === opt.key
          const activeBadge = opt.activeClass ?? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          return (
            <button
              key={opt.key as string}
              type="button"
              onClick={() => onChange(opt.key)}
              className={
                'inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all ' +
                (active
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')
              }
            >
              <span>{opt.label}</span>
              <span
                className={
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold ' +
                  (active ? activeBadge : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300')
                }
              >
                {opt.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
