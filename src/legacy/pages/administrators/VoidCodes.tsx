// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Copy, Hash, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { ListPageHeader } from '../../components/lists'
import { useToast } from '../../contexts/toast'
import { generateVoidCode, getVoidCodes } from '../../services/adminService'

type VoidCodeHistoryItem = {
  id: number
  code: string | null
  maskedCode: string
  generatedById: number
  generatedByName: string | null
  generatedDateTime: string
  expiresAt: string
  usedById: number | null
  usedByName: string | null
  usedDateTime: string | null
  usedForAction: string | null
  usedForReferenceId: number | null
  status: 'ACTIVE' | 'USED' | 'EXPIRED'
}

type GeneratedVoidCode = {
  id: number
  code: string
  maskedCode: string
  expiresInMinutes: number
  generatedDateTime: string
  expiresAt: string
}

const MIN_EXPIRY_MINUTES = 1
const MAX_EXPIRY_MINUTES = 1440
const DEFAULT_EXPIRY_MINUTES = 5

function normalizeHistoryItem(item: any): VoidCodeHistoryItem {
  const normalizedStatus = String(item?.status ?? item?.Status ?? 'ACTIVE').toUpperCase()
  const status: VoidCodeHistoryItem['status'] =
    normalizedStatus === 'USED' || normalizedStatus === 'EXPIRED'
      ? normalizedStatus
      : 'ACTIVE'

  return {
    id: Number(item?.id ?? item?.Id ?? 0),
    code: item?.code ?? item?.Code ?? null,
    maskedCode: String(item?.maskedCode ?? item?.MaskedCode ?? '******'),
    generatedById: Number(item?.generatedById ?? item?.GeneratedById ?? 0),
    generatedByName: item?.generatedByName ?? item?.GeneratedByName ?? null,
    generatedDateTime: String(item?.generatedDateTime ?? item?.GeneratedDateTime ?? ''),
    expiresAt: String(item?.expiresAt ?? item?.ExpiresAt ?? ''),
    usedById: item?.usedById ?? item?.UsedById ?? null,
    usedByName: item?.usedByName ?? item?.UsedByName ?? null,
    usedDateTime: item?.usedDateTime ?? item?.UsedDateTime ?? null,
    usedForAction: item?.usedForAction ?? item?.UsedForAction ?? null,
    usedForReferenceId: item?.usedForReferenceId ?? item?.UsedForReferenceId ?? null,
    status,
  }
}

function normalizeGeneratedCode(item: any): GeneratedVoidCode {
  return {
    id: Number(item?.id ?? item?.Id ?? 0),
    code: String(item?.code ?? item?.Code ?? ''),
    maskedCode: String(item?.maskedCode ?? item?.MaskedCode ?? '******'),
    expiresInMinutes: Number(item?.expiresInMinutes ?? item?.ExpiresInMinutes ?? DEFAULT_EXPIRY_MINUTES),
    generatedDateTime: String(item?.generatedDateTime ?? item?.GeneratedDateTime ?? ''),
    expiresAt: String(item?.expiresAt ?? item?.ExpiresAt ?? ''),
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return parsed.toLocaleString()
}

function formatValidityText(expiresAt?: string | null, status?: string) {
  if (status === 'USED') return 'Already used'
  if (status === 'EXPIRED') return 'Expired'
  if (!expiresAt) return 'No expiry'
  return `Valid until ${formatDateTime(expiresAt)}`
}

function sameHistoryItem(a: VoidCodeHistoryItem, b: VoidCodeHistoryItem) {
  return (
    a.id === b.id
    && a.code === b.code
    && a.maskedCode === b.maskedCode
    && a.generatedById === b.generatedById
    && a.generatedByName === b.generatedByName
    && a.generatedDateTime === b.generatedDateTime
    && a.expiresAt === b.expiresAt
    && a.usedById === b.usedById
    && a.usedByName === b.usedByName
    && a.usedDateTime === b.usedDateTime
    && a.usedForAction === b.usedForAction
    && a.usedForReferenceId === b.usedForReferenceId
    && a.status === b.status
  )
}

function sameHistoryList(current: VoidCodeHistoryItem[], next: VoidCodeHistoryItem[]) {
  if (current.length !== next.length) return false
  return current.every((item, index) => sameHistoryItem(item, next[index]))
}

function describeUsage(item: VoidCodeHistoryItem) {
  if (item.status === 'ACTIVE') return 'Ready for use'
  if (item.status === 'EXPIRED') return 'Expired before use'

  const action = String(item.usedForAction ?? '').toLowerCase()
  const reference = item.usedForReferenceId ? ` #${item.usedForReferenceId}` : ''

  if (action === 'unlock:joborder') return `Used on Job Order${reference} editing unlock`
  if (action.startsWith('void:')) {
    const rawType = action.replace('void:', '').replace(/s$/, '')
    const label = rawType
      .split(/[^a-z0-9]+/i)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    return `Used on ${label || 'Transaction'}${reference} void`
  }

  return `Used${reference}`
}

function statusClasses(status: VoidCodeHistoryItem['status']) {
  if (status === 'USED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'EXPIRED') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

export default function VoidCodes() {
  const { showToast } = useToast()
  const [expiryMinutes, setExpiryMinutes] = useState(DEFAULT_EXPIRY_MINUTES)
  const [history, setHistory] = useState<VoidCodeHistoryItem[]>([])
  const [latestCode, setLatestCode] = useState<GeneratedVoidCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copying, setCopying] = useState(false)

  const loadCodes = useCallback(async (options?: { silent?: boolean; refreshButton?: boolean }) => {
    const silent = options?.silent ?? false
    const refreshButton = options?.refreshButton ?? false

    if (!silent) {
      if (refreshButton) setRefreshing(true)
      else setLoading(true)
    }

    try {
      const response = await getVoidCodes(25)
      const items = Array.isArray(response) ? response.map(normalizeHistoryItem) : []
      setHistory(current => sameHistoryList(current, items) ? current : items)
    } catch (error: any) {
      if (!silent) showToast(error?.message || 'Failed to load void codes', 'error')
    } finally {
      if (!silent) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [showToast])

  useEffect(() => {
    void loadCodes()
    const pollId = window.setInterval(() => { void loadCodes({ silent: true }) }, 30000)
    return () => window.clearInterval(pollId)
  }, [loadCodes])

  const latestHistory = useMemo(
    () => (latestCode ? history.find(item => item.id === latestCode.id) ?? null : null),
    [history, latestCode]
  )

  const latestStatus: VoidCodeHistoryItem['status'] = useMemo(() => {
    if (latestHistory) return latestHistory.status
    if (!latestCode) return 'ACTIVE'
    const expiresAt = new Date(latestCode.expiresAt)
    return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > Date.now() ? 'ACTIVE' : 'EXPIRED'
  }, [latestCode, latestHistory])

  const activeCount = useMemo(
    () => history.filter(item => item.status === 'ACTIVE').length,
    [history]
  )

  async function handleGenerate() {
    const minutes = Number(expiryMinutes)
    if (!Number.isFinite(minutes) || minutes < MIN_EXPIRY_MINUTES || minutes > MAX_EXPIRY_MINUTES) {
      showToast(`Expiration time must be between ${MIN_EXPIRY_MINUTES} and ${MAX_EXPIRY_MINUTES} minutes`, 'error')
      return
    }

    setGenerating(true)
    try {
      const response = await generateVoidCode(minutes)
      const generated = normalizeGeneratedCode(response)
      setLatestCode(generated)
      showToast('One-time void code generated', 'success')
      await loadCodes({ silent: true })
    } catch (error: any) {
      showToast(error?.message || 'Failed to generate void code', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!latestCode?.code) {
      showToast('Generate a code first', 'info')
      return
    }

    if (!navigator?.clipboard?.writeText) {
      showToast('Clipboard is not available in this browser', 'error')
      return
    }

    setCopying(true)
    try {
      await navigator.clipboard.writeText(latestCode.code)
      showToast('Code copied', 'success')
    } catch {
      showToast('Failed to copy code', 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        icon={Hash}
        title="Void Code Generator"
        subtitle="Generate one-time 6-digit codes for job order edit unlocks and VOID actions. Each code expires automatically and can only be used once."
        stats={[
          { label: 'Active Codes', value: activeCount },
          { label: 'Recent Codes', value: history.length },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <ShieldCheck size={14} />
                Server-enforced expiry and single use
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Generate a fresh code</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Use this for sensitive operations only. Once a code is used on a job order unlock or VOID action, it becomes invalid immediately.
              </p>
            </div>

            <button
              type="button"
              onClick={() => { void loadCodes({ refreshButton: true }) }}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,220px)_auto] md:items-end">
            <div>
              <label htmlFor="void-code-expiry" className="block text-sm font-medium text-slate-700">
                Expires in (minutes)
              </label>
              <input
                id="void-code-expiry"
                type="number"
                min={MIN_EXPIRY_MINUTES}
                max={MAX_EXPIRY_MINUTES}
                step={1}
                value={expiryMinutes}
                onChange={event => setExpiryMinutes(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15"
              />
              <p className="mt-2 text-xs text-slate-500">Allowed range: 1 to 1440 minutes.</p>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex h-[50px] items-center justify-center gap-2 rounded-xl bg-bosch-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Hash size={16} />}
              {generating ? 'Generating...' : 'Generate Code'}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            A code is valid for one use only. If it expires or gets consumed by another user, it cannot be used again.
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-500">Latest generated code</div>
              <div className="mt-1 text-xs text-slate-400">This is the only place the full code is shown.</div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(latestStatus)}`}>
              {latestStatus === 'USED' ? <CheckCircle2 size={14} /> : latestStatus === 'EXPIRED' ? <XCircle size={14} /> : <Clock size={14} />}
              {latestStatus}
            </span>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-6 text-center text-white">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">6-digit code</div>
            <div className="mt-3 font-mono text-4xl font-semibold tracking-[0.35em]">
              {latestCode?.code || '------'}
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
              <Clock size={13} />
              {latestCode ? formatValidityText(latestCode.expiresAt, latestStatus) : 'Generate a code to start'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Generated</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(latestCode?.generatedDateTime)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Expires</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(latestCode?.expiresAt)}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!latestCode?.code || copying}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy size={16} />
            {copying ? 'Copying...' : 'Copy Code'}
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent code history</h2>
            <p className="mt-1 text-sm text-slate-500">Full codes stay visible here for owner review, together with where each code was eventually used.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Generated</th>
                <th className="px-6 py-3">Expires</th>
                <th className="px-6 py-3">Used On</th>
              </tr>
            </thead>
            <tbody>
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    Loading code history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    No codes generated yet.
                  </td>
                </tr>
              ) : history.map(item => (
                <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-6 py-4 align-top">
                    <div className="font-mono text-lg font-semibold tracking-[0.25em] text-slate-900">{item.code?.trim() || item.maskedCode}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Generated by {item.generatedByName?.trim() || `User #${item.generatedById || 0}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(item.status)}`}>
                      {item.status === 'USED' ? <CheckCircle2 size={14} /> : item.status === 'EXPIRED' ? <XCircle size={14} /> : <Clock size={14} />}
                      {item.status}
                    </span>
                    <div className="mt-2 text-xs text-slate-400">{formatValidityText(item.expiresAt, item.status)}</div>
                  </td>
                  <td className="px-6 py-4 align-top text-sm text-slate-600">{formatDateTime(item.generatedDateTime)}</td>
                  <td className="px-6 py-4 align-top text-sm text-slate-600">{formatDateTime(item.expiresAt)}</td>
                  <td className="px-6 py-4 align-top">
                    <div className="text-sm font-medium text-slate-700">{describeUsage(item)}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.usedDateTime
                        ? `Used by ${item.usedByName?.trim() || (item.usedById ? `User #${item.usedById}` : 'Unknown user')} at ${formatDateTime(item.usedDateTime)}`
                        : item.status === 'ACTIVE'
                          ? 'Not used yet'
                          : 'Never used'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
