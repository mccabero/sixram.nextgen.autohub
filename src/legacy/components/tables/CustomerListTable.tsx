// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useLoading } from '../../contexts/loading'
import { Users, Phone, MapPin } from 'lucide-react'
import { fetchCustomers, deleteCustomerById } from '../../services/customerService'
import { useToast } from '../../contexts/toast'
import { formatPHMobile } from '../../utils/format'
import ConfirmModal from '../ui/ConfirmModal'
import {
  ListPageHeader,
  ClientTypeFilter,
  ListSearchInput,
  ListPagination,
  ListToolbar,
  ClientTypeBadge,
  RowActions,
  EmptyState,
} from '../lists'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

type ClientType = 'BOSCH' | 'CHANGAN'

export interface Customer {
  id: string
  clientType: ClientType
  name: string
  address: string
  mobile: string
}

type SortColumn = 'name' | 'mobile' | 'clientType'
type SortDirection = 'asc' | 'desc'

function getInitials(name: string){
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CustomerListTable(){
  const showClientType = useShowIsChanganOption()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { show, hide } = useLoading()
  const { showToast } = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | ClientType>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const location = useLocation()

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search)
      const q = params.get('q') ?? ''
      if (q && q !== searchTerm) {
        setSearchTerm(q)
        setPage(0)
      }
    } catch (e) {}
  }, [location.search])

  const counts = useMemo(() => {
    let bosch = 0
    let changan = 0
    for (const c of customers){
      if (c.clientType === 'BOSCH') bosch++
      else if (c.clientType === 'CHANGAN') changan++
    }
    return { all: customers.length, bosch, changan }
  }, [customers])

  const filtered = useMemo(()=>{
    const q = searchTerm.trim().toLowerCase()
    return customers.filter(c=>{
      if (selectedClientType !== 'ALL' && c.clientType !== selectedClientType) return false
      if (!q) return true
      return (
        (c.clientType || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.mobile || '').toLowerCase().includes(q)
      )
    })
  },[customers, selectedClientType, searchTerm])

  const filteredTotal = filtered.length

  const sorted = useMemo(()=>{
    const s = [...filtered]
    s.sort((a,b)=>{
      let av = ''
      let bv = ''
      if (sortColumn === 'name'){ av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      if (sortColumn === 'mobile'){ av = a.mobile; bv = b.mobile }
      if (sortColumn === 'clientType'){ av = a.clientType; bv = b.clientType }
      if (av < bv) return sortDirection === 'asc' ? -1 : 1
      if (av > bv) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return s
  },[filtered, sortColumn, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{
    const start = page * rowsPerPage
    return sorted.slice(start, start + rowsPerPage)
  },[sorted, page, rowsPerPage])

  useEffect(()=>{
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  },[pageCount])

  useEffect(()=>{
    const ctl = new AbortController()
    const load = async () => {
      setLoading(true)
      try { show() } catch {}
      try{
        const res = await fetchCustomers(ctl.signal)
        setCustomers(res.customers)
        setTotal(res.total)
      }catch(e){
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        if (err && err.name !== 'AbortError') {
          try { showToast('Failed to load customers: ' + (err?.message ?? 'Unknown error'), 'error') } catch {}
        }
        setCustomers([])
        setTotal(0)
      }finally{ setLoading(false); try { hide() } catch {} }
    }
    load()
    return () => ctl.abort()
  },[])

  function toggleSort(col: SortColumn){
    if (sortColumn === col) setSortDirection(d=> d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDirection('asc') }
  }

  function handleEdit(id: string | number){ navigate(`/customer/${id}`) }
  function handleDelete(id: number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true)
    try {
      setLoading(true)
      await deleteCustomerById(deleteTargetId)
      setCustomers(prev => prev.filter(c => String(c.id) !== String(deleteTargetId)))
      setTotal(t => Math.max(0, t - 1))
      try { showToast('Customer deleted successfully', 'success') } catch {}
    } catch (e:any) {
      const err = e as any
      if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) {
        try { logout() } catch {}
        navigate('/login')
        return
      }
      try { showToast('Failed to delete customer: ' + (err?.message ?? 'Unknown error'), 'error') } catch {}
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
      setSearchTerm('')
      setPage(0)
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Users}
        title="Customers"
        subtitle={showClientType ? 'Manage customer records, client types and contact details' : 'Manage customer records and contact details'}
        addLabel="Add Customer"
        onAdd={() => navigate('/customers/add')}
        stats={[{ label: 'Total', value: counts.all }]}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this customer?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }}
        loading={isDeleting}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={showClientType ? (
            <ClientTypeFilter
              value={selectedClientType}
              onChange={(k) => { setSelectedClientType(k as any); setPage(0) }}
              options={[
                { key: 'ALL', label: 'All', count: counts.all },
                { key: 'BOSCH', label: 'BOSCH', count: counts.bosch, activeClass: 'bg-amber-500 text-white' },
                { key: 'CHANGAN', label: 'CHANGAN', count: counts.changan, activeClass: 'bg-sky-500 text-white' },
              ]}
            />
          ) : null}
          right={
            <ListSearchInput
              value={searchTerm}
              onChange={(v) => { setSearchTerm(v); setPage(0) }}
              placeholder="Search name, mobile, address…"
            />
          }
        />

        {/* Desktop / tablet: table */}
        <div className="hidden sm:block overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                {showClientType && (
                  <th className="px-5 py-3 cursor-pointer select-none" onClick={()=>toggleSort('clientType')}>
                    <span className="inline-flex items-center gap-1">Client Type{sortColumn==='clientType' && <span className="text-slate-400">{sortDirection==='asc'?'↑':'↓'}</span>}</span>
                  </th>
                )}
                <th className="px-5 py-3 cursor-pointer select-none" onClick={()=>toggleSort('name')}>
                  <span className="inline-flex items-center gap-1">Customer{sortColumn==='name' && <span className="text-slate-400">{sortDirection==='asc'?'↑':'↓'}</span>}</span>
                </th>
                <th className="px-5 py-3">Home Address</th>
                <th className="px-5 py-3 cursor-pointer select-none" onClick={()=>toggleSort('mobile')}>
                  <span className="inline-flex items-center gap-1">Mobile Number{sortColumn==='mobile' && <span className="text-slate-400">{sortDirection==='asc'?'↑':'↓'}</span>}</span>
                </th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Users} title="No customers found" colSpan={showClientType ? 6 : 5} />}
              {paged.map(c=> (
                <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{c.id}</td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={c.clientType} /></td>}
                  <td className="px-5 py-4 align-middle">
                    <button onClick={()=>navigate(`/customer/${c.id}`)} className="group inline-flex items-center gap-3 text-left">
                      <span className={
                        'h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm ' +
                        (c.clientType === 'CHANGAN'
                          ? 'bg-gradient-to-br from-sky-500 to-indigo-500'
                          : 'bg-gradient-to-br from-amber-500 to-orange-500')
                      }>
                        {getInitials(c.name)}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{c.name}</span>
                        <span className="text-[11px] text-slate-400">Click to view profile</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 max-w-md">
                    <div className="inline-flex items-start gap-1.5">
                      <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{c.address || <span className="text-slate-400 italic">—</span>}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-300">
                    <div className="inline-flex items-center gap-1.5">
                      <Phone size={14} className="text-slate-400" />
                      <span className="font-medium tabular-nums">{formatPHMobile(c.mobile) || <span className="text-slate-400 italic">—</span>}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => handleEdit(c.id), label: `edit-${c.id}` },
                      { kind: 'delete', onClick: () => handleDelete(Number(c.id)), label: `delete-${c.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="sm:hidden">
          {paged.length === 0 && <EmptyState icon={Users} title="No customers found" />}
          <div className="flex flex-col gap-3 p-3">
            {paged.map(c=> (
              <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={()=>navigate(`/customer/${c.id}`)} className="flex items-start gap-3 flex-1 text-left">
                    <span className={
                      'h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm ' +
                      (c.clientType === 'CHANGAN'
                        ? 'bg-gradient-to-br from-sky-500 to-indigo-500'
                        : 'bg-gradient-to-br from-amber-500 to-orange-500')
                    }>{getInitials(c.name)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100 truncate">{c.name}</span>
                        {showClientType && <ClientTypeBadge type={c.clientType} />}
                      </div>
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{c.address || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-300">
                        <Phone size={12} className="text-slate-400" />
                        <span className="font-medium tabular-nums">{formatPHMobile(c.mobile) || '—'}</span>
                      </div>
                    </div>
                  </button>
                  <RowActions actions={[
                    { kind: 'edit', onClick: () => handleEdit(c.id), label: `edit-${c.id}` },
                    { kind: 'delete', onClick: () => handleDelete(Number(c.id)), label: `delete-${c.id}` },
                  ]} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ListPagination
          page={page}
          pageCount={pageCount}
          rowsPerPage={rowsPerPage}
          total={filteredTotal}
          onPageChange={setPage}
          onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0) }}
        />
      </div>
    </div>
  )
}
