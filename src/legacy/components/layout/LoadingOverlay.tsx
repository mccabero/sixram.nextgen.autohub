// @ts-nocheck
import React from 'react'
import { useLoading } from '../../contexts/loading'

export default function LoadingOverlay(){
  const { loading } = useLoading()
  if (!loading) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-4 bg-white dark:bg-slate-800 rounded-lg px-6 py-6 shadow-lg">
        <div className="p-2 rounded-full bg-transparent">
          <div className="animate-spin h-8 w-8 border-4 border-slate-200 dark:border-slate-700 border-t-emerald-500 rounded-full" />
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-200">Loading…</div>
      </div>
    </div>
  )
}
