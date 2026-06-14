// @ts-nocheck
import React from 'react'

export interface ClientTypeBadgeProps {
  type: string | undefined | null
}

export default function ClientTypeBadge({ type }: ClientTypeBadgeProps){
  const t = (type || '').toString().toUpperCase()
  const isChangan = t === 'CHANGAN'
  const isBosch = t === 'BOSCH' || t === 'GOLDEN WRENCH'
  if (isChangan){
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        CHANGAN
      </span>
    )
  }
  if (isBosch){
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        BOSCH
      </span>
    )
  }
  // BOSCH or default
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {t || 'BOSCH'}
    </span>
  )
}
