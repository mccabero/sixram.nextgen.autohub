// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { formatShortDate } from '../../utils/format'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteEstimate, openEstimateFormPdf } from '../../services/operationService'
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

export interface Item { id:number; clientType?:string; referenceNo?:string; estimateDate?:string; customerName?:string; vehicle?:string; plateNo?:string; estimateType?:string; status?:string }

export default function EstimateTable({ items }: { items?: Item[] }){
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
  const { getVoidAction, voidConfirmModal } = useOperationVoidAction<Item>({ operationType: 'estimates', setRows, setLoading })

  const toStr = (v:any) => {
    if (v == null) return ''
    if (typeof v === 'string' || typeof v === 'number') return String(v)
    if (typeof v === 'object') return String(v.plateNo ?? v.plateNumber ?? v.model ?? v.name ?? v.id ?? '')
    return String(v)
  }

  const mapItem = (it:any) => {
    const v = it
    const make = v?.vehicle?.vehicleModel?.vehicleMake?.name ?? v?.vehicleModel?.vehicleMake?.name ?? v?.vehicleModel?.vehicleMake?.Name ?? v?.vehicleModel?.make ?? it.vehicleMake ?? (it.vehicleMake && it.vehicleMake.name) ?? null
    const model = v?.vehicle?.vehicleModel?.name ?? v?.vehicleModel?.name ?? v?.vehicleModel?.model ?? it.model ?? v?.model ?? null
    const vehicleLabel = [make, model].filter(Boolean).join(' ').trim() || toStr(it.vehicle ?? it.vehicleName ?? it.model ?? it.vehicleInfo ?? '')
    const parseBool = (x:any) => x === true || x === 'true' || x === 1 || x === '1' || x === 'True' || x === 'TRUE'
    const rawIsCh = it.isChangan ?? it.is_changan ?? it.IsChangan
    const clientTypeVal = (typeof rawIsCh !== 'undefined' && rawIsCh !== null) ? (parseBool(rawIsCh) ? 'CHANGAN' : 'BOSCH') : (it.clientType ?? it.client_type ?? it.client ?? '')
    return {
      id: it.id ?? it.Id,
      clientType: (clientTypeVal || '').toString(),
      referenceNo: it.referenceNo ?? it.refNo ?? it.reference ?? '',
      estimateDate: it.transactionDate ?? it.transactionDateTime ?? it.date ?? it.estimateDate ?? it.estimate_date ?? '',
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
      vehicle: vehicleLabel,
      plateNo: toStr(it.plateNo ?? it.plateNumber ?? it.plate ?? (it.vehicle && it.vehicle.plateNo) ?? ''),
      estimateType: ((typeof it.isPackage !== 'undefined') ? (it.isPackage ? 'PACKAGE' : 'REGULAR') : (typeof it.is_package !== 'undefined' ? (it.is_package ? 'PACKAGE' : 'REGULAR') : (typeof it.IsPackage !== 'undefined' ? (it.IsPackage ? 'PACKAGE' : 'REGULAR') : (it.estimateType ?? it.type ?? '')))),
      status: ((it.jobStatus && (it.jobStatus.name || it.jobStatus.status || it.jobStatus.Name)) ? (it.jobStatus.name ?? it.jobStatus.status ?? it.jobStatus.Name) : (it.status ?? it.statusName ?? it.status_name ?? ''))
    }
  }

  useEffect(()=>{
    const mapped = (items ?? []).map(mapItem)
    try {
      mapped.sort((a: Item, b: Item) => {
        const pa = Date.parse(String(a.estimateDate || ''))
        const pb = Date.parse(String(b.estimateDate || ''))
        const ta = Number.isFinite(pa) && !isNaN(pa) ? pa : 0
        const tb = Number.isFinite(pb) && !isNaN(pb) ? pb : 0
        const byDate = tb - ta
        if (byDate !== 0) return byDate
        return (b.id || 0) - (a.id || 0)
      })
    } catch (e) {
      // ignore sort errors and keep original order
    }
    setRows(mapped)
  },[items])
  useEffect(()=>{
    let mounted = true
    async function load(){
      setLoading(true)
      try{
        const res = await fetch('/api/operations/estimates/summary')
        if (!mounted) return
        if (!res.ok){ setRows([]); return }
        const list = await res.json()
        const mapped = (Array.isArray(list) ? list : []).map(mapItem)
        try {
          mapped.sort((a: Item, b: Item) => {
            const pa = Date.parse(String(a.estimateDate || ''))
            const pb = Date.parse(String(b.estimateDate || ''))
            const ta = Number.isFinite(pa) && !isNaN(pa) ? pa : 0
            const tb = Number.isFinite(pb) && !isNaN(pb) ? pb : 0
            const byDate = tb - ta
            if (byDate !== 0) return byDate
            return (b.id || 0) - (a.id || 0)
          })
        } catch (e) {
          // ignore
        }
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
      const ct = ((r.clientType ?? '') + '').toString().trim().toUpperCase()
      if (selectedClientType !== 'ALL' && ct !== selectedClientType) return false
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

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/operations/estimate/add') }
  function handleEdit(id:number){ navigate(`/operations/estimate/${id}`) }
  function handleDelete(row: Item){
    const status = String(row.status ?? '').trim().toUpperCase()
    if (status !== 'OPEN') {
      showToast('Only OPEN estimates can be deleted', 'error')
      return
    }

    setDeleteTargetId(row.id)
    setShowDeleteConfirm(true)
  }
  async function handlePrint(id:number){
    try {
      await openEstimateFormPdf(id)
    } catch (e:any) {
      showToast('Print failed: ' + (e?.message || 'Unknown error'), 'error')
    }
  }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{
      await deleteEstimate(deleteTargetId)
      setRows(r=>r.map(x=>x.id===deleteTargetId ? { ...x, status: 'DELETED' } : x))
      showToast('Record marked as deleted','success')
    }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setSearchTerm(''); setPage(0); setLoading(false) }
  }

  function TypePill({ t }: { t?: string }){
    const s = (t||'').toUpperCase()
    if (s === 'PACKAGE') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">PACKAGE</span>
    if (s === 'REGULAR') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600">REGULAR</span>
    return <span className="text-slate-400 text-xs">—</span>
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={FileText}
        title="Estimates"
        subtitle="Job estimates and quotations for customer vehicles"
        addLabel="Add Estimate"
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
                <th className="px-5 py-3">Estimate Date</th>
                <th className="px-5 py-3">Customer Name</th>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Plate No.</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState colSpan={showClientType ? 10 : 9} />}
              {paged.map(r=> (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{r.id}</td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={r.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm">
                    <ReferenceLinkButton value={r.referenceNo} onClick={() => handleEdit(r.id)} title="Open estimate" />
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(r.estimateDate)}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{r.customerName}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{r.vehicle}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 uppercase">{r.plateNo}</td>
                  <td className="px-5 py-4 align-middle"><TypePill t={r.estimateType} /></td>
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
