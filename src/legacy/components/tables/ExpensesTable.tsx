// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { formatShortDate, currency } from '../../utils/format'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteExpense } from '../../services/operationService'
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

export interface Item { id:number; clientType?:string; referenceNo?:string; expensesBy?:string; expenseDateTime?:string; createdDateTime?:string; amount?:number; status?:string }

function sortMostRecentFirst(items: Item[]) {
  return [...items].sort((left, right) => {
    const leftCreated = left.createdDateTime ? Date.parse(left.createdDateTime) : Number.NaN
    const rightCreated = right.createdDateTime ? Date.parse(right.createdDateTime) : Number.NaN

    if (Number.isFinite(leftCreated) && Number.isFinite(rightCreated) && leftCreated !== rightCreated) {
      return rightCreated - leftCreated
    }

    return right.id - left.id
  })
}

export default function ExpensesTable({ items }: { items?: Item[] }){
  const showClientType = useShowIsChanganOption()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role } = useAuth()
  const [rows,setRows]=useState<Item[]>(items ?? [])
  const [searchTerm,setSearchTerm]=useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | 'BOSCH' | 'CHANGAN'>('ALL')
  const { getVoidAction, voidConfirmModal } = useOperationVoidAction<Item>({ operationType: 'expenses', setRows, setLoading })

  useEffect(()=>{ setRows(sortMostRecentFirst(items ?? [])) },[items])
  useEffect(()=>{
    let mounted = true
    async function load(){
      setLoading(true)
      try{
        const res = await fetch('/api/operations/expenses/summary')
        if (!mounted) return
        if (!res.ok){ setRows([]); return }
        const list = await res.json()
        const mapped = (Array.isArray(list) ? list : []).map((it:any) => ({
          id: it.id ?? it.Id,
          clientType: (typeof it.isChangan !== 'undefined') ? (it.isChangan ? 'CHANGAN' : 'BOSCH') : (typeof it.is_changan !== 'undefined' ? (it.is_changan ? 'CHANGAN' : 'BOSCH') : (typeof it.IsChangan !== 'undefined' ? (it.IsChangan ? 'CHANGAN' : 'BOSCH') : (it.clientType ?? it.client_type ?? it.client ?? ''))),
          referenceNo: it.referenceNo ?? it.refNo ?? it.reference ?? '',
          expensesBy: it.expensesBy ?? it.expenses_by ?? it.by ?? it.expensesByName ?? it.expense_by ?? '',
          expenseDateTime: it.expenseDateTime ?? it.expense_date_time ?? it.expenseDate ?? it.expensesDate ?? it.date ?? '',
          createdDateTime: it.createdDateTime ?? it.CreatedDateTime ?? '',
          amount: it.amount ?? it.total ?? 0,
          status: (it.status ?? it.statusName ?? it.status_name ?? (it.jobStatus && (it.jobStatus.name || it.jobStatus.status || it.jobStatus.Name)) ?? '')
        }))
        setRows(sortMostRecentFirst(mapped))
      }catch(e){ setRows([]) }finally{ setLoading(false) }
    }
    load()
    return ()=>{ mounted = false }
  },[])

  const counts = useMemo(()=>{
    let bosch=0, changan=0
    for (const r of rows){
      const ct=(r.clientType||'').toUpperCase()
      if (ct==='BOSCH') bosch++
      else if (ct==='CHANGAN') changan++
    }
    return { all: rows.length, bosch, changan }
  },[rows])

  const filtered = useMemo(()=>{
    const q=searchTerm.trim().toLowerCase()
    return rows.filter(r=>{
      if (selectedClientType !== 'ALL' && (r.clientType||'').toUpperCase() !== selectedClientType) return false
      if(!q) return true
      return (
        (r.referenceNo||'').toString().toLowerCase().includes(q) ||
        (r.expensesBy||'').toLowerCase().includes(q)
      )
    })
  },[rows, searchTerm, selectedClientType])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/operations/expenses/add') }
  function handleEdit(id:number){ navigate(`/operations/expenses/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{
      await deleteExpense(deleteTargetId)
      setRows(r=>r.map(x=>x.id===deleteTargetId ? { ...x, status: 'DELETED' } : x))
      showToast('Record marked as deleted','success')
    }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setSearchTerm(''); setPage(0); setLoading(false) }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Wallet}
        title="Expenses"
        subtitle="Operational expenses and business spending records"
        addLabel="Add Expense"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: counts.all }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this record?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />
      {voidConfirmModal}

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={showClientType ? (
            <ClientTypeFilter
              value={selectedClientType}
              onChange={(k)=>{ setSelectedClientType(k as any); setPage(0) }}
              options={[
                { key: 'ALL', label: 'All', count: counts.all },
                { key: 'BOSCH', label: 'BOSCH', count: counts.bosch, activeClass: 'bg-amber-500 text-white' },
                { key: 'CHANGAN', label: 'CHANGAN', count: counts.changan, activeClass: 'bg-sky-500 text-white' },
              ]}
            />
          ) : null}
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search reference, expensed by..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                {showClientType && <th className="px-5 py-3">Client Type</th>}
                <th className="px-5 py-3">Reference No.</th>
                <th className="px-5 py-3">Expenses By</th>
                <th className="px-5 py-3">Expenses Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState colSpan={showClientType ? 8 : 7} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{r.id}</td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={r.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm">
                    <ReferenceLinkButton value={r.referenceNo} onClick={() => handleEdit(r.id)} title="Open expense" />
                  </td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{r.expensesBy}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(r.expenseDateTime)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{currency(r.amount)}</td>
                  <td className="px-5 py-4 align-middle"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: ()=>handleEdit(r.id), label: `edit-${r.id}` },
                      getVoidAction(r),
                      { kind: 'delete', onClick: ()=>handleDelete(r.id), label: `delete-${r.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n)=>{ setRowsPerPage(n); setPage(0) }} />
      </div>
    </div>
  )
}
