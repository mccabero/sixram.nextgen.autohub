// @ts-nocheck
import React from 'react'

export interface ListToolbarProps {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export default function ListToolbar({ left, right, className = '' }: ListToolbarProps){
  return (
    <div className={`px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-3">{right}</div>
    </div>
  )
}
