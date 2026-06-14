// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useLoading } from '../../contexts/loading'
import ConfirmModal from '../ui/ConfirmModal'
import { Car, Phone, Hash, User } from 'lucide-react'
import { fetchVehicles, fetchVehiclesByCustomer, deleteVehicle } from '../../services/vehicleService'
import { useToast } from '../../contexts/toast'
import { formatPHMobile } from '../../utils/format'
import {
  ListPageHeader,
  ClientTypeFilter,
  ListSearchInput,
  ListToolbar,
  ListPagination,
  ClientTypeBadge,
  RowActions,
  EmptyState,
} from '../lists'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

export interface Vehicle {
  id: number
  clientType: 'BOSCH' | 'CHANGAN'
  plate: string
  make: string
  model: string
  vehicleModelId?: number
  vin?: string
  engineNo?: string
  chasisNo?: string
  transmissionParameterId?: number
  engineTypeParameterId?: number
  engineSizeParameterId?: number
  odometerParameterId?: number
  customerRegistrationTypeParameterId?: number
  customerName: string
  customerId?: number | string
  mobile: string
}

type SortColumn = 'customerName' | 'mobile' | 'clientType' | 'plate' | 'model'
type SortDirection = 'asc' | 'desc'

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function VehicleListTable({ vehicles, customerId }: { vehicles?: Vehicle[]; customerId?: string | number }) {
  const showClientType = useShowIsChanganOption()
  const inCustomerView = typeof customerId !== 'undefined' && customerId !== null && String(customerId) !== 'add'
  const navigate = useNavigate()
  const { logout, role } = useAuth()
  const { showToast } = useToast()
  const { show, hide } = useLoading()
  const [rows, setRows] = useState<Vehicle[]>((vehicles ?? []))
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | Vehicle['clientType']>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('customerName')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => { setRows(vehicles ?? []) }, [vehicles])

  useEffect(() => {
    const ctl = new AbortController()
    const load = async () => {
      setLoading(true)
      try { show() } catch {}
      try {
        let items: Vehicle[]
        if (typeof customerId !== 'undefined' && customerId !== null && String(customerId) !== 'add') {
          const res = await fetchVehiclesByCustomer(customerId, ctl.signal)
          items = res.vehicles
        } else {
          const res = await fetchVehicles(ctl.signal)
          items = res.vehicles
        }
        setRows(items)
      } catch (e) {
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        if (err && err.name !== 'AbortError') {
          try { showToast('Failed to load vehicles: ' + (err?.message ?? 'Unknown error'), 'error') } catch {}
        }
        setRows([])
      } finally {
        setLoading(false)
        try { hide() } catch {}
      }
    }
    load()
    return () => ctl.abort()
  }, [customerId, hide, logout, navigate, show, showToast])

  const counts = useMemo(() => {
    let bosch = 0
    let changan = 0
    for (const r of rows) {
      if (r.clientType === 'BOSCH') bosch++
      else if (r.clientType === 'CHANGAN') changan++
    }
    return { all: rows.length, bosch, changan }
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return rows.filter(v => {
      if (selectedClientType !== 'ALL' && v.clientType !== selectedClientType) return false
      if (!q) return true
      return (
        String(v.id || '').includes(q) ||
        String(v.clientType || '').toLowerCase().includes(q) ||
        String(v.plate || '').toLowerCase().includes(q) ||
        String(v.model || '').toLowerCase().includes(q) ||
        String(v.customerName || '').toLowerCase().includes(q) ||
        String(v.mobile || '').toLowerCase().includes(q)
      )
    })
  }, [rows, selectedClientType, searchTerm])

  const filteredTotal = filtered.length

  const sorted = useMemo(() => {
    const s = [...filtered]
    s.sort((a, b) => {
      let av = ''
      let bv = ''
      if (sortColumn === 'customerName') { av = a.customerName.toLowerCase(); bv = b.customerName.toLowerCase() }
      if (sortColumn === 'mobile') { av = a.mobile; bv = b.mobile }
      if (sortColumn === 'clientType') { av = a.clientType; bv = b.clientType }
      if (sortColumn === 'plate') { av = a.plate.toLowerCase(); bv = b.plate.toLowerCase() }
      if (sortColumn === 'model') { av = a.model.toLowerCase(); bv = b.model.toLowerCase() }
      if (av < bv) return sortDirection === 'asc' ? -1 : 1
      if (av > bv) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return s
  }, [filtered, sortColumn, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return sorted.slice(start, start + rowsPerPage)
  }, [sorted, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [pageCount, page])

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDirection('asc') }
  }

  function handleEdit(id: number) { navigate(`/vehicles/${id}`) }
  function handleDelete(id: number) { setDeleteTargetId(id); setShowDeleteConfirm(true) }

  function handleAdd() {
    if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return }
    if (inCustomerView) {
      navigate(`/vehicles/add?customerId=${encodeURIComponent(String(customerId))}`)
      return
    }
    navigate('/vehicles/add')
  }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    try {
      await deleteVehicle(deleteTargetId)
      setRows(r => r.filter(x => x.id !== deleteTargetId))
      showToast('Vehicle deleted', 'success')
    } catch (e: any) {
      showToast('Delete failed: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
      setSearchTerm('')
      setPage(0)
    }
  }

  const header = (
    <ListPageHeader
      icon={Car}
      title={inCustomerView ? 'Customer Vehicles' : 'Vehicles'}
      subtitle={inCustomerView ? 'Vehicles registered under the selected customer' : 'Customer vehicle registry and service records'}
      addLabel="Add Vehicle"
      onAdd={handleAdd}
      stats={[{ label: 'Total', value: counts.all }]}
    />
  )

  return (
    <div className="w-full">
      {header}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this vehicle?"
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
          right={<ListSearchInput value={searchTerm} onChange={(v) => { setSearchTerm(v); setPage(0) }} placeholder={inCustomerView ? 'Search plate, model...' : 'Search plate, model, customer...'} />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                {showClientType && (
                  <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('clientType')}>
                    <span className="inline-flex items-center gap-1">Client Type{sortColumn === 'clientType' && <span className="text-slate-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</span>
                  </th>
                )}
                <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('model')}>
                  <span className="inline-flex items-center gap-1">{inCustomerView ? 'Vehicle' : 'Vehicle Model'}{sortColumn === 'model' && <span className="text-slate-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</span>
                </th>
                <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('plate')}>
                  <span className="inline-flex items-center gap-1">Plate No.{sortColumn === 'plate' && <span className="text-slate-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</span>
                </th>
                {!inCustomerView && (
                  <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('customerName')}>
                    <span className="inline-flex items-center gap-1">Customer Name{sortColumn === 'customerName' && <span className="text-slate-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</span>
                  </th>
                )}
                {!inCustomerView && (
                  <th className="px-5 py-3 cursor-pointer select-none" onClick={() => toggleSort('mobile')}>
                    <span className="inline-flex items-center gap-1">Mobile Number{sortColumn === 'mobile' && <span className="text-slate-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</span>
                  </th>
                )}
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Car} title="No vehicles found" description={inCustomerView ? 'This customer does not have matching vehicle records yet.' : undefined} colSpan={showClientType ? (inCustomerView ? 5 : 7) : (inCustomerView ? 4 : 6)} />}
              {paged.map(v => (
                <tr key={v.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">
                    <button onClick={() => handleEdit(v.id)} className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">#{v.id}</button>
                  </td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={v.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm">
                    <button
                      onClick={() => handleEdit(v.id)}
                      className="group inline-flex items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100 transition-colors group-hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20 dark:group-hover:bg-sky-500/20">
                        <Car size={18} />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {v.model || <span className="text-slate-400 italic">-</span>}
                        </span>
                        <span className="text-[11px] text-slate-400">Click to view vehicle</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <span className="inline-flex items-center gap-1.5">
                      <Hash size={14} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">{v.plate || <span className="text-slate-400 italic">-</span>}</span>
                    </span>
                  </td>
                  {!inCustomerView && (
                    <td className="px-5 py-4 align-middle">
                      {v.customerName ? (
                        <button
                          onClick={() => {
                            if (v.customerId) navigate(`/customer/${v.customerId}`)
                            else navigate(`/customers?q=${encodeURIComponent(String(v.customerName))}`)
                          }}
                          className="group inline-flex items-center gap-3 text-left"
                        >
                          <span className={
                            'h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm ' +
                            (v.clientType === 'CHANGAN'
                              ? 'bg-gradient-to-br from-sky-500 to-indigo-500'
                              : 'bg-gradient-to-br from-amber-500 to-orange-500')
                          }>
                            {getInitials(v.customerName)}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{v.customerName}</span>
                            <span className="text-[11px] text-slate-400">Click to view profile</span>
                          </span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          <span className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-400">
                            <User size={14} />
                          </span>
                          <span className="text-sm text-slate-400 italic">-</span>
                        </span>
                      )}
                    </td>
                  )}
                  {!inCustomerView && (
                    <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-300">
                      <div className="inline-flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400" />
                        <span className="font-medium tabular-nums">{formatPHMobile(v.mobile) || <span className="text-slate-400 italic">-</span>}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => handleEdit(v.id), label: `edit-${v.id}` },
                      { kind: 'delete', onClick: () => handleDelete(v.id), label: `delete-${v.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!inCustomerView && <div className="sm:hidden">
          {paged.length === 0 && <EmptyState icon={Car} title="No vehicles found" />}
          <div className="flex flex-col gap-3 p-3">
            {paged.map(v => (
              <div key={v.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => handleEdit(v.id)} className="flex items-start gap-3 flex-1 text-left">
                    <span className={
                      'h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm ' +
                      (v.clientType === 'CHANGAN'
                        ? 'bg-gradient-to-br from-sky-500 to-indigo-500'
                        : 'bg-gradient-to-br from-amber-500 to-orange-500')
                    }>
                      {v.customerName ? getInitials(v.customerName) : <Car size={16} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold uppercase text-slate-900 dark:text-slate-100 truncate">{v.customerName || '-'}</span>
                        {showClientType && <ClientTypeBadge type={v.clientType} />}
                      </div>
                      <div className="flex items-start gap-2.5 mt-1.5">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20">
                          <Car size={16} />
                        </span>
                        <span className="min-w-0 flex flex-col">
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{v.model || '-'}</span>
                          <span className="text-[11px] text-slate-400">Click to view vehicle</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-300">
                        <Hash size={12} className="text-slate-400" />
                        <span className="font-semibold uppercase tracking-wide">{v.plate || '-'}</span>
                      </div>
                      {!inCustomerView && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-300">
                          <Phone size={12} className="text-slate-400" />
                          <span className="font-medium tabular-nums">{formatPHMobile(v.mobile) || '-'}</span>
                        </div>
                      )}
                    </div>
                  </button>
                  <RowActions actions={[
                    { kind: 'edit', onClick: () => handleEdit(v.id), label: `edit-${v.id}` },
                    { kind: 'delete', onClick: () => handleDelete(v.id), label: `delete-${v.id}` },
                  ]} />
                </div>
              </div>
            ))}
          </div>
        </div>}

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0) }} />
      </div>
    </div>
  )
}
