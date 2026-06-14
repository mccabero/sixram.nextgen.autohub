// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { openInventoryCheckReportPdf } from '../../services/managementService'
import { claimRecentReportLaunch } from './reportLaunchGuard'

type InventoryCheckReportType = 'end-of-day' | 'month-end'

function normalizeType(value: string | null): InventoryCheckReportType {
  const normalized = String(value ?? 'end-of-day').trim().toLowerCase().replace(/[\s_]+/g, '-')
  return normalized === 'month-end' || normalized === 'monthend' || normalized === 'month' ? 'month-end' : 'end-of-day'
}

function titleForType(type: InventoryCheckReportType) {
  return type === 'month-end' ? 'Month End Inventory Check' : 'End of Day Inventory Check'
}

export default function InventoryCheck() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [error, setError] = useState('')

  const type = useMemo(() => normalizeType(searchParams.get('type')), [searchParams])
  const title = titleForType(type)
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''

  useEffect(() => {
    let active = true
    const launchKey = `inventory-check:${type}:${start}:${end}`

    if (!claimRecentReportLaunch(launchKey)) {
      return () => {
        active = false
      }
    }

    async function openPdf() {
      if (!start || !end) {
        setError('Start date and end date are required to open this inventory check report.')
        return
      }

      try {
        await openInventoryCheckReportPdf(type, start, end)
        if (!active) return
        navigate('/reports', { replace: true })
      } catch (err: any) {
        if (!active) return
        const message = err?.message || `Unable to open the ${title} report.`
        setError(message)
        showToast(message, 'error')
      }
    }

    void openPdf()
    return () => {
      active = false
    }
  }, [end, navigate, showToast, start, title, type])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div>
          <h1 className="text-lg font-semibold text-rose-900">Unable to open {title}</h1>
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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Opening {title} PDF</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The report is being generated in a new tab.
        </p>
      </div>
    </div>
  )
}
