// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ArrowLeft, Loader2 } from 'lucide-react'

export default function TermsAndConditions() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/login-settings')
        if (!res.ok || !mounted) return
        const data = await res.json()
        setContent(String(data?.termsAndConditions ?? ''))
      } catch {
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-bosch-blue hover:text-sky-500">
          <ArrowLeft size={16} />
          Back to Login
        </Link>

        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Terms & Conditions</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Please review the terms that apply to use of this application.</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/50">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                Loading terms...
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">
                {content || 'Terms & Conditions content has not been published yet.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
