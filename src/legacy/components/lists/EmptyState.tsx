// @ts-nocheck
import React from 'react'
import { LucideIcon, Inbox } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  hint?: string
  colSpan?: number
}

export default function EmptyState({ icon: Icon = Inbox, title = 'No records found', hint = 'Try adjusting your filters or search term', colSpan }: EmptyStateProps){
  const content = (
    <div className="flex flex-col items-center gap-2 py-10">
      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <Icon size={22} className="text-slate-400" />
      </div>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  )
  if (typeof colSpan === 'number'){
    return (
      <tr>
        <td colSpan={colSpan} className="px-5 text-center">{content}</td>
      </tr>
    )
  }
  return <div className="text-center text-slate-500 dark:text-slate-400">{content}</div>
}
