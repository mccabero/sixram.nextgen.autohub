// @ts-nocheck
import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { currency } from '../../utils/format'

export default function SalesChart({ data }: { data: { month: string, sales: number, expenses?: number, quickSales?: number, discounts?: number }[] }){
  const [visible, setVisible] = useState<{ sales: boolean, expenses: boolean, quickSales: boolean, discounts: boolean }>({ sales: true, expenses: true, quickSales: true, discounts: true })

  const legendPayload = useMemo(() => [
    { value: 'All', type: 'square', id: 'all', color: '#94a3b8' },
    { value: 'Sales', type: 'square', id: 'sales', color: '#10b981' },
    { value: 'Quick Sales', type: 'square', id: 'quickSales', color: '#0ea5e9' },
    { value: 'Discounts', type: 'square', id: 'discounts', color: '#f59e0b' },
    { value: 'Expenses', type: 'square', id: 'expenses', color: '#ef4444' }
  ], [])

  const handleLegendClick = (id: string) => {
    if (id === 'all') {
      setVisible({ sales: true, expenses: true, quickSales: true, discounts: true })
      return
    }
    setVisible(v => ({ ...v, [id]: !v[id as keyof typeof v] }))
  }

  const compactYAxis = (v: any) => {
    const n = Number(v) || 0
    const abs = Math.abs(n)
    if (abs >= 1000000) return `₱${(n/1000000).toFixed(1)}M`
    if (abs >= 1000) return `₱${Math.round(n/1000)}k`
    return `₱${Math.round(n)}`
  }

  return (
    <div className="card p-3 sm:p-4 rounded-xl shadow-card dark:shadow-none border border-border-DEFAULT dark:border-slate-700">
      <div className="mb-3">
        <div className="text-sm text-slate-600 dark:text-slate-200 font-medium mb-2">Annual Financial Report</div>
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          {legendPayload.map((p) => {
            const opacity = p.id === 'sales' ? (visible.sales ? 1 : 0.35)
              : p.id === 'quickSales' ? (visible.quickSales ? 1 : 0.35)
              : p.id === 'discounts' ? (visible.discounts ? 1 : 0.35)
              : p.id === 'expenses' ? (visible.expenses ? 1 : 0.35)
              : 1
            return (
              <button key={String(p.id)} type="button" onClick={() => handleLegendClick(p.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700">
                <span style={{ width: 8, height: 8, background: p.color, display: 'inline-block', borderRadius: 2, opacity, flexShrink: 0 }} />
                <span className="text-slate-600 dark:text-slate-200 whitespace-nowrap">{p.value}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 10, bottom: 0 }} barGap={2} barCategoryGap="15%">
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
            <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
            <YAxis tickFormatter={compactYAxis} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} width={45} />
            <Tooltip formatter={(value: any) => currency(Number(value))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            {visible.sales && <Bar dataKey="sales" fill="#10b981" radius={[4,4,0,0]} barSize={18} name="Sales" />}
            {visible.quickSales && <Bar dataKey="quickSales" fill="#0ea5e9" radius={[4,4,0,0]} barSize={18} name="Quick Sales" />}
            {visible.discounts && <Bar dataKey="discounts" fill="#f59e0b" radius={[4,4,0,0]} barSize={18} name="Discounts" />}
            {visible.expenses && <Bar dataKey="expenses" fill="#ef4444" radius={[4,4,0,0]} barSize={18} name="Expenses" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
