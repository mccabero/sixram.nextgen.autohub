// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { formatAmount, formatShortDate } from '../../utils/format'
import { deleteInventoryTransaction, getInventoryProductTransactions } from '../../services/managementService'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { isActionAllowed, permissionDeniedMessage } from '../../utils/permissions'
import { EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions } from '../lists'

interface InventoryTransactionRow {
  id: string
  manualTransactionId?: number | null
  productId: number
  sourceType: string
  transactionType: string
  quantity: number
  transactionDateTime: string
  referenceNo?: string
  notes?: string
  isManual?: boolean
}

function normalizeRow(item: any): InventoryTransactionRow {
  return {
    id: String(item.id ?? item.Id ?? ''),
    manualTransactionId: item.manualTransactionId ?? item.ManualTransactionId ?? null,
    productId: Number(item.productId ?? item.ProductId ?? 0),
    sourceType: String(item.sourceType ?? item.SourceType ?? ''),
    transactionType: String(item.transactionType ?? item.TransactionType ?? ''),
    quantity: Number(item.quantity ?? item.Quantity ?? 0),
    transactionDateTime: String(item.transactionDateTime ?? item.TransactionDateTime ?? ''),
    referenceNo: String(item.referenceNo ?? item.ReferenceNo ?? ''),
    notes: String(item.notes ?? item.Notes ?? ''),
    isManual: Boolean(item.isManual ?? item.IsManual ?? false),
  }
}

function SourceBadge({ source }: { source: string }) {
  const normalized = source.toLowerCase()
  const classes = normalized.includes('manual')
    ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30'
    : normalized.includes('quick')
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
      : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${classes}`}>{source || '-'}</span>
}

export default function ProductInventoryTransactionsTable({ productId, reloadKey = 0 }: { productId?: string | number, reloadKey?: number }) {
  const { showToast } = useToast()
  const { role, userRoles } = useAuth()
  const permissionRoles = [role, ...userRoles]
  const [rows, setRows] = useState<InventoryTransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function load() {
    if (!productId) { setRows([]); return }
    setLoading(true)
    try {
      const data = await getInventoryProductTransactions(productId)
      const list = Array.isArray(data) ? data : []
      setRows(list.map(normalizeRow))
    } catch {
      setRows([])
      showToast('Failed to load inventory transactions', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [productId, reloadKey])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      row.sourceType.toLowerCase().includes(q)
      || row.transactionType.toLowerCase().includes(q)
      || String(row.referenceNo ?? '').toLowerCase().includes(q)
      || String(row.notes ?? '').toLowerCase().includes(q)
    )
  }, [rows, searchTerm])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [filtered, page, rowsPerPage])
  useEffect(() => { if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) }, [page, pageCount])

  async function confirmDelete() {
    if (deleteTargetId == null) return
    if (!isActionAllowed(permissionRoles, 'inventory.deleteManualTransaction')) {
      showToast(permissionDeniedMessage('inventory.deleteManualTransaction'), 'error')
      setDeleteTargetId(null)
      return
    }
    setIsDeleting(true)
    try {
      await deleteInventoryTransaction(deleteTargetId)
      setRows(current => current.filter(row => row.manualTransactionId !== deleteTargetId))
      showToast('Inventory transaction deleted', 'success')
    } catch (error: any) {
      showToast('Delete failed: ' + (error?.message || 'Unknown'), 'error')
    } finally {
      setIsDeleting(false)
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="w-full">
      <ListPageHeader icon={Boxes} title="Inventory Transactions" subtitle="Manual stock movements and product usage" stats={[{ label: 'Total', value: rows.length }]} />
      <ConfirmModal isOpen={deleteTargetId != null} title="Delete Stock Movement" message="Delete this manual inventory transaction?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => setDeleteTargetId(null)} loading={isDeleting} />
      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search source, reference, notes..." />} />
        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">Qty Impact</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3 text-right"><span className="inline-flex items-center gap-2 justify-end">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Boxes} colSpan={7} title="No inventory transactions found" hint="Stock movements and product usage will appear here." />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(row.transactionDateTime)}</td>
                  <td className="px-5 py-4 align-middle"><SourceBadge source={row.sourceType} /></td>
                  <td className="px-5 py-4 align-middle text-sm font-medium text-slate-700 dark:text-slate-200">{row.transactionType}</td>
                  <td className={`px-5 py-4 align-middle text-sm text-right font-semibold tabular-nums ${row.quantity < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    {row.quantity > 0 ? '+' : ''}{formatAmount(row.quantity)}
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.referenceNo || '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 max-w-md truncate">{row.notes || '-'}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[{
                      kind: 'delete',
                      onClick: () => {
                        if (!isActionAllowed(permissionRoles, 'inventory.deleteManualTransaction')) {
                          showToast(permissionDeniedMessage('inventory.deleteManualTransaction'), 'error')
                          return
                        }
                        setDeleteTargetId(row.manualTransactionId ?? null)
                      },
                      label: `delete-${row.id}`,
                      disabled: !row.isManual || !row.manualTransactionId,
                    }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0) }} />
      </div>
    </div>
  )
}
