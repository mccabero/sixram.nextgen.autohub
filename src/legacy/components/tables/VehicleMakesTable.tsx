// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { getVehicleMakes, deleteVehicleMake } from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import { buildCompletenessFilterOptions, filterByCompleteness, hasValue, type CompletenessFilterKey } from '../../utils/completenessFilter'
import { ClientTypeFilter, ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

export interface Make { id:number; name:string; description?:string; region?: any; regionParameter?: any }

export default function VehicleMakesTable({ items = [] }: { items?: Make[] }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role } = useAuth()
  const [rows,setRows]=useState<Make[]>(items)
  const [searchTerm,setSearchTerm]=useState('')
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilterKey>('ALL')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ setRows(items) },[items])
  useEffect(()=>{
    let mounted = true
    setLoading(true)
    getVehicleMakes().then((data:any)=>{ if(mounted && Array.isArray(data)){ setRows(data) } }).catch(()=>{}).finally(()=> mounted && setLoading(false))
    return ()=>{ mounted = false }
  },[])

  function getRegionName(region: any){
    if (!region && region !== 0) return ''
    if (typeof region === 'string') return region
    if (typeof region === 'number') return String(region)
    if (typeof region === 'object') {
      const rp = (region as any).regionParameter ?? (region as any).region_parameter ?? (region as any).regionParam
      if (rp && typeof rp === 'object') return rp.name ?? rp.displayName ?? rp.label ?? ''
      return (region as any).name ?? (region as any).region ?? (region as any).regionName ?? (region as any).displayName ?? (region as any).label ?? ''
    }
    return ''
  }

  function isVehicleMakeComplete(row: Make) {
    return hasValue(getRegionName(row.region ?? row.regionParameter)) && hasValue(row.description)
  }

  const completenessFiltered = useMemo(() => filterByCompleteness(rows, completenessFilter, isVehicleMakeComplete), [rows, completenessFilter])
  const completenessFilterOptions = useMemo(() => buildCompletenessFilterOptions(rows, isVehicleMakeComplete), [rows])

  const filtered = useMemo(()=>{
    const q = searchTerm.trim().toLowerCase()
    if(!q) return completenessFiltered
    return completenessFiltered.filter(r=> (r.name||'').toLowerCase().includes(q) || getRegionName(r.region ?? r.regionParameter).toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q))
  },[completenessFiltered, searchTerm])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount, page])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/configuration/vehicle-makes/add') }
  function handleEdit(id:number){ navigate(`/configuration/vehicle-makes/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deleteVehicleMake(String(deleteTargetId)); setRows(r=> r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setLoading(false); setSearchTerm(''); setPage(0) }
  }

  const getSubtitle = (row: Make) => {
    const description = String(row.description ?? '').replace(/\s+/g, ' ').trim()
    if (description) return description
    return getRegionName(row.region ?? row.regionParameter)
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Tag}
        title="Vehicle Makes"
        subtitle="Automobile make brands and their regional context"
        addLabel="Add Vehicle Make"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: rows.length }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this record?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={completenessFilter}
              onChange={(value) => { setCompletenessFilter(value); setPage(0) }}
              label="Completeness"
              options={completenessFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search name, region..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Tag} colSpan={5} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(r.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30">
                          <Tag size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{r.name}</div>
                          {!!getSubtitle(r) && <div className="mt-0.5 max-w-[28rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{getSubtitle(r)}</div>}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{getRegionName(r.region ?? r.regionParameter)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{r.description}</td>
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
