// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ClipboardCheck, FileText, Printer, ShieldCheck, Wrench, Mail, Phone, MapPin, LifeBuoy, Search } from 'lucide-react'

type CompanySupport = {
  name: string
  email: string
  mobileNumber: string
  address: string
}

const EMPTY_COMPANY: CompanySupport = {
  name: '',
  email: '',
  mobileNumber: '',
  address: '',
}

export default function HelpCenter() {
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState<CompanySupport>(EMPTY_COMPANY)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/companyinfo')
        if (!res.ok || !mounted) return
        const data = await res.json()
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.companyInfo)
              ? data.companyInfo
              : []
        const first = items[0]
        if (!first) return
        setCompany({
          name: String(first.name ?? first.Name ?? ''),
          email: String(first.email ?? first.Email ?? ''),
          mobileNumber: String(first.mobileNumber ?? first.mobile ?? first.Mobile ?? ''),
          address: String(first.address ?? first.Address ?? ''),
        })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  const sections = useMemo(() => ([
    {
      key: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      items: [
        'Create or update customer and vehicle records first so inspection and estimate pages can bind data cleanly.',
        'Use Company Information and Settings under Administrators to keep logos, login branding, and legal pages current.',
        'Check Job Statuses in Configuration when a workflow depends on OPEN, CONVERTED, or completed states.',
      ],
    },
    {
      key: 'daily-workflows',
      title: 'Daily Workflows',
      icon: Wrench,
      items: [
        'Inspection: record vehicle condition, assign personnel, then print the inspection form for physical signing when needed.',
        'Estimate: build services, products, packages, assign service personnel and technicians, then convert to Job Order once approved.',
        'Job Order: continue execution work, print the job order form, and move toward invoice only when the record is ready.',
      ],
    },
    {
      key: 'printing',
      title: 'Printing & Documents',
      icon: Printer,
      items: [
        'Print buttons in list and manage pages open browser PDF viewers so users can print or save without server-side file storage.',
        'Inspection, Estimate, and Job Order forms are generated from backend data, company branding, and selected technicians.',
        'If a printed form looks outdated, refresh the page before printing so the latest saved data is loaded.',
      ],
    },
    {
      key: 'status-rules',
      title: 'Status Rules',
      icon: ShieldCheck,
      items: [
        'Delete actions are restricted to OPEN records in inspection, estimate, and job order lists.',
        'Estimate conversion updates the estimate status to CONVERTED after a job order is created.',
        'Closed or converted records may become read-only depending on the module, so keep edits within the normal operation flow.',
      ],
    },
    {
      key: 'troubleshooting',
      title: 'Troubleshooting',
      icon: LifeBuoy,
      items: [
        'If a page loads slowly, refresh once before retrying actions that depend on large related data like services, products, or packages.',
        'If print or image assets do not show, verify the upload exists in the correct folder and refresh the page.',
        'If the frontend shows API proxy errors, confirm the backend is running on https://localhost:5101.',
      ],
    },
  ]), [])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections

    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.toLowerCase().includes(q) || section.title.toLowerCase().includes(q)),
      }))
      .filter(section => section.items.length > 0)
  }, [query, sections])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <LifeBuoy size={14} />
              Help Center
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Help Center</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              A practical guide for the team: where to start, how the workflow moves from inspection to estimate to job order, and what to check when something feels off.
            </p>
          </div>

          <div className="w-full max-w-md">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/30">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search workflows, printing, statuses..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link to="/operations/inspection" className="flex h-full min-h-[112px] flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/5">
          <ClipboardCheck size={20} className="text-sky-600 dark:text-sky-300" />
          <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Start with Inspection</div>
          <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use inspection when a vehicle is first checked in or assessed.</div>
        </Link>

        <Link to="/operations/estimate" className="flex h-full min-h-[112px] flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/5">
          <FileText size={20} className="text-violet-600 dark:text-violet-300" />
          <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Build the Estimate</div>
          <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Add services, products, packages, and service personnel before approval.</div>
        </Link>

        <Link to="/operations/job-order" className="flex h-full min-h-[112px] flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5">
          <Wrench size={20} className="text-emerald-600 dark:text-emerald-300" />
          <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Move to Job Order</div>
          <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Convert approved estimates, execute work, and prepare for invoicing.</div>
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          {filteredSections.map(section => {
            const Icon = section.icon
            return (
              <section key={section.key} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">
                    <Icon size={20} />
                  </div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{section.title}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {section.items.map(item => (
                    <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
          {filteredSections.length === 0 && (
            <section className="rounded-2xl border border-slate-200/70 bg-white p-6 text-sm text-slate-500 shadow-card dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No help topics matched that search yet.
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">Support Contact</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <FileText size={16} className="mt-0.5 text-slate-400" />
                <div>{company.name || 'Company information not set yet'}</div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={16} className="mt-0.5 text-slate-400" />
                <div>{company.email || 'No support email available'}</div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={16} className="mt-0.5 text-slate-400" />
                <div>{company.mobileNumber || 'No support phone available'}</div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 text-slate-400" />
                <div>{company.address || 'No support address available'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-800">
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">Useful Shortcuts</div>
            <div className="mt-4 space-y-2">
              <Link to="/administrators/settings" className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                Login branding and images
              </Link>
              <Link to="/administrators/legal-pages" className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                Terms, privacy, and login legal pages
              </Link>
              <Link to="/configuration/job-statuses" className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                Job status configuration
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
