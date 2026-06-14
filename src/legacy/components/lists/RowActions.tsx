// @ts-nocheck
import React from 'react'
import { Ban, Copy, Edit3, Trash2, Printer, Eye, LucideIcon } from 'lucide-react'
import { useCanDeletePermission } from '../../hooks/useCanDeletePermission'
import { useCanVoidPermission } from '../../hooks/useCanVoidPermission'

type ActionKind = 'edit' | 'delete' | 'print' | 'view' | 'duplicate' | 'void'

const toneByKind: Record<ActionKind, string> = {
  edit: 'hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-300 dark:hover:bg-violet-500/10',
  delete: 'hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-500/10',
  print: 'hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-100 dark:hover:bg-slate-700/60',
  view: 'hover:text-sky-600 hover:bg-sky-50 dark:hover:text-sky-300 dark:hover:bg-sky-500/10',
  duplicate: 'hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10',
  void: 'hover:text-rose-700 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-500/10',
}

const iconByKind: Record<ActionKind, LucideIcon> = {
  edit: Edit3,
  delete: Trash2,
  print: Printer,
  view: Eye,
  duplicate: Copy,
  void: Ban,
}

export interface RowActionDef {
  kind: ActionKind
  onClick: () => void
  label?: string
  disabled?: boolean
}

export interface RowActionsProps {
  actions: RowActionDef[]
}

export default function RowActions({ actions }: RowActionsProps){
  const canDelete = useCanDeletePermission()
  const canVoid = useCanVoidPermission()
  const visibleActions = actions.filter(action =>
    (action.kind !== 'delete' || canDelete)
    && (action.kind !== 'void' || canVoid))

  if (visibleActions.length === 0) return null

  return (
    <div className="flex items-center gap-1 justify-end">
      {visibleActions.map((a, i) => {
        const Icon = iconByKind[a.kind]
        return (
          <button
            key={i}
            onClick={a.onClick}
            disabled={a.disabled}
            aria-label={a.label || a.kind}
            title={a.label || a.kind}
            className={
              'p-2 rounded-lg text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
              toneByKind[a.kind]
            }
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
