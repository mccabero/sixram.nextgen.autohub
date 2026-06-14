// @ts-nocheck
import React from 'react'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

export interface ListPaginationProps {
  page: number
  pageCount: number
  rowsPerPage: number
  total: number
  onPageChange: (p: number) => void
  onRowsPerPageChange: (n: number) => void
  rowsPerPageOptions?: number[]
}

export default function ListPagination({
  page,
  pageCount,
  rowsPerPage,
  total,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 20, 50, 100],
}: ListPaginationProps){
  const start = total === 0 ? 0 : page * rowsPerPage + 1
  const end = Math.min(total, (page + 1) * rowsPerPage)

  return (
    <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="text-slate-500 dark:text-slate-400">Rows per page</span>
        <select
          value={rowsPerPage}
          onChange={e => onRowsPerPageChange(Number(e.target.value))}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          {rowsPerPageOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <div className="hidden sm:block text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{start}–{end}</span> of <span className="font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString()}</span>
        </div>
        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900/40">
          <button aria-label="First page" onClick={() => onPageChange(0)} disabled={page === 0} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronsLeft size={16} /></button>
          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <button aria-label="Previous page" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={16} /></button>
          <span className="px-3 text-xs font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-700">
            {page + 1} / {pageCount}
          </span>
          <button aria-label="Next page" onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
          <button aria-label="Last page" onClick={() => onPageChange(pageCount - 1)} disabled={page >= pageCount - 1} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronsRight size={16} /></button>
        </div>
      </div>
    </div>
  )
}
