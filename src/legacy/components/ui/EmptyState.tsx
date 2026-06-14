// @ts-nocheck
import React from 'react'

export default function EmptyState({ title, description }: { title: string, description?: string }){
  return (
    <div className="p-8 text-center text-slate-500">
      <div className="text-lg font-semibold mb-2">{title}</div>
      {description && <div className="text-sm">{description}</div>}
    </div>
  )
}
