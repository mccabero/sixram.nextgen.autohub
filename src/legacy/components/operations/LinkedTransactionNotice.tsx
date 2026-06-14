// @ts-nocheck
import React from 'react'
import { ExternalLink, Link2 } from 'lucide-react'

type LinkedTransactionNoticeProps = {
  label: string
  referenceNo?: string
  hint?: string
  onOpen: () => void
}

export default function LinkedTransactionNotice({
  label,
  referenceNo,
  hint,
  onOpen,
}: LinkedTransactionNoticeProps) {
  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-200">
            <Link2 size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label}</div>
            <div className="truncate text-sm font-semibold text-emerald-950">
              {referenceNo || 'Linked transaction'}
            </div>
            {hint && <div className="text-xs text-emerald-700">{hint}</div>}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
        >
          Open <ExternalLink size={13} />
        </button>
      </div>
    </div>
  )
}
