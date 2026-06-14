// @ts-nocheck
import React from 'react'
import { Lock } from 'lucide-react'

export default function PriceEditLockedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      aria-label="Price locked: Can Edit Price permission required"
      title="Can Edit Price permission required"
      className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium leading-none text-amber-700 ${className}`}
    >
      <Lock size={10} aria-hidden="true" />
      Locked
    </span>
  )
}
