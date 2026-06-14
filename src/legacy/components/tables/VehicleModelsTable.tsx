// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { getVehicleModels, getVehicleMakes, deleteVehicleModel } from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import { buildCompletenessFilterOptions, filterByCompleteness, hasValue, type CompletenessFilterKey } from '../../utils/completenessFilter'
import { ClientTypeFilter, ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

export interface Model { id:number; name:string; description?:string; vehicleMake?: string; vehicleMakeId?: number | string }

export default function VehicleModelsTable({ items = [] }: { items?: Model[] }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role } = useAuth()
  const [rows,setRows]=useState<Model[]>(items)
  const [vehicleMakes, setVehicleMakes] = useState<any[]>([])
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
    Promise.all([getVehicleModels(), getVehicleMakes()])
      .then(([models, makes]: any) => {
        if (!mounted) return
        if (Array.isArray(models)) setRows(models)
        if (Array.isArray(makes)) setVehicleMakes(makes)
      })
      .catch(()=>{})
      .finally(()=> mounted && setLoading(false))
    return ()=>{ mounted = false }
  },[])

  function getMakeName(row: Model) {
    const nestedName = (row as any).vehicleMake?.name
      || (row as any).vehicleMake?.Name
      || (row as any).VehicleMake?.name
      || (row as any).VehicleMake?.Name
      || (row as any).vehicleMakeName
      || (row as any).VehicleMakeName
      || ''
    if (nestedName) return String(nestedName)

    const directName = typeof row.vehicleMake === 'string' ? row.vehicleMake : ''
    if (directName) return String(directName)

    const makeId = (row as any).vehicleMakeId
      ?? (row as any).VehicleMakeId
      ?? (typeof row.vehicleMake === 'number' ? row.vehicleMake : '')
    if (makeId === '' || makeId == null) return ''

    const matched = vehicleMakes.find((make: any) => String(make.id) === String(makeId))
    return String(matched?.name ?? matched?.Name ?? '')
  }

  function isVehicleModelComplete(row: Model) {
    return hasValue(getMakeName(row)) && hasValue(row.description)
  }

  const completenessFiltered = useMemo(() => filterByCompleteness(rows, completenessFilter, isVehicleModelComplete), [rows, completenessFilter, vehicleMakes])
  const completenessFilterOptions = useMemo(() => buildCompletenessFilterOptions(rows, isVehicleModelComplete), [rows, vehicleMakes])

  const filtered = useMemo(()=>{
    const q = searchTerm.trim().toLowerCase()
    if(!q) return completenessFiltered
    return completenessFiltered.filter(r=> (r.name||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q) || getMakeName(r).toLowerCase().includes(q))
  },[completenessFiltered, searchTerm, vehicleMakes])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount, page])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/configuration/vehicle-models/add') }
  function handleEdit(id:number){ navigate(`/configuration/vehicle-models/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deleteVehicleModel(String(deleteTargetId)); setRows(r=> r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setLoading(false); setSearchTerm(''); setPage(0) }
  }

  const getSubtitle = (row: Model) => {
    const description = String(row.description ?? '').replace(/\s+/g, ' ').trim()
    if (description) return description
    return getMakeName(row)
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Car}
        title="Vehicle Models"
        subtitle="Specific vehicle models under each make"
        addLabel="Add Vehicle Model"
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
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search name, description..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Vehicle Make</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Car} colSpan={5} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(r.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30">
                          <Car size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{r.name}</div>
                          {!!getSubtitle(r) && <div className="mt-0.5 max-w-[28rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{getSubtitle(r)}</div>}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{getMakeName(r)}</td>
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
