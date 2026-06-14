// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderTree } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { getServiceGroups, deleteServiceGroup } from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import { buildCompletenessFilterOptions, filterByCompleteness, hasValue, type CompletenessFilterKey } from '../../utils/completenessFilter'
import { ClientTypeFilter, ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

export interface Item { id: number; name: string; description?: string }

export default function ServiceGroupsTable({ items = [], fetchOnMount = true }: { items?: Item[], fetchOnMount?: boolean }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role } = useAuth()
  const [rows, setRows] = useState<Item[]>(items)
  const [searchTerm, setSearchTerm] = useState('')
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilterKey>('ALL')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ setRows(items) },[items])
  useEffect(()=>{
    if (!fetchOnMount) return
    let mounted = true
    setLoading(true)
    getServiceGroups().then((data:any)=>{ if(mounted && Array.isArray(data)){ setRows(data) } }).catch(()=>{}).finally(()=> mounted && setLoading(false))
    return ()=>{ mounted = false }
  },[fetchOnMount])

  function isServiceGroupComplete(row: Item) {
    return hasValue(row.description)
  }

  const completenessFiltered = useMemo(() => filterByCompleteness(rows, completenessFilter, isServiceGroupComplete), [rows, completenessFilter])
  const completenessFilterOptions = useMemo(() => buildCompletenessFilterOptions(rows, isServiceGroupComplete), [rows])

  const filtered = useMemo(()=>{
    const q = searchTerm.trim().toLowerCase()
    if(!q) return completenessFiltered
    return completenessFiltered.filter(r=> (r.name||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q))
  },[completenessFiltered, searchTerm])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount, page])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/configuration/service-groups/add') }
  function handleEdit(id:number){ navigate(`/configuration/service-groups/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deleteServiceGroup(String(deleteTargetId)); setRows(r=>r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setSearchTerm(''); setPage(0); setLoading(false) }
  }

  const getSubtitle = (row: Item) => String(row.description ?? '').replace(/\s+/g, ' ').trim()

  return (
    <div className="w-full">
      <ListPageHeader
        icon={FolderTree}
        title="Service Groups"
        subtitle="Logical grouping of services for reporting and workflow"
        addLabel="Add Service Group"
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
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={FolderTree} colSpan={4} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(r.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                          <FolderTree size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{r.name}</div>
                          {!!getSubtitle(r) && <div className="mt-0.5 max-w-[32rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{getSubtitle(r)}</div>}
                        </div>
                      </div>
                    </button>
                  </td>
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
