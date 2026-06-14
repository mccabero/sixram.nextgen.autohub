// @ts-nocheck
import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { childIconMap, navigationItems } from '../navigation/menu'

export default function Configuration() {
  const configurationNav = navigationItems.find(item => item.to === '/configuration')
  const children = configurationNav?.children ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Configuration</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Manage system reference data and inspection checklist templates from one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children.map(child => {
          const Icon = childIconMap[child.to]
          return (
            <Link
              key={child.to}
              to={child.to}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200">
                    {Icon ? <Icon size={18} /> : null}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 transition group-hover:text-sky-700">
                      {child.label}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Open the management page for {child.label.toLowerCase()}.
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-300 transition group-hover:text-sky-500" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
