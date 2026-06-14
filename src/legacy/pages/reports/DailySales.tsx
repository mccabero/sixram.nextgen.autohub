// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { openDailySalesReportPdf } from '../../services/operationService'
import { claimRecentReportLaunch } from './reportLaunchGuard'

export default function DailySales() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [error, setError] = useState('')

  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''

  useEffect(() => {
    let active = true
    const launchKey = `daily-sales:${start}:${end}`

    if (!claimRecentReportLaunch(launchKey)) {
      return () => {
        active = false
      }
    }

    async function openPdf() {
      if (!start || !end) {
        setError('A report date is required to open the Daily Sales report.')
        return
      }

      if (start !== end) {
        setError('Daily Sales only supports a single report date.')
        return
      }

      try {
        await openDailySalesReportPdf(start, end)
        if (!active) return
        navigate('/reports', { replace: true })
      } catch (err: any) {
        if (!active) return
        const message = err?.message || 'Unable to open the Daily Sales report.'
        setError(message)
        showToast(message, 'error')
      }
    }

    void openPdf()
    return () => {
      active = false
    }
  }, [end, navigate, showToast, start])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div>
          <h1 className="text-lg font-semibold text-rose-900">Unable to open Daily Sales</h1>
          <p className="mt-2 text-sm">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-100"
        >
          <ArrowLeft size={16} />
          Back to Reports
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <Loader2 size={24} className="animate-spin text-bosch-blue" />
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Opening Daily Sales PDF</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The report is being generated in a new tab.
        </p>
      </div>
    </div>
  )
}
