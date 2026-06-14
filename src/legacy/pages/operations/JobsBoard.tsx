// @ts-nocheck
import React, { useEffect, useMemo, useState, type ReactNode } from 'react'

type BoardItem = {
  id: number
  refNo: string
  client: string
  vehicle: string
  plateNo: string
  isPackage: boolean
  date: string
  status: string
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toYMD(v?: string | null): string {
  if (!v) return ''
  const raw = String(v).trim()
  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoDateMatch) return isoDateMatch[1]

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function pickDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = toYMD(value ?? '')
    if (normalized) return normalized
  }
  return ''
}

function displayDate(ymd: string) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-')
  return `${m}/${d}/${y}`
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

function isOpenStatus(status: string) {
  return normalizeStatus(status) === 'OPEN'
}

function isCompletedStatus(status: string) {
  const normalized = normalizeStatus(status)
  return normalized === 'COMPLETED'
    || normalized === 'FOR PAYMENT'
    || normalized === 'COMPLETED / FOR PAYMENT'
    || normalized === 'COMPLETED/FOR PAYMENT'
}

async function apiFetch(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(path, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function gridClass(n: number) {
  if (n === 1) return 'grid-cols-1 max-w-sm'
  if (n === 2) return 'grid-cols-1 md:grid-cols-2'
  return 'grid-cols-1 md:grid-cols-3'
}

type ColKey = 'estimate' | 'inprogress' | 'completed'

const COL_CONFIG: Record<ColKey, { title: string; dot: string; hdrCls: string; borderCls: string }> = {
  estimate: {
    title: 'Estimate',
    dot: 'bg-amber-400',
    hdrCls: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    borderCls: 'border-l-amber-400',
  },
  inprogress: {
    title: 'In Progress',
    dot: 'bg-sky-500',
    hdrCls: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800',
    borderCls: 'border-l-sky-500',
  },
  completed: {
    title: 'Completed / For Payment',
    dot: 'bg-emerald-500',
    hdrCls: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    borderCls: 'border-l-emerald-500',
  },
}

const STATUS_OPTS: { key: ColKey | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'estimate', label: 'Estimate' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'completed', label: 'Completed / For Payment' },
]

function getValue(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function mapEstimate(item: any): BoardItem {
  return {
    id: Number(getValue(item, 'id', 'Id') ?? 0),
    refNo: String(getValue(item, 'referenceNo', 'ReferenceNo') ?? ''),
    client: String(getValue(item, 'customer', 'Customer') ?? ''),
    vehicle: String(getValue(item, 'vehicle', 'Vehicle') ?? ''),
    plateNo: String(getValue(item, 'plateNo', 'PlateNo') ?? ''),
    isPackage: Boolean(getValue(item, 'isPackage', 'IsPackage')),
    date: pickDate(
      getValue(item, 'transactionDate', 'TransactionDate'),
      getValue(item, 'createdDate', 'CreatedDate'),
      getValue(item, 'createdDateTime', 'CreatedDateTime'),
      getValue(item, 'date', 'Date')
    ),
    status: normalizeStatus(getValue(item, 'status', 'Status')),
  }
}

function mapJobOrder(item: any): BoardItem {
  return {
    id: Number(getValue(item, 'id', 'Id') ?? 0),
    refNo: String(getValue(item, 'referenceNo', 'ReferenceNo') ?? ''),
    client: String(getValue(item, 'customer', 'Customer', 'customerName', 'CustomerName') ?? ''),
    vehicle: String(getValue(item, 'vehicle', 'Vehicle') ?? ''),
    plateNo: String(getValue(item, 'plateNo', 'PlateNo') ?? ''),
    isPackage: Boolean(getValue(item, 'isPackage', 'IsPackage')),
    date: pickDate(
      getValue(item, 'transactionDate', 'TransactionDate'),
      getValue(item, 'createdDate', 'CreatedDate'),
      getValue(item, 'createdDateTime', 'CreatedDateTime'),
      getValue(item, 'date', 'Date')
    ),
    status: normalizeStatus(getValue(item, 'status', 'Status', 'jobStatus', 'JobStatus')),
  }
}

function TypeBadge({ isPackage }: { isPackage: boolean }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${isPackage ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
      {isPackage ? 'PKG' : 'REG'}
    </span>
  )
}

function CardShell({ children, borderCls }: { children: ReactNode; borderCls: string }) {
  return (
    <div className={`mb-2 rounded-lg border border-l-4 border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800 ${borderCls}`}>
      {children}
    </div>
  )
}

function BoardCard({ item, colKey }: { item: BoardItem; colKey: ColKey }) {
  const cfg = COL_CONFIG[colKey]

  return (
    <CardShell borderCls={cfg.borderCls}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="truncate font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">#{item.refNo || item.id}</span>
        <TypeBadge isPackage={item.isPackage} />
      </div>
      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.client || '-'}</div>
      {(item.vehicle || item.plateNo) && (
        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {item.vehicle}{item.vehicle && item.plateNo ? ' - ' : ''}<span className="uppercase">{item.plateNo}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {item.status && (
          <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.status}</span>
        )}
        {item.date && <span className="ml-auto shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{displayDate(item.date)}</span>}
      </div>
    </CardShell>
  )
}

function KanbanColumn({ colKey, count, children }: { colKey: ColKey; count: number; children: ReactNode }) {
  const cfg = COL_CONFIG[colKey]

  return (
    <div className="flex min-w-0 flex-col">
      <div className={`flex items-center gap-2 rounded-t-xl border px-3 py-2 ${cfg.hdrCls}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
        <span className="flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{cfg.title}</span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700/80 dark:text-slate-300">{count}</span>
      </div>
      <div className="min-h-[320px] flex-1 overflow-y-auto rounded-b-xl border border-t-0 border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/20">
        {children}
        {count === 0 && (
          <div className="flex h-24 items-center justify-center text-xs text-slate-400 dark:text-slate-500">No records for this date</div>
        )}
      </div>
    </div>
  )
}

export default function JobsBoard() {
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [statusFilter, setStatusFilter] = useState<ColKey | 'ALL'>('ALL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimates, setEstimates] = useState<BoardItem[]>([])
  const [inProgressJobOrders, setInProgressJobOrders] = useState<BoardItem[]>([])
  const [completedJobOrders, setCompletedJobOrders] = useState<BoardItem[]>([])

  useEffect(() => {
    let mounted = true

    async function loadBoardData() {
      if (!mounted) return
      setLoading(true)
      setError(null)

      try {
        const [estimateResponse, jobOrderResponse] = await Promise.all([
          apiFetch('/api/operations/estimates/summary').catch(() => []),
          apiFetch('/api/operations/joborders/summary').catch(() => []),
        ])

        if (!mounted) return

        const mappedEstimates = (Array.isArray(estimateResponse) ? estimateResponse : [])
          .map(mapEstimate)
          .filter(item => isOpenStatus(item.status))

        const mappedJobOrders = (Array.isArray(jobOrderResponse) ? jobOrderResponse : []).map(mapJobOrder)

        setEstimates(mappedEstimates)
        setInProgressJobOrders(mappedJobOrders.filter(item => isOpenStatus(item.status)))
        setCompletedJobOrders(mappedJobOrders.filter(item => isCompletedStatus(item.status)))
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load board data')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadBoardData()
    const intervalId = window.setInterval(loadBoardData, 60_000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const normalizedSelectedDate = toYMD(selectedDate)
  const matchesSelectedDate = (item: BoardItem) => !normalizedSelectedDate || item.date === normalizedSelectedDate

  const filteredEstimates = useMemo(() => estimates.filter(matchesSelectedDate), [estimates, normalizedSelectedDate])
  const filteredInProgress = useMemo(() => inProgressJobOrders.filter(matchesSelectedDate), [inProgressJobOrders, normalizedSelectedDate])
  const filteredCompleted = useMemo(() => completedJobOrders.filter(matchesSelectedDate), [completedJobOrders, normalizedSelectedDate])

  const show = (col: ColKey) => statusFilter === 'ALL' || statusFilter === col
  const visibleCount = ([show('estimate'), show('inprogress'), show('completed')] as boolean[]).filter(Boolean).length

  const colCounts: Record<ColKey, number> = {
    estimate: filteredEstimates.length,
    inprogress: filteredInProgress.length,
    completed: filteredCompleted.length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Jobs Board</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Open estimates and job orders grouped by workflow status</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_OPTS.map(({ key, label }) => {
            const count = key !== 'ALL' ? colCounts[key as ColKey] : null

            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key as ColKey | 'ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {label}{count !== null ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>

        <div className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-slate-600"
          />
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>

        <div className="ml-auto inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300">
          <span>Auto-refreshes every 1 minute</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className={`grid gap-4 ${gridClass(visibleCount)}`}>
        {show('estimate') && (
          <KanbanColumn colKey="estimate" count={filteredEstimates.length}>
            {filteredEstimates.map(item => <BoardCard key={`estimate-${item.id}`} item={item} colKey="estimate" />)}
          </KanbanColumn>
        )}
        {show('inprogress') && (
          <KanbanColumn colKey="inprogress" count={filteredInProgress.length}>
            {filteredInProgress.map(item => <BoardCard key={`inprogress-${item.id}`} item={item} colKey="inprogress" />)}
          </KanbanColumn>
        )}
        {show('completed') && (
          <KanbanColumn colKey="completed" count={filteredCompleted.length}>
            {filteredCompleted.map(item => <BoardCard key={`completed-${item.id}`} item={item} colKey="completed" />)}
          </KanbanColumn>
        )}
      </div>
    </div>
  )
}
