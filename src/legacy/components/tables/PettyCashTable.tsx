// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, AlertTriangle, Check } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deletePettyCash } from '../../services/operationService'
import { useOperationVoidAction } from '../../hooks/useOperationVoidAction'
import {
  ListPageHeader,
  ClientTypeFilter,
  ListSearchInput,
  ListToolbar,
  ListPagination,
  ClientTypeBadge,
  StatusBadge,
  RowActions,
  EmptyState,
  ReferenceLinkButton,
} from '../lists'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

export interface PettyCashRow {
  id: number
  isChangan: boolean
  pcNo?: string
  transactionDateTime: string
  payTo: string
  particulars: string
  cashIn: number
  cashOut: number
  balance: number
  status?: string
}

type ClientFilter = 'ALL' | 'BOSCH' | 'CHANGAN'

const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
const shortDate = (s: string) => {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s.slice(0, 10)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}
const isToday = (s: string) => {
  const d = new Date(s)
  if (isNaN(d.getTime())) return false
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function WarningModal({ isOpen, message, onClose }: { isOpen: boolean; message: string; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={20} />
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Warning!</h3>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-4 flex items-center justify-end">
          <button onClick={onClose} className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600">
            <Check size={14} /> OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PettyCashTable({ items = [], onChanged }: { items?: PettyCashRow[]; onChanged?: () => void }) {
  const showClientType = useShowIsChanganOption()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role } = useAuth()
  const [rows, setRows] = useState<PettyCashRow[]>(items)
  const [searchTerm, setSearchTerm] = useState('')
  const [clientFilter, setClientFilter] = useState<ClientFilter>('ALL')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [warning, setWarning] = useState<string>('')
  const { getVoidAction, voidConfirmModal } = useOperationVoidAction<PettyCashRow>({
    operationType: 'pettycashvouchers',
    setRows,
    setLoading,
    onVoided: onChanged,
  })

  useEffect(() => { setRows(items) }, [items])

  const counts = useMemo(() => {
    let golden = 0, changan = 0
    for (const r of rows){
      if (r.isChangan) changan++
      else golden++
    }
    return { all: rows.length, golden, changan }
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return rows.filter(r => {
      if (clientFilter === 'BOSCH' && r.isChangan) return false
      if (clientFilter === 'CHANGAN' && !r.isChangan) return false
      if (!q) return true
      return (
        (r.pcNo || '').toLowerCase().includes(q) ||
        (r.payTo || '').toLowerCase().includes(q) ||
        (r.particulars || '').toLowerCase().includes(q)
      )
    })
  }, [rows, searchTerm, clientFilter])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => { const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) }, [filtered, page, rowsPerPage])
  useEffect(() => { if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) }, [pageCount])

  function handleAdd() {
    if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return }
    navigate('/operations/petty-cash/add')
  }
  function handleEdit(id: number) { navigate(`/operations/petty-cash/${id}`) }
  function handleDelete(row: PettyCashRow) {
    if (!isToday(row.transactionDateTime)) {
      setWarning('Only transactions made on the same day are allowed to be deleted.')
      return
    }
    setDeleteTargetId(row.id)
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    setLoading(true)
    try {
      await deletePettyCash(String(deleteTargetId))
      setRows(r => r.map(x => x.id === deleteTargetId ? { ...x, status: 'DELETED' } : x))
      showToast('Record marked as deleted', 'success')
      onChanged && onChanged()
    } catch (e: any) {
      showToast('Delete failed: ' + (e?.message || 'Unknown'), 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Banknote}
        title="Petty Cash Voucher"
        subtitle="Daily petty cash transactions and running balance"
        addLabel="Add Petty Cash"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: counts.all }]}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}
        loading={isDeleting}
      />
      {voidConfirmModal}
      <WarningModal isOpen={!!warning} message={warning} onClose={() => setWarning('')} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={showClientType ? (
            <ClientTypeFilter
              value={clientFilter}
              onChange={(k) => { setClientFilter(k as ClientFilter); setPage(0) }}
              options={[
                { key: 'ALL', label: 'All', count: counts.all },
                { key: 'BOSCH', label: 'BOSCH', count: counts.golden, activeClass: 'bg-amber-500 text-white' },
                { key: 'CHANGAN', label: 'CHANGAN', count: counts.changan, activeClass: 'bg-sky-500 text-white' },
              ]}
            />
          ) : null}
          right={<ListSearchInput value={searchTerm} onChange={(v) => { setSearchTerm(v); setPage(0) }} placeholder="Search PC no, pay to, particulars…" />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                {showClientType && <th className="px-5 py-3">Client Type</th>}
                <th className="px-5 py-3">PC No.</th>
                <th className="px-5 py-3">Transaction Date</th>
                <th className="px-5 py-3">Pay To</th>
                <th className="px-5 py-3">Particulars</th>
                <th className="px-5 py-3 text-right">Cash In</th>
                <th className="px-5 py-3 text-right">Cash Out</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState colSpan={showClientType ? 10 : 9} />}
              {paged.map(r => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={r.isChangan ? 'CHANGAN' : 'BOSCH'} /></td>}
                  <td className="px-5 py-4 align-middle text-sm">
                    <ReferenceLinkButton value={r.pcNo} onClick={() => handleEdit(r.id)} title="Open petty cash voucher" />
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{shortDate(r.transactionDateTime)}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{r.payTo}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{r.particulars}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(r.cashIn)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-rose-700 dark:text-rose-400 tabular-nums">{fmt(r.cashOut)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{fmt(r.balance)}</td>
                  <td className="px-5 py-4 align-middle"><StatusBadge status={r.status ?? 'OPEN'} /></td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => handleEdit(r.id), label: `edit-${r.id}` },
                      getVoidAction(r),
                      { kind: 'delete', onClick: () => handleDelete(r), label: `delete-${r.id}` },
                    ]} />
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
