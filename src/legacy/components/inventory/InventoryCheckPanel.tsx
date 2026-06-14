// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardCheck, FileText, Search } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import { useToast } from '../../contexts/toast'
import { createInventoryCheck, getInventoryChecks, openInventoryCheckReportPdf } from '../../services/managementService'
import { formatAmount, formatShortDate } from '../../utils/format'
import useDebouncedValue from '../../hooks/useDebouncedValue'

type InventoryCheckType = 'end-of-day' | 'month-end'

type InventoryProductRow = {
  id: number
  name: string
  partNo?: string
  storageLocation?: string
  stockOnHand: number
  productGroupName?: string
  unitOfMeasureName?: string
}

type InventoryCheckSummary = {
  id: number
  checkType: string
  checkDate: string
  notes?: string
  itemCount: number
  matchedCount: number
  surplusCount: number
  shortageCount: number
  systemQuantityTotal: number
  physicalQuantityTotal: number
  netVariance: number
}

const todayLocal = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

const currentMonth = todayLocal.slice(0, 7)

const currentMonthStart = `${currentMonth}-01`

function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!year || !monthNumber) return todayLocal
  const d = new Date(year, monthNumber, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizeCheckSummary(item: any): InventoryCheckSummary {
  return {
    id: Number(item?.id ?? item?.Id ?? 0),
    checkType: String(item?.checkType ?? item?.CheckType ?? ''),
    checkDate: String(item?.checkDate ?? item?.CheckDate ?? ''),
    notes: String(item?.notes ?? item?.Notes ?? ''),
    itemCount: Number(item?.itemCount ?? item?.ItemCount ?? 0),
    matchedCount: Number(item?.matchedCount ?? item?.MatchedCount ?? 0),
    surplusCount: Number(item?.surplusCount ?? item?.SurplusCount ?? 0),
    shortageCount: Number(item?.shortageCount ?? item?.ShortageCount ?? 0),
    systemQuantityTotal: Number(item?.systemQuantityTotal ?? item?.SystemQuantityTotal ?? 0),
    physicalQuantityTotal: Number(item?.physicalQuantityTotal ?? item?.PhysicalQuantityTotal ?? 0),
    netVariance: Number(item?.netVariance ?? item?.NetVariance ?? 0),
  }
}

function varianceClasses(value: number) {
  if (value > 0) return 'text-emerald-700 dark:text-emerald-300'
  if (value < 0) return 'text-rose-600 dark:text-rose-300'
  return 'text-slate-600 dark:text-slate-300'
}

function varianceLabel(value: number) {
  if (value > 0) return 'Surplus'
  if (value < 0) return 'Shortage'
  return 'Matched'
}

export default function InventoryCheckPanel({
  type,
  rows,
  onSaved,
}: {
  type: InventoryCheckType
  rows: InventoryProductRow[]
  onSaved: () => void
}) {
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const { showToast } = useToast()
  const isMonthEnd = type === 'month-end'
  const title = isMonthEnd ? 'Month End Inventory Check' : 'End of Day Inventory Check'
  const subtitle = isMonthEnd
    ? 'Save a month-end physical count snapshot against system on-hand.'
    : 'Save the daily physical count snapshot against system on-hand.'

  const [dateValue, setDateValue] = useState(isMonthEnd ? currentMonth : todayLocal)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [physicalByProductId, setPhysicalByProductId] = useState<Record<number, string>>({})
  const [notesByProductId, setNotesByProductId] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [loadingChecks, setLoadingChecks] = useState(false)
  const [recentChecks, setRecentChecks] = useState<InventoryCheckSummary[]>([])
  const [reportStart, setReportStart] = useState(currentMonthStart)
  const [reportEnd, setReportEnd] = useState(todayLocal)
  const [printing, setPrinting] = useState(false)

  const effectiveCheckDate = isMonthEnd ? lastDayOfMonth(dateValue) : dateValue

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      row.name.toLowerCase().includes(q)
      || String(row.partNo ?? '').toLowerCase().includes(q)
      || String(row.productGroupName ?? '').toLowerCase().includes(q)
      || String(row.storageLocation ?? '').toLowerCase().includes(q)
    )
  }, [rows, debouncedSearch])

  const totals = useMemo(() => {
    let counted = 0
    let matched = 0
    let surplus = 0
    let shortage = 0
    let netVariance = 0

    rows.forEach(row => {
      const raw = physicalByProductId[row.id]
      if (raw === undefined || raw === '') return
      const physical = Number(raw)
      if (!Number.isFinite(physical) || physical < 0) return
      counted += 1
      const variance = physical - row.stockOnHand
      netVariance += variance
      if (variance > 0) surplus += 1
      else if (variance < 0) shortage += 1
      else matched += 1
    })

    return { counted, matched, surplus, shortage, netVariance }
  }, [physicalByProductId, rows])

  async function loadChecks() {
    setLoadingChecks(true)
    try {
      const data: any = await getInventoryChecks({ type, page: 0, pageSize: 6 })
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.Items)
          ? data.Items
          : []
      setRecentChecks(items.map(normalizeCheckSummary))
    } catch {
      setRecentChecks([])
    } finally {
      setLoadingChecks(false)
    }
  }

  useEffect(() => {
    void loadChecks()
  }, [type])

  function fillSystemQuantities() {
    const next: Record<number, string> = {}
    rows.forEach(row => {
      next[row.id] = String(row.stockOnHand)
    })
    setPhysicalByProductId(next)
  }

  function clearCounts() {
    setPhysicalByProductId({})
    setNotesByProductId({})
  }

  async function saveCheck() {
    if (!rows.length) {
      showToast('No products are available for inventory checking.', 'error')
      return
    }

    const missing = rows.find(row => {
      const raw = physicalByProductId[row.id]
      const physical = Number(raw)
      return raw === undefined || raw === '' || !Number.isFinite(physical) || physical < 0
    })

    if (missing) {
      showToast(`Enter a valid physical count for ${missing.name}.`, 'error')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        checkType: type,
        checkDate: effectiveCheckDate,
        notes,
        items: rows.map(row => ({
          productId: row.id,
          physicalQuantity: Number(physicalByProductId[row.id]),
          notes: notesByProductId[row.id] ?? '',
        })),
      }

      if (typeof currentUserId === 'number') {
        body.createdById = currentUserId
        body.updatedById = currentUserId
      }

      const result: any = await createInventoryCheck(body)
      showToast(String(result?.message ?? result?.Message ?? `${title} saved.`), 'success')
      setNotes('')
      clearCounts()
      await loadChecks()
      onSaved()
    } catch (error: any) {
      showToast(error?.message || `Failed to save ${title.toLowerCase()}.`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function printReport(start = reportStart, end = reportEnd) {
    if (!start || !end) {
      showToast('Start date and end date are required to print this report.', 'error')
      return
    }
    setPrinting(true)
    try {
      await openInventoryCheckReportPdf(type, start, end)
    } catch (error: any) {
      showToast(error?.message || 'Unable to open the inventory check report.', 'error')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/30">
                  <ClipboardCheck size={18} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <span className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:ring-slate-700">Counted <b>{totals.counted}</b></span>
                <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">Matched <b>{totals.matched}</b></span>
                <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">Surplus <b>{totals.surplus}</b></span>
                <span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">Shortage <b>{totals.shortage}</b></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 px-5 py-5 lg:grid-cols-[220px_1fr]">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{isMonthEnd ? 'Month' : 'Check Date'}</label>
              <input
                type={isMonthEnd ? 'month' : 'date'}
                value={dateValue}
                onChange={event => setDateValue(event.target.value)}
                className="mt-2 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300 dark:border-slate-700 dark:bg-slate-900"
              />
              {isMonthEnd && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saved as {formatShortDate(effectiveCheckDate)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Notes</label>
              <input
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Optional check notes"
                className="mt-2 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-300 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-y border-slate-100 px-5 py-3 dark:border-slate-700 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-300 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={fillSystemQuantities} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                Use System Qty
              </button>
              <button type="button" onClick={clearCounts} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                Clear
              </button>
              <button type="button" onClick={saveCheck} disabled={saving || rows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-bosch-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-bosch-blue/90 disabled:cursor-not-allowed disabled:opacity-60">
                Save Check
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3 text-right">System</th>
                  <th className="px-5 py-3 text-right">Physical</th>
                  <th className="px-5 py-3 text-right">Variance</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No products found for this check.
                    </td>
                  </tr>
                )}
                {filteredRows.map(row => {
                  const raw = physicalByProductId[row.id]
                  const physical = raw === undefined || raw === '' ? NaN : Number(raw)
                  const variance = Number.isFinite(physical) ? physical - row.stockOnHand : 0
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/70 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                      <td className="px-5 py-4 align-middle">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{row.partNo || row.productGroupName || '-'}</div>
                      </td>
                      <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.storageLocation || '-'}</td>
                      <td className="px-5 py-4 align-middle text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatAmount(row.stockOnHand)}
                        <div className="text-xs font-normal text-slate-400">{row.unitOfMeasureName || ''}</div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={raw ?? ''}
                          onChange={event => setPhysicalByProductId(current => ({ ...current, [row.id]: event.target.value }))}
                          className="ml-auto block w-28 rounded border border-slate-200 bg-white px-2 py-1.5 text-right text-sm outline-none focus:ring-2 focus:ring-cyan-300 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>
                      <td className={`px-5 py-4 align-middle text-right text-sm font-semibold tabular-nums ${varianceClasses(variance)}`}>
                        {Number.isFinite(physical) ? `${variance > 0 ? '+' : ''}${formatAmount(variance)}` : '-'}
                        {Number.isFinite(physical) && <div className="text-xs font-normal">{varianceLabel(variance)}</div>}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <input
                          value={notesByProductId[row.id] ?? ''}
                          onChange={event => setNotesByProductId(current => ({ ...current, [row.id]: event.target.value }))}
                          placeholder="Optional"
                          className="w-56 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-300 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                <FileText size={18} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Print Report</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Defaults to the current month.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Start</label>
                <input type="date" value={reportStart} onChange={event => setReportStart(event.target.value)} className="mt-2 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">End</label>
                <input type="date" value={reportEnd} onChange={event => setReportEnd(event.target.value)} className="mt-2 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-900" />
              </div>
            </div>
            <button type="button" onClick={() => printReport()} disabled={printing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
              <FileText size={14} />
              Open PDF
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                  <CalendarDays size={18} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent Checks</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Latest saved snapshots</p>
                </div>
              </div>
              <button type="button" onClick={loadChecks} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Refresh checks">
                Refresh
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {recentChecks.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {loadingChecks ? 'Loading checks...' : 'No saved checks yet.'}
                </div>
              )}
              {recentChecks.map(check => (
                <div key={check.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatShortDate(check.checkDate)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {check.itemCount.toLocaleString()} products counted
                      </div>
                    </div>
                    <button type="button" onClick={() => printReport(check.checkDate.slice(0, 10), check.checkDate.slice(0, 10))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                      Print
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">Matched {check.matchedCount}</span>
                    <span className="rounded bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">Surplus {check.surplusCount}</span>
                    <span className="rounded bg-rose-50 px-2 py-1 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">Shortage {check.shortageCount}</span>
                    <span className={`rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-100 dark:bg-slate-900/40 dark:ring-slate-700 ${varianceClasses(check.netVariance)}`}>Net {check.netVariance > 0 ? '+' : ''}{formatAmount(check.netVariance)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
