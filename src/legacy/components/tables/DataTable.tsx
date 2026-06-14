// @ts-nocheck
import React, { useMemo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import { useCanDeletePermission } from '../../hooks/useCanDeletePermission'
import useDebouncedValue from '../../hooks/useDebouncedValue'

type Column<T> = { key: keyof T, title: string, render?: (v: any, row: T)=>React.ReactNode }

export default function DataTable<T extends Record<string, any>>({ columns, data, pageSize = 5, onAction }: { columns: Column<T>[], data: T[], pageSize?: number, onAction?: (action: string, row: T)=>void }){
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query)
  const [page, setPage] = useState(1)
  const canDelete = useCanDeletePermission()

  const filtered = useMemo(()=> {
    if (!debouncedQuery) return data
    const q = debouncedQuery.toLowerCase()
    return data.filter(d => Object.values(d).some(v => String(v).toLowerCase().includes(q)))
  },[data, debouncedQuery])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageData = filtered.slice((page-1)*pageSize, page*pageSize)

  if (!data || data.length === 0) return <EmptyState title="No records" description="No data to display." />

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <input aria-label="search" placeholder="Search..." value={query} onChange={e=>{ setQuery(e.target.value); setPage(1) }} className="px-3 py-2 border rounded w-64" />
        <div className="text-sm text-slate-500">{total} results</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-slate-600">
              {columns.map(c=> <th key={String(c.key)} className="text-left p-2">{c.title}</th>)}
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, idx)=> (
              <tr key={idx} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800">
                {columns.map(c=> <td key={String(c.key)} className="p-2">{c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '')}</td>)}
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={()=>onAction?.('view', row)} className="text-sm px-2 py-1 rounded border">View</button>
                    <button onClick={()=>onAction?.('edit', row)} className="text-sm px-2 py-1 rounded border">Edit</button>
                    {canDelete && <button onClick={()=>onAction?.('delete', row)} className="text-sm px-2 py-1 rounded border text-red-600">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
        <div className="flex gap-2">
          <button onClick={()=>setPage(1)} disabled={page===1} className="px-2 py-1 rounded border">First</button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 rounded border">Prev</button>
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2 py-1 rounded border">Next</button>
          <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 rounded border">Last</button>
        </div>
      </div>
    </div>
  )
}
