// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Phone, Truck, User } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { getSuppliers, deleteSupplier } from '../../services/managementService'
import { useAuth } from '../../auth/useAuth'
import { buildCompletenessFilterOptions, filterByCompleteness, hasValue, type CompletenessFilterKey } from '../../utils/completenessFilter'
import { ClientTypeFilter, ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

export interface Item { id:number; name:string; description?:string }

export default function SuppliersTable({ items }: { items?: Item[] }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role, logout } = useAuth()
  const [rows,setRows]=useState<Item[]>(items ?? [])
  const [searchTerm,setSearchTerm]=useState('')
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilterKey>('ALL')
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
        const res = await getSuppliers()
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

  function isSupplierComplete(row: Item) {
    return hasValue((row as any).contactPerson ?? (row as any).contact_person)
      && hasValue((row as any).contactNumber ?? (row as any).contact_number ?? (row as any).phone)
      && hasValue((row as any).address)
  }

  const completenessFiltered = useMemo(() => filterByCompleteness(rows, completenessFilter, isSupplierComplete), [rows, completenessFilter])
  const completenessFilterOptions = useMemo(() => buildCompletenessFilterOptions(rows, isSupplierComplete), [rows])

  const filtered = useMemo(()=>{
    const q=searchTerm.trim().toLowerCase()
    if(!q) return completenessFiltered
    return completenessFiltered.filter(r=> {
      const contactPerson = String((r as any).contactPerson ?? (r as any).contact_person ?? '')
      const contactNumber = String((r as any).contactNumber ?? (r as any).contact_number ?? (r as any).phone ?? '')
      const address = String((r as any).address ?? '')
      return r.name.toLowerCase().includes(q)
        || contactPerson.toLowerCase().includes(q)
        || contactNumber.toLowerCase().includes(q)
        || address.toLowerCase().includes(q)
        || (r.description||'').toLowerCase().includes(q)
    })
  },[completenessFiltered, searchTerm])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount, page])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/management/suppliers/add') }
  function handleEdit(id:number){ navigate(`/management/suppliers/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deleteSupplier(String(deleteTargetId)); setRows(r=>r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setLoading(false); setSearchTerm(''); setPage(0) }
  }

  const getSupplierSubtitle = (row: Item) => {
    const address = String((row as any).address ?? '').replace(/\s+/g, ' ').trim()
    if (address) return address

    const fallback = [
      (row as any).contactPerson ?? '',
      (row as any).contactNumber ?? (row as any).phone ?? ''
    ].filter(Boolean)

    return fallback.join(' • ')
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Truck}
        title="Suppliers"
        subtitle="Vendor and supplier directory with contact details"
        addLabel="Add Supplier"
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
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search supplier, contact, address..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact Person</th>
                <th className="px-5 py-3">Contact Number</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Truck} colSpan={5} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{r.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(r.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                          <Building2 size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {r.name}
                          </div>
                          {!!getSupplierSubtitle(r) && (
                            <div className="mt-0.5 max-w-[32rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              {getSupplierSubtitle(r)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-2">
                      <User size={14} className="text-slate-400" />
                      <span>{(r as any).contactPerson ?? (r as any).contact_person ?? ''}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />
                      <span>{(r as any).contactNumber ?? (r as any).contact_number ?? (r as any).phone ?? ''}</span>
                    </span>
                  </td>
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
