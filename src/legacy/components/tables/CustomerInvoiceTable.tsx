// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCheck } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { currency, formatShortDate } from '../../utils/format'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteInvoice, getInvoicesSummary, openInvoiceReportPdf } from '../../services/operationService'
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

interface InvoiceRow {
  id: number
  customerId?: string | number
  clientType: string
  invoiceNo: string
  invoiceDate: string
  customerName: string
  joNo: string
  amount: number
  deposit: number
  invoiceType: string
  status: string
}

function parseBool(x: any) {
  return x === true || x === 'true' || x === 1 || x === '1' || x === 'True' || x === 'TRUE'
}

function toNumber(value: any) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function mapItem(it: any): InvoiceRow {
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
    customerId: it.customerId ?? it.CustomerId ?? it.customer?.id ?? it.customer?.customerId ?? it.customer?.customer_id,
    clientType: String(clientType || ''),
    invoiceNo: String(it.invoiceNo ?? it.invoice_number ?? it.number ?? ''),
    invoiceDate: String(it.invoiceDate ?? it.date ?? it.invoice_date ?? ''),
    customerName,
    joNo: String(it.jobOrder ?? it.joNo ?? it.jo_number ?? it.jobOrderNo ?? ''),
    amount: toNumber(it.totalAmount ?? it.amount ?? it.total),
    deposit: toNumber(it.depositAmount ?? it.deposit),
    invoiceType: typeof it.isPackage !== 'undefined'
      ? (it.isPackage ? 'PACKAGE' : 'REGULAR')
      : typeof it.is_package !== 'undefined'
        ? (it.is_package ? 'PACKAGE' : 'REGULAR')
        : typeof it.IsPackage !== 'undefined'
          ? (it.IsPackage ? 'PACKAGE' : 'REGULAR')
          : String(it.invoiceType ?? it.type ?? ''),
    status: String(
      (it.jobStatus && (it.jobStatus.name || it.jobStatus.status || it.jobStatus.Name))
        ? (it.jobStatus.name ?? it.jobStatus.status ?? it.jobStatus.Name)
        : (it.status ?? it.statusName ?? it.status_name ?? '')
    ),
  }
}

function matchesCustomer(row: InvoiceRow, customerId: string | number) {
  const target = String(customerId ?? '').trim()
  const current = String(row.customerId ?? '').trim()
  return current === target
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

export default function CustomerInvoiceTable({ customerId }: { customerId?: string | number }) {
  const showClientType = useShowIsChanganOption()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { logout } = useAuth()

  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | 'BOSCH' | 'CHANGAN'>('ALL')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!customerId) {
      setRows([])
      return
    }

    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const data = await getInvoicesSummary()
        if (!mounted) return

        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.invoices)
              ? data.invoices
              : []

        const mapped = list
          .map(mapItem)
          .filter((item: InvoiceRow) => matchesCustomer(item, customerId))

        mapped.sort((a, b) => {
          const pa = Date.parse(String(a.invoiceDate || ''))
          const pb = Date.parse(String(b.invoiceDate || ''))
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
        showToast('Failed to load customer invoices', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [customerId, logout, navigate, showToast])

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
        String(row.invoiceNo || '').toLowerCase().includes(q) ||
        String(row.customerName || '').toLowerCase().includes(q) ||
        String(row.joNo || '').toLowerCase().includes(q)
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
    navigate(`/operations/invoice/${id}`)
  }

  function handleDelete(row: InvoiceRow) {
    const status = String(row.status ?? '').trim().toUpperCase()
    if (status !== 'OPEN') {
      showToast('Only OPEN invoices can be deleted', 'error')
      return
    }
    setDeleteTargetId(row.id)
    setShowDeleteConfirm(true)
  }

  async function handlePrint(id: number) {
    try {
      await openInvoiceReportPdf(id)
    } catch (error: any) {
      showToast(error instanceof Error ? error.message : 'Failed to print invoice report', 'error')
    }
  }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    setLoading(true)
    try {
      await deleteInvoice(deleteTargetId)
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
        icon={FileCheck}
        title="Customer Invoices"
        subtitle="Invoices created for the selected customer"
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
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search invoice, customer, JO..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                {showClientType && <th className="px-5 py-3">Client Type</th>}
                <th className="px-5 py-3">Invoice No.</th>
                <th className="px-5 py-3">Invoice Date</th>
                <th className="px-5 py-3">Customer Name</th>
                <th className="px-5 py-3">JO No.</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Deposit</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState colSpan={showClientType ? 11 : 10} title="No invoices found" description="This customer does not have matching invoice records yet." />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{row.id}</td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={row.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-300 font-medium">{row.invoiceNo}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(row.invoiceDate)}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{row.customerName}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.joNo}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{currency(row.amount)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-600 dark:text-slate-300 tabular-nums">{currency(row.deposit)}</td>
                  <td className="px-5 py-4 align-middle"><TypePill type={row.invoiceType} /></td>
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

        <ListPagination
          page={page}
          pageCount={pageCount}
          rowsPerPage={rowsPerPage}
          total={filteredTotal}
          onPageChange={setPage}
          onRowsPerPageChange={(value) => { setRowsPerPage(value); setPage(0) }}
        />
      </div>
    </div>
  )
}
