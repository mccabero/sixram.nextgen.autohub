// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Tag, Wrench } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { formatAmount } from '../../utils/format'
import { useAuth } from '../../auth/useAuth'
import { getServices, deleteService } from '../../services/managementService'
import { ClientTypeFilter, ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

export interface Item { id:number; name:string; description?:string }

type RateFilterKey = 'ALL' | 'LOW' | 'MID' | 'HIGH'

function getServiceRate(item: Item) {
  return Number((item as any).standardRate ?? (item as any).rate ?? (item as any).price ?? 0) || 0
}

export default function ServicesTable({ items }: { items?: Item[] }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role, logout } = useAuth()
  const [rows,setRows]=useState<Item[]>(items ?? [])
  const [searchTerm,setSearchTerm]=useState('')
  const [rateFilter, setRateFilter] = useState<RateFilterKey>('ALL')
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
        const res = await getServices()
        if (Array.isArray(res)) setRows(res)
        else setRows([])
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

  const rateBands = useMemo(() => {
    const rates = rows
      .map(getServiceRate)
      .filter(rate => Number.isFinite(rate))
      .sort((a, b) => a - b)

    if (rates.length === 0) {
      return { lowMax: 0, midMax: 0 }
    }

    const lowIndex = Math.max(0, Math.floor((rates.length - 1) / 3))
    const midIndex = Math.max(lowIndex, Math.floor(((rates.length - 1) * 2) / 3))

    return {
      lowMax: rates[lowIndex],
      midMax: rates[midIndex],
    }
  }, [rows])

  const rateFiltered = useMemo(() => {
    if (rateFilter === 'ALL') return rows

    return rows.filter(row => {
      const rate = getServiceRate(row)
      if (rateFilter === 'LOW') return rate <= rateBands.lowMax
      if (rateFilter === 'MID') return rate > rateBands.lowMax && rate <= rateBands.midMax
      return rate > rateBands.midMax
    })
  }, [rows, rateBands, rateFilter])

  const rateFilterOptions = useMemo(() => ([
    { key: 'ALL' as const, label: 'All', count: rows.length },
    { key: 'LOW' as const, label: 'Low', count: rows.filter(row => getServiceRate(row) <= rateBands.lowMax).length, activeClass: 'bg-sky-500 text-white' },
    { key: 'MID' as const, label: 'Mid', count: rows.filter(row => getServiceRate(row) > rateBands.lowMax && getServiceRate(row) <= rateBands.midMax).length, activeClass: 'bg-amber-500 text-white' },
    { key: 'HIGH' as const, label: 'High', count: rows.filter(row => getServiceRate(row) > rateBands.midMax).length, activeClass: 'bg-emerald-500 text-white' },
  ]), [rows, rateBands])

  const filtered = useMemo(()=>{
    const q=searchTerm.trim().toLowerCase()
    if(!q) return rateFiltered
    return rateFiltered.filter(r=> {
      const code = String((r as any).code ?? '')
      const group = String((r as any).serviceGroup?.name ?? (r as any).serviceGroup?.Name ?? (r as any).group?.name ?? (r as any).group ?? (r as any).groupName ?? '')
      return r.name.toLowerCase().includes(q) || code.toLowerCase().includes(q) || group.toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q)
    })
  },[rateFiltered, searchTerm])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/management/services/add') }
  function handleEdit(id:number){ navigate(`/management/services/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deleteService(String(deleteTargetId)); setRows(r=>r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setLoading(false); setSearchTerm(''); setPage(0) }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Settings}
        title="Services"
        subtitle="Service catalog with standard rates and labor hours"
        addLabel="Add Service"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: rows.length }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this record?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={rateFilter}
              onChange={(value) => { setRateFilter(value); setPage(0) }}
              label="Rate"
              options={rateFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search name, code, group..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3 text-right">Rate</th>
                <th className="px-5 py-3 text-right">Hours</th>
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Settings} colSpan={7} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(r.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                          <Wrench size={15} />
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
                            {!!r.description && <span className="truncate max-w-[28rem]">{r.description}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-700 dark:text-slate-300 tabular-nums">{formatAmount((r as any).standardRate ?? (r as any).rate ?? (r as any).price ?? '')}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-700 dark:text-slate-300 tabular-nums">{formatAmount((r as any).standardHours ?? (r as any).hours ?? '')}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{(r as any).serviceGroup?.name ?? (r as any).serviceGroup?.Name ?? (r as any).group?.name ?? (r as any).group ?? (r as any).groupName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{(r as any).serviceCategory?.name ?? (r as any).serviceCategory?.Name ?? (r as any).category?.name ?? (r as any).category ?? (r as any).categoryName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: ()=>handleEdit(r.id), label: `edit-${r.id}` },
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
