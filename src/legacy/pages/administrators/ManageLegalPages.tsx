// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { FileText, ShieldCheck, Save, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { getLoginSettings, updateLoginSettings } from '../../services/adminService'

type LegalContentState = {
  termsAndConditions: string
  privacyPolicy: string
}

const EMPTY_STATE: LegalContentState = {
  termsAndConditions: '',
  privacyPolicy: '',
}

export default function ManageLegalPages() {
  const { showToast } = useToast()
  const [content, setContent] = useState<LegalContentState>(EMPTY_STATE)
  const [savedContent, setSavedContent] = useState<LegalContentState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadContent(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true)
    else setLoading(true)

    try {
      const data: any = await getLoginSettings()
      const nextState = {
        termsAndConditions: String(data?.termsAndConditions ?? ''),
        privacyPolicy: String(data?.privacyPolicy ?? ''),
      }
      setContent(nextState)
      setSavedContent(nextState)
    } catch (e: any) {
      showToast('Failed to load legal content: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadContent()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res: any = await updateLoginSettings({
        termsAndConditions: content.termsAndConditions,
        privacyPolicy: content.privacyPolicy,
      })
      const nextState = {
        termsAndConditions: String(res?.termsAndConditions ?? ''),
        privacyPolicy: String(res?.privacyPolicy ?? ''),
      }
      setContent(nextState)
      setSavedContent(nextState)
      showToast('Legal content updated', 'success')
    } catch (e: any) {
      showToast('Failed to update legal content: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || refreshing || saving
  const hasChanges = useMemo(
    () =>
      content.termsAndConditions !== savedContent.termsAndConditions ||
      content.privacyPolicy !== savedContent.privacyPolicy,
    [content, savedContent]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <ShieldCheck size={14} />
            Legal Pages
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Terms & Privacy</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Manage the public Terms & Conditions and Privacy Policy pages linked from the login screen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => loadContent(true)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !hasChanges}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bosch-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Content
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Terms & Conditions</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Shown when the login page terms link is clicked.</p>
            </div>
          </div>

          <textarea
            value={content.termsAndConditions}
            onChange={e => setContent(prev => ({ ...prev, termsAndConditions: e.target.value }))}
            placeholder="Enter your Terms & Conditions content here"
            disabled={busy}
            className="mt-5 min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-100"
          />
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Privacy Policy</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Shown when the login page privacy link is clicked.</p>
            </div>
          </div>

          <textarea
            value={content.privacyPolicy}
            onChange={e => setContent(prev => ({ ...prev, privacyPolicy: e.target.value }))}
            placeholder="Enter your Privacy Policy content here"
            disabled={busy}
            className="mt-5 min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-100"
          />
        </section>
      </div>
    </div>
  )
}
