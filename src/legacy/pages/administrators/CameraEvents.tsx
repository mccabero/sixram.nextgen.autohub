// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Calendar, Camera, Car, CheckCircle2, Clock, Image, RefreshCw, Trash2, X } from 'lucide-react'
import { EmptyState, ListPageHeader, ListToolbar, StatusBadge } from '../../components/lists'
import { clearCameraEvents, getCameraEvents, getCameraEventSummary } from '../../services/operationService'
import { useToast } from '../../contexts/toast'

type CameraEventRow = {
  id: number
  cameraIp?: string | null
  channelId?: number | null
  channelName?: string | null
  eventDateTime: string
  eventType: string
  eventState: string
  eventDescription?: string | null
  activePostCount?: number | null
  source?: string | null
  snapshotUrl?: string | null
  snapshotCapturedDateTime?: string | null
  snapshotError?: string | null
  createdDateTime?: string | null
}

type CameraEventSummary = {
  totalToday?: number
  activeToday?: number
  vmdActiveToday?: number
  total?: number
  active?: number
  vmdActive?: number
  captured?: number
  snapshotFailed?: number
  lastEvent?: CameraEventRow | null
}

function todayInputValue() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function captureDateRange(value: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0)
  return { start: start.toISOString(), end: end.toISOString() }
}

const TIMEZONE_PATTERN = /(z|[+-]\d{2}:?\d{2})$/i

function formatDateTime(value?: string | null, options?: { assumeUtcWhenTimezoneMissing?: boolean }) {
  if (!value) return '-'
  const trimmed = value.trim()
  const normalized = options?.assumeUtcWhenTimezoneMissing && trimmed && !TIMEZONE_PATTERN.test(trimmed)
    ? `${trimmed}Z`
    : trimmed
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatCapturedDateTime(row?: CameraEventRow | null) {
  if (!row) return '-'
  if (row.snapshotCapturedDateTime) {
    return formatDateTime(row.snapshotCapturedDateTime, { assumeUtcWhenTimezoneMissing: true })
  }
  return formatDateTime(row.eventDateTime)
}

function formatCaptureDateLabel(value: string) {
  if (!value) return 'All capture dates'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function normalizeRows(value: any): CameraEventRow[] {
  const list = Array.isArray(value) ? value : []
  return list.map((item: any) => ({
    id: Number(item.id ?? item.Id ?? 0),
    cameraIp: item.cameraIp ?? item.CameraIp ?? null,
    channelId: item.channelId ?? item.ChannelId ?? null,
    channelName: item.channelName ?? item.ChannelName ?? null,
    eventDateTime: String(item.eventDateTime ?? item.EventDateTime ?? ''),
    eventType: String(item.eventType ?? item.EventType ?? ''),
    eventState: String(item.eventState ?? item.EventState ?? ''),
    eventDescription: item.eventDescription ?? item.EventDescription ?? null,
    activePostCount: item.activePostCount ?? item.ActivePostCount ?? null,
    source: item.source ?? item.Source ?? null,
    snapshotUrl: item.snapshotUrl ?? item.SnapshotUrl ?? null,
    snapshotCapturedDateTime: item.snapshotCapturedDateTime ?? item.SnapshotCapturedDateTime ?? null,
    snapshotError: item.snapshotError ?? item.SnapshotError ?? null,
    createdDateTime: item.createdDateTime ?? item.CreatedDateTime ?? null,
  }))
}

function normalizeSummary(value: any): CameraEventSummary {
  const last = value?.lastEvent ?? value?.LastEvent ?? null
  return {
    totalToday: Number(value?.totalToday ?? value?.TotalToday ?? 0),
    activeToday: Number(value?.activeToday ?? value?.ActiveToday ?? 0),
    vmdActiveToday: Number(value?.vmdActiveToday ?? value?.VmdActiveToday ?? 0),
    total: Number(value?.total ?? value?.Total ?? value?.totalToday ?? value?.TotalToday ?? 0),
    active: Number(value?.active ?? value?.Active ?? value?.activeToday ?? value?.ActiveToday ?? 0),
    vmdActive: Number(value?.vmdActive ?? value?.VmdActive ?? value?.vmdActiveToday ?? value?.VmdActiveToday ?? 0),
    captured: Number(value?.captured ?? value?.Captured ?? 0),
    snapshotFailed: Number(value?.snapshotFailed ?? value?.SnapshotFailed ?? 0),
    lastEvent: last ? normalizeRows([last])[0] : null,
  }
}

function isCountedEntry(row: CameraEventRow) {
  return row.eventType.toUpperCase() === 'VMD' && row.eventState.toLowerCase() === 'active'
}

export default function CameraEvents() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<CameraEventRow[]>([])
  const [summary, setSummary] = useState<CameraEventSummary | null>(null)
  const [captureDate, setCaptureDate] = useState(todayInputValue())
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const range = captureDateRange(captureDate)
      const params = {
        take: 200,
        eventType: 'VMD',
        eventState: 'active',
        capturedStart: range?.start,
        capturedEnd: range?.end,
      }
      const [summaryRes, eventsRes] = await Promise.all([
        getCameraEventSummary(params),
        getCameraEvents(params),
      ])
      setSummary(normalizeSummary(summaryRes))
      setRows(normalizeRows(eventsRes))
    } catch (error: any) {
      showToast(error?.message || 'Failed to load camera events', 'error')
    } finally {
      setLoading(false)
    }
  }, [captureDate, showToast])

  useEffect(() => { void load() }, [load])

  const handleClearAll = useCallback(async () => {
    if (!window.confirm('Clear all camera events? This is only intended for testing.')) return

    setClearing(true)
    try {
      const result = await clearCameraEvents() as { deletedCount?: number } | null
      const deletedCount = result?.deletedCount ?? 0
      showToast(`Cleared ${deletedCount} camera event${deletedCount === 1 ? '' : 's'}.`, 'success')
      await load()
    } catch (error: any) {
      showToast(error?.message || 'Failed to clear camera events', 'error')
    } finally {
      setClearing(false)
    }
  }, [load, showToast])

  const countedEntries = summary?.vmdActive ?? rows.filter(isCountedEntry).length
  const capturedImages = summary?.captured ?? rows.filter(row => row.snapshotUrl).length
  const snapshotIssues = summary?.snapshotFailed ?? rows.filter(row => row.snapshotError).length
  const captureRate = countedEntries > 0 ? Math.round((capturedImages / countedEntries) * 100) : 0
  const busy = loading || clearing

  const headerStats = useMemo(() => [
    { label: 'Entries', value: countedEntries, tone: 'emerald' as const },
    { label: 'Images', value: capturedImages, tone: 'sky' as const },
    { label: 'Issues', value: snapshotIssues, tone: snapshotIssues > 0 ? 'rose' as const : 'default' as const },
  ], [capturedImages, countedEntries, snapshotIssues])

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Camera}
        title="Camera Events"
        subtitle="Accepted Hikvision VMD captures for vehicle entry counting"
        iconGradient="from-slate-800 to-sky-600"
        stats={headerStats}
        rightExtra={(
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                <Car size={14} />
                Counted entries
              </div>
              <div className="mt-4 flex items-end gap-3">
                <div className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{countedEntries.toLocaleString()}</div>
                <div className="pb-2 text-sm font-medium text-slate-500 dark:text-slate-400">{formatCaptureDateLabel(captureDate)}</div>
              </div>
            </div>

            <div className="grid min-w-[220px] grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Image size={14} />
                  Images
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{capturedImages.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <CheckCircle2 size={14} />
                  Capture rate
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{captureRate}%</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Capture status</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Last accepted vehicle movement</div>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Last capture</span>
              <span className="text-right font-medium text-slate-900 dark:text-slate-100">{formatCapturedDateTime(summary?.lastEvent)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Count basis</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">VMD active</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Snapshot issues</span>
              <span className={snapshotIssues > 0 ? 'font-semibold text-rose-600 dark:text-rose-300' : 'font-medium text-slate-900 dark:text-slate-100'}>
                {snapshotIssues.toLocaleString()}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800">
        <ListToolbar
          left={(
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900/30">
                <Calendar size={16} className="text-slate-400" />
                <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Capture date</label>
                <input
                  type="date"
                  value={captureDate}
                  onChange={event => setCaptureDate(event.target.value)}
                  disabled={busy}
                  className="h-8 bg-transparent text-sm font-medium text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={() => setCaptureDate(todayInputValue())}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCaptureDate('')}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X size={15} />
                All dates
              </button>
            </div>
          )}
          right={(
            <button
              type="button"
              onClick={() => void handleClearAll()}
              disabled={busy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              <Trash2 size={16} />
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          )}
        />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-700">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
                <th className="px-5 py-3">Snapshot</th>
                <th className="px-5 py-3">Captured</th>
                <th className="px-5 py-3">Camera</th>
                <th className="px-5 py-3">Count</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Snapshot Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map(row => (
                <tr key={row.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className="px-5 py-4">
                    {row.snapshotUrl ? (
                      <a href={row.snapshotUrl} target="_blank" rel="noreferrer" className="block h-16 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <img src={row.snapshotUrl} alt="Camera event snapshot" className="h-full w-full object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/30">
                        No image
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{formatCapturedDateTime(row)}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Event {formatDateTime(row.eventDateTime)}</div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{row.channelName || `Channel ${row.channelId ?? 1}`}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.cameraIp || '-'}</div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {isCountedEntry(row) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                        <Car size={13} />
                        Entry
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Ignored</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{row.eventType || '-'}</span>
                      <StatusBadge status={row.eventState} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.eventDescription || row.source || '-'}</div>
                  </td>
                  <td className="min-w-[180px] px-5 py-4">
                    {row.snapshotError ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30" title={row.snapshotError}>
                        <AlertTriangle size={13} />
                        Failed
                      </div>
                    ) : row.snapshotUrl ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                        <Image size={13} />
                        Saved
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyState
                  icon={Camera}
                  title={loading ? 'Loading camera captures...' : 'No captured vehicle entries found'}
                  hint={captureDate ? 'Try another capture date or confirm snapshot capture is enabled.' : 'No accepted VMD captures are available yet.'}
                  colSpan={6}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
