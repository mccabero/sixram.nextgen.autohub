// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { formatShortDate } from '../../utils/format'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteJobOrder, getJobOrdersSummary, openJobOrderFormPdf } from '../../services/operationService'
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
} from '../lists'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

interface JobOrderRow {
  id: number
  clientType: string
  referenceNo: string
  joDate: string
  customerName: string
  vehicle: string
  plateNo: string
  jobOrderType: string
  status: string
}

function toStr(v: any) {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object') return String(v.plateNo ?? v.plateNumber ?? v.model ?? v.name ?? v.id ?? '')
  return String(v)
}

function parseBool(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1' || x === 'True' || x === 'TRUE'
}

function mapItem(it: any): JobOrderRow {
  const make = it?.vehicle?.vehicleModel?.vehicleMake?.name
    ?? it?.vehicleModel?.vehicleMake?.name
    ?? it?.vehicleModel?.vehicleMake?.Name
    ?? it?.vehicleModel?.make
    ?? it.vehicleMake
    ?? (it.vehicleMake && it.vehicleMake.name)
    ?? null
  const model = it?.vehicle?.vehicleModel?.name
    ?? it?.vehicleModel?.name
    ?? it?.vehicleModel?.model
    ?? it.model
    ?? null
  const vehicleLabel = [make, model].filter(Boolean).join(' ').trim()
    || toStr(it.vehicle ?? it.vehicleName ?? it.model ?? it.vehicleInfo ?? '')

  const rawIsCh = it.isChangan ?? it.is_changan ?? it.IsChangan
  const clientType = (typeof rawIsCh !== 'undefined' && rawIsCh !== null)
    ? (parseBool(rawIsCh) ? 'CHANGAN' : 'BOSCH')
    : (it.clientType ?? it.client_type ?? it.client ?? '')

  const customerName = (() => {
    if (it.customer == null) return String(it.customerName ?? `${it.firstName || ''} ${it.lastName || ''}`.trim())
    if (typeof it.customer === 'string' || typeof it.customer === 'number') return String(it.customer)
    if (typeof it.customer === 'object') {
      const first = it.customer.firstName ?? it.customer.first_name ?? ''
      const last = it.customer.lastName ?? it.customer.last_name ?? ''
      if (first || last) return `${first} ${last}`.trim()
      if (it.customer.name) return String(it.customer.name)
    }
    return String(it.customerName ?? `${it.firstName || ''} ${it.lastName || ''}`.trim())
  })()

  return {
    id: Number(it.id ?? it.Id ?? 0),
    clientType: String(clientType || ''),
    referenceNo: String(it.referenceNo ?? it.refNo ?? it.reference ?? ''),
    joDate: String(it.transactionDate ?? it.transactionDateTime ?? it.date ?? it.joDate ?? it.jo_date ?? ''),
    customerName,
    vehicle: vehicleLabel,
    plateNo: toStr(it.plateNo ?? it.plateNumber ?? it.plate ?? (it.vehicle && it.vehicle.plateNo) ?? ''),
    jobOrderType: typeof it.isPackage !== 'undefined'
      ? (it.isPackage ? 'PACKAGE' : 'REGULAR')
      : typeof it.is_package !== 'undefined'
        ? (it.is_package ? 'PACKAGE' : 'REGULAR')
        : typeof it.IsPackage !== 'undefined'
          ? (it.IsPackage ? 'PACKAGE' : 'REGULAR')
          : String(it.jobOrderType ?? it.type ?? ''),
    status: String(
      (it.jobStatus && (it.jobStatus.name || it.jobStatus.status || it.jobStatus.Name))
        ? (it.jobStatus.name ?? it.jobStatus.status ?? it.jobStatus.Name)
        : (it.status ?? it.statusName ?? it.status_name ?? '')
    ),
  }
}

function extractPackageIds(item: any): string[] {
  const direct = Array.isArray(item?.PackageIds) ? item.PackageIds : (Array.isArray(item?.packageIds) ? item.packageIds : [])
  const ids = new Set<string>()
  for (const id of direct) {
    if (id != null && String(id).trim()) ids.add(String(id))
  }
  return Array.from(ids)
}

function TypePill({ type }: { type?: string }) {
  const normalized = String(type ?? '').toUpperCase()
  if (normalized === 'PACKAGE') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">PACKAGE</span>
  }
  if (normalized === 'REGULAR') {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600">REGULAR</span>
  }
  return <span className="text-slate-400 text-xs">-</span>
}

export default function PackageJobOrderTable({ packageId }: { packageId?: string | number }) {
  const showClientType = useShowIsChanganOption()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { logout } = useAuth()

  const [rows, setRows] = useState<JobOrderRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | 'BOSCH' | 'CHANGAN'>('ALL')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!packageId) {
      setRows([])
      return
    }

    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const data = await getJobOrdersSummary()
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.jobOrders)
              ? data.jobOrders
              : []

        const matches = list
          .filter((item: any) => extractPackageIds(item).includes(String(packageId)))
          .map(mapItem)

        if (!mounted) return

        const mapped = matches.filter((item): item is JobOrderRow => item != null)
        mapped.sort((a, b) => {
          const pa = Date.parse(String(a.joDate || ''))
          const pb = Date.parse(String(b.joDate || ''))
          const ta = Number.isFinite(pa) && !isNaN(pa) ? pa : 0
          const tb = Number.isFinite(pb) && !isNaN(pb) ? pb : 0
          const byDate = tb - ta
          if (byDate !== 0) return byDate
          return (b.id || 0) - (a.id || 0)
        })

        setRows(mapped)
      } catch (error: any) {
        if (!mounted) return
        const message = String(error?.message ?? '')
        if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        setRows([])
        showToast('Failed to load package transactions', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [packageId, logout, navigate, showToast])

  const counts = useMemo(() => {
    let bosch = 0
    let changan = 0
    for (const row of rows) {
      const ct = String(row.clientType || '').toUpperCase()
      if (ct === 'BOSCH') bosch++
      else if (ct === 'CHANGAN') changan++
    }
    return { all: rows.length, bosch, changan }
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return rows.filter(row => {
      const ct = String(row.clientType ?? '').trim().toUpperCase()
      if (selectedClientType !== 'ALL' && ct !== selectedClientType) return false
      if (!q) return true
      return (
        String(row.referenceNo || '').toLowerCase().includes(q) ||
        String(row.customerName || '').toLowerCase().includes(q) ||
        String(row.vehicle || '').toLowerCase().includes(q) ||
        String(row.plateNo || '').toLowerCase().includes(q)
      )
    })
  }, [rows, searchTerm, selectedClientType])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [pageCount, page])

  function handleEdit(id: number) {
    navigate(`/operations/job-order/${id}`)
  }

  function handleDelete(row: JobOrderRow) {
    const status = String(row.status ?? '').trim().toUpperCase()
    if (status !== 'OPEN') {
      showToast('Only OPEN job orders can be deleted', 'error')
      return
    }
    setDeleteTargetId(row.id)
    setShowDeleteConfirm(true)
  }

  async function handlePrint(id: number) {
    try {
      await openJobOrderFormPdf(id)
    } catch (error: any) {
      showToast(error instanceof Error ? error.message : 'Failed to print job order form', 'error')
    }
  }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    setLoading(true)
    try {
      await deleteJobOrder(deleteTargetId)
      setRows(current => current.map(row => row.id === deleteTargetId ? { ...row, status: 'DELETED' } : row))
      showToast('Record marked as deleted', 'success')
    } catch (error: any) {
      showToast('Delete failed: ' + (error?.message || 'Unknown'), 'error')
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
        icon={Wrench}
        title="Package Transactions"
        subtitle="Job orders that used the selected package"
        stats={[{ label: 'Total', value: counts.all }]}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirm Delete"
        message="Are you sure you want to delete this record?"
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
              onChange={(value) => { setSelectedClientType(value as any); setPage(0) }}
              options={[
                { key: 'ALL', label: 'All', count: counts.all },
                { key: 'BOSCH', label: 'BOSCH', count: counts.bosch, activeClass: 'bg-amber-500 text-white' },
                { key: 'CHANGAN', label: 'CHANGAN', count: counts.changan, activeClass: 'bg-sky-500 text-white' },
              ]}
            />
          ) : null}
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search reference, customer, plate..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                {showClientType && <th className="px-5 py-3">Client Type</th>}
                <th className="px-5 py-3">Reference No.</th>
                <th className="px-5 py-3">JO Date</th>
                <th className="px-5 py-3">Customer Name</th>
                <th className="px-5 py-3">Vehicle</th>
                <th className="px-5 py-3">Plate No.</th>
                <th className="px-5 py-3">JO Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState colSpan={showClientType ? 10 : 9} title="No job orders found" description="This package has not been used in any job orders yet." />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{row.id}</td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={row.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-300 font-medium">{row.referenceNo}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(row.joDate)}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{row.customerName}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.vehicle}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 uppercase">{row.plateNo}</td>
                  <td className="px-5 py-4 align-middle"><TypePill type={row.jobOrderType} /></td>
                  <td className="px-5 py-4 align-middle"><StatusBadge status={row.status} /></td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => handleEdit(row.id), label: `edit-${row.id}` },
                      { kind: 'print', onClick: () => handlePrint(row.id), label: `print-${row.id}` },
                      { kind: 'delete', onClick: () => handleDelete(row), label: `delete-${row.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0) }} />
      </div>
    </div>
  )
}
