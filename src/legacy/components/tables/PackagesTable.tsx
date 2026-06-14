// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Tag } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { formatAmount } from '../../utils/format'
import { getPackages, deletePackage } from '../../services/managementService'
import { useAuth } from '../../auth/useAuth'
import { ClientTypeFilter, ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

export interface Item { id:number; name:string; description?:string }

type AmountFilterKey = 'ALL' | 'LOW' | 'MID' | 'HIGH'

function getPackageAmount(item: Item) {
  return Number((item as any).totalAmount ?? (item as any).amount ?? (item as any).price ?? 0) || 0
}

export default function PackagesTable({ items }: { items?: Item[] }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role, logout } = useAuth()
  const [rows,setRows]=useState<Item[]>(items ?? [])
  const [searchTerm,setSearchTerm]=useState('')
  const [amountFilter, setAmountFilter] = useState<AmountFilterKey>('ALL')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ setRows(items ?? []) },[items])
  useEffect(()=>{
    const ctl = new AbortController()
    const load = async () => {
      setLoading(true)
      try{
        const res = await getPackages()
        if (Array.isArray(res)) setRows(res)
        else { setRows([]) }
      }catch(e:any){
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        setRows([])
      }finally{ setLoading(false) }
    }
    load()
    return () => ctl.abort()
  },[])

  const amountBands = useMemo(() => {
    const amounts = rows
      .map(getPackageAmount)
      .filter(amount => Number.isFinite(amount))
      .sort((a, b) => a - b)

    if (amounts.length === 0) {
      return { lowMax: 0, midMax: 0 }
    }

    const lowIndex = Math.max(0, Math.floor((amounts.length - 1) / 3))
    const midIndex = Math.max(lowIndex, Math.floor(((amounts.length - 1) * 2) / 3))

    return {
      lowMax: amounts[lowIndex],
      midMax: amounts[midIndex],
    }
  }, [rows])

  const amountFiltered = useMemo(() => {
    if (amountFilter === 'ALL') return rows

    return rows.filter(row => {
      const amount = getPackageAmount(row)
      if (amountFilter === 'LOW') return amount <= amountBands.lowMax
      if (amountFilter === 'MID') return amount > amountBands.lowMax && amount <= amountBands.midMax
      return amount > amountBands.midMax
    })
  }, [rows, amountBands, amountFilter])

  const amountFilterOptions = useMemo(() => ([
    { key: 'ALL' as const, label: 'All', count: rows.length },
    { key: 'LOW' as const, label: 'Low', count: rows.filter(row => getPackageAmount(row) <= amountBands.lowMax).length, activeClass: 'bg-sky-500 text-white' },
    { key: 'MID' as const, label: 'Mid', count: rows.filter(row => getPackageAmount(row) > amountBands.lowMax && getPackageAmount(row) <= amountBands.midMax).length, activeClass: 'bg-amber-500 text-white' },
    { key: 'HIGH' as const, label: 'High', count: rows.filter(row => getPackageAmount(row) > amountBands.midMax).length, activeClass: 'bg-emerald-500 text-white' },
  ]), [rows, amountBands])

  const filtered = useMemo(()=>{
    const q=searchTerm.trim().toLowerCase()
    if(!q) return amountFiltered
    return amountFiltered.filter(r=> {
      const code = String((r as any).code ?? '')
      return r.name.toLowerCase().includes(q) || code.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q)
    })
  },[amountFiltered, searchTerm])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/management/packages/add') }
  function handleEdit(id:number){ navigate(`/management/packages/${id}`) }
  function handleDuplicate(id:number){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate(`/management/packages/add?copyFrom=${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deletePackage(String(deleteTargetId)); setRows(r=>r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setSearchTerm(''); setPage(0); setLoading(false) }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Package}
        title="Packages"
        subtitle="Pre-bundled service packages with fixed pricing"
        addLabel="Add Package"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: rows.length }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this record?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={amountFilter}
              onChange={(value) => { setAmountFilter(value); setPage(0) }}
              label="Amount"
              options={amountFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search name, code..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Package} colSpan={4} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(r.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                          <Package size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {r.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            {!!(r as any).code && (
                              <span className="inline-flex items-center gap-1">
                                <Tag size={12} />
                                <span>{(r as any).code}</span>
                              </span>
                            )}
                            {!!r.description && <span className="truncate max-w-[32rem]">{r.description}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{formatAmount((r as any).totalAmount ?? (r as any).amount ?? (r as any).price ?? '')}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: ()=>handleEdit(r.id), label: `edit-${r.id}` },
                      { kind: 'duplicate', onClick: ()=>handleDuplicate(r.id), label: `duplicate-${r.id}` },
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
