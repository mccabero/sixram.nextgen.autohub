// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { formatShortDate } from '../../utils/format'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteInspection, openInspectionFormPdf } from '../../services/operationService'
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

export interface Item { id:number; clientType?:string; referenceNo?:string; inspectionDate?:string; customerName?:string; vehicle?:string; plateNo?:string; status?:string }

export default function InspectionTable({ items }: { items?: Item[] }){
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
  const { getVoidAction, voidConfirmModal } = useOperationVoidAction<Item>({ operationType: 'inspections', setRows, setLoading })

  useEffect(()=>{ setRows(items ?? []) },[items])
  useEffect(()=>{
    let mounted = true
    async function load(){
      setLoading(true)
      try{
        const res = await fetch('/api/operations/inspections/summary')
        if (!mounted) return
        if (!res.ok){ setRows([]); return }
        const list = await res.json()
        const toStr = (v:any) => {
          if (v == null) return ''
          if (typeof v === 'string' || typeof v === 'number') return String(v)
          if (typeof v === 'object') return String(v.plateNo ?? v.plateNumber ?? v.model ?? v.name ?? v.id ?? '')
          return String(v)
        }
        const mapped = (Array.isArray(list) ? list : []).map((it:any) => ({
          id: it.id ?? it.Id,
          clientType: (typeof it.isChangan !== 'undefined') ? (it.isChangan ? 'CHANGAN' : 'BOSCH') : (typeof it.is_changan !== 'undefined' ? (it.is_changan ? 'CHANGAN' : 'BOSCH') : (typeof it.IsChangan !== 'undefined' ? (it.IsChangan ? 'CHANGAN' : 'BOSCH') : (it.clientType ?? it.client_type ?? it.client ?? ''))),
          referenceNo: it.referenceNo ?? it.refNo ?? it.reference ?? '',
          inspectionDate: it.transactionDate ?? it.transactionDateTime ?? it.transaction_date ?? it.date ?? it.inspectionDate ?? it.inspection_date ?? '',
          customerName: (() => {
            if (it.customer == null) return (it.customerName ?? `${it.firstName||''} ${it.lastName||''}`.trim())
            if (typeof it.customer === 'string' || typeof it.customer === 'number') return String(it.customer)
            if (typeof it.customer === 'object') {
              const first = it.customer.firstName ?? it.customer.first_name ?? ''
              const last = it.customer.lastName ?? it.customer.last_name ?? ''
              if (first || last) return `${first} ${last}`.trim()
              if (it.customer.name) return String(it.customer.name)
            }
            return (it.customerName ?? `${it.firstName||''} ${it.lastName||''}`.trim())
          })(),
          vehicle: (() => {
            const v = it.vehicle ?? it.vehicleName ?? it.model ?? it.vehicleInfo ?? ''
            if (v && typeof v === 'object'){
              const make = v.vehicleModel?.vehicleMake?.name ?? v.vehicleModel?.vehicleMake?.Name ?? v.vehicleMake?.name ?? ''
              const model = v.vehicleModel?.name ?? v.vehicleModel?.model ?? v.model ?? v.name ?? ''
              const label = `${make} ${model}`.trim()
              if (label) return label
            }
            return toStr(v)
          })(),
          plateNo: toStr(it.plateNo ?? it.plateNumber ?? it.plate ?? (it.vehicle && it.vehicle.plateNo) ?? ''),
          status: ((it.jobStatus && (it.jobStatus.name || it.jobStatus.status || it.jobStatus.Name)) ? (it.jobStatus.name ?? it.jobStatus.status ?? it.jobStatus.Name) : (it.status ?? it.statusName ?? it.status_name ?? ''))
        }))

        mapped.sort((a: Item, b: Item) => (b.id || 0) - (a.id || 0))

        setRows(mapped)
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
    const q = searchTerm.trim().toLowerCase()
    return rows.filter(r=>{
      if (selectedClientType !== 'ALL' && (r.clientType||'').toUpperCase() !== selectedClientType) return false
      if (!q) return true
      return (
        (r.referenceNo||'').toString().toLowerCase().includes(q) ||
        (r.customerName||'').toLowerCase().includes(q) ||
        (r.vehicle||'').toLowerCase().includes(q) ||
        (r.plateNo||'').toLowerCase().includes(q)
      )
    })
  },[rows, searchTerm, selectedClientType])
  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[pageCount])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/operations/inspection/add') }
  function handleEdit(id:number){ navigate(`/operations/inspection/${id}`) }
  function handleDelete(row: Item){
    const status = String(row.status ?? '').trim().toUpperCase()
    if (status !== 'OPEN') {
      showToast('Only OPEN inspections can be deleted', 'error')
      return
    }

    setDeleteTargetId(row.id)
    setShowDeleteConfirm(true)
  }
  async function handlePrint(id:number){
    try {
      await openInspectionFormPdf(id)
    } catch (e:any) {
      showToast('Print failed: ' + (e?.message || 'Unknown error'), 'error')
    }
  }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{
      await deleteInspection(deleteTargetId)
      setRows(r=>r.map(x=>x.id===deleteTargetId ? { ...x, status: 'DELETED' } : x))
      showToast('Record marked as deleted','success')
    }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setSearchTerm(''); setPage(0); setLoading(false) }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={ClipboardCheck}
        title="Inspections"
        subtitle="Vehicle inspection reports and check-in records"
        addLabel="Add Inspection"
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
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search reference, customer, vehicle…" />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                {showClientType && <th className="px-5 py-3">Client Type</th>}
                <th className="px-5 py-3">Reference No.</th>
                <th className="px-5 py-3">Inspection Date</th>
                <th className="px-5 py-3">Customer Name</th>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Plate No.</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState colSpan={showClientType ? 9 : 8} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{r.id}</td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={r.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm">
                    <ReferenceLinkButton value={r.referenceNo} onClick={() => handleEdit(r.id)} title="Open inspection" />
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(r.inspectionDate)}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{r.customerName}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{r.vehicle}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 uppercase">{r.plateNo}</td>
                  <td className="px-5 py-4 align-middle"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: ()=>handleEdit(r.id), label: `edit-${r.id}` },
                      { kind: 'print', onClick: ()=>handlePrint(r.id), label: `print-${r.id}` },
                      getVoidAction(r),
                      { kind: 'delete', onClick: ()=>handleDelete(r), label: `delete-${r.id}` },
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
