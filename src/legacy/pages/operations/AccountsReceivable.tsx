// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, FileCheck } from 'lucide-react'
import { currency, formatShortDate } from '../../utils/format'
import { useToast } from '../../contexts/toast'
import { getAccountsReceivableSummary } from '../../services/operationService'
import {
  ClientTypeBadge,
  ClientTypeFilter,
  EmptyState,
  ListPageHeader,
  ListPagination,
  ListSearchInput,
  ListToolbar,
  ReferenceLinkButton,
  StatusBadge,
} from '../../components/lists'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

type AgingFilter = 'ALL' | 'OVERDUE' | 'CURRENT'

type AccountsReceivableRow = {
  invoiceId: number
  customerId: number
  clientType: string
  invoiceDate: string
  dueDate: string
  customerName: string
  invoiceNo: string
  jobOrderNo: string
  invoiceAmount: number
  discountAmount: number
  depositAmount: number
  paidAmount: number
  balanceDue: number
  daysOutstanding: number
  daysOverdue: number
  status: string
}

function mapReceivableRow(item: any): AccountsReceivableRow {
  const isChangan = Boolean(item.isChangan ?? item.IsChangan ?? false)
  return {
    invoiceId: Number(item.invoiceId ?? item.InvoiceId ?? item.id ?? item.Id ?? 0) || 0,
    customerId: Number(item.customerId ?? item.CustomerId ?? 0) || 0,
    clientType: String(item.clientType ?? item.ClientType ?? (isChangan ? 'CHANGAN' : 'BOSCH')),
    invoiceDate: String(item.invoiceDate ?? item.InvoiceDate ?? ''),
    dueDate: String(item.dueDate ?? item.DueDate ?? ''),
    customerName: String(item.customerName ?? item.CustomerName ?? ''),
    invoiceNo: String(item.invoiceNo ?? item.InvoiceNo ?? ''),
    jobOrderNo: String(item.jobOrderNo ?? item.JobOrderNo ?? ''),
    invoiceAmount: Number(item.invoiceAmount ?? item.InvoiceAmount ?? 0) || 0,
    discountAmount: Number(item.discountAmount ?? item.DiscountAmount ?? 0) || 0,
    depositAmount: Number(item.depositAmount ?? item.DepositAmount ?? 0) || 0,
    paidAmount: Number(item.paidAmount ?? item.PaidAmount ?? 0) || 0,
    balanceDue: Number(item.balanceDue ?? item.BalanceDue ?? 0) || 0,
    daysOutstanding: Number(item.daysOutstanding ?? item.DaysOutstanding ?? 0) || 0,
    daysOverdue: Number(item.daysOverdue ?? item.DaysOverdue ?? 0) || 0,
    status: String(item.status ?? item.Status ?? ''),
  }
}

export default function AccountsReceivable() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const showClientType = useShowIsChanganOption()
  const [rows, setRows] = useState<AccountsReceivableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | 'BOSCH' | 'CHANGAN'>('ALL')
  const [agingFilter, setAgingFilter] = useState<AgingFilter>('ALL')

  useEffect(() => {
    let mounted = true

    async function loadRows() {
      setLoading(true)
      try {
        const result = await getAccountsReceivableSummary()
        if (!mounted) return
        setRows((Array.isArray(result) ? result : []).map(mapReceivableRow).filter(row => row.invoiceId && row.balanceDue > 0))
      } catch (error) {
        if (mounted) setRows([])
        showToast(error instanceof Error ? error.message : 'Failed to load accounts receivable', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadRows()
    return () => {
      mounted = false
    }
  }, [showToast])

  const counts = useMemo(() => {
    let bosch = 0
    let changan = 0
    let overdue = 0
    let current = 0
    let balance = 0

    for (const row of rows) {
      const clientType = row.clientType.toUpperCase()
      if (clientType === 'CHANGAN') changan += 1
      else bosch += 1
      if (row.daysOverdue > 0) overdue += 1
      else current += 1
      balance += row.balanceDue
    }

    return { all: rows.length, bosch, changan, overdue, current, balance }
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return rows.filter(row => {
      if (selectedClientType !== 'ALL' && row.clientType.toUpperCase() !== selectedClientType) return false
      if (agingFilter === 'OVERDUE' && row.daysOverdue <= 0) return false
      if (agingFilter === 'CURRENT' && row.daysOverdue > 0) return false
      if (!q) return true
      return (
        row.invoiceNo.toLowerCase().includes(q)
        || row.jobOrderNo.toLowerCase().includes(q)
        || row.customerName.toLowerCase().includes(q)
      )
    })
  }, [agingFilter, rows, searchTerm, selectedClientType])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  function openInvoice(invoiceId: number) {
    navigate(`/operations/invoice/${invoiceId}`)
  }

  function collectPayment(row: AccountsReceivableRow) {
    navigate('/operations/payment/add', {
      state: {
        sourceInvoiceId: String(row.invoiceId),
        sourceCustomerId: String(row.customerId),
        fromAccountsReceivable: true,
      },
    })
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={CreditCard}
        title="Accounts Receivable"
        subtitle="Open customer balances from invoices, deposits, discounts, and payments"
        iconGradient="from-emerald-500 to-sky-500"
        stats={[
          { label: 'Open', value: counts.all },
          { label: 'Overdue', value: counts.overdue, tone: counts.overdue > 0 ? 'rose' : 'default' },
          { label: 'Balance', value: currency(counts.balance), tone: 'emerald' },
        ]}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={(
            <div className="flex flex-wrap items-center gap-2">
              {showClientType && (
                <ClientTypeFilter
                  value={selectedClientType}
                  onChange={(type) => { setSelectedClientType(type as any); setPage(0) }}
                  options={[
                    { key: 'ALL', label: 'All', count: counts.all },
                    { key: 'BOSCH', label: 'BOSCH', count: counts.bosch, activeClass: 'bg-amber-500 text-white' },
                    { key: 'CHANGAN', label: 'CHANGAN', count: counts.changan, activeClass: 'bg-sky-500 text-white' },
                  ]}
                />
              )}
              <ClientTypeFilter<AgingFilter>
                label="Aging"
                value={agingFilter}
                onChange={(filter) => { setAgingFilter(filter); setPage(0) }}
                options={[
                  { key: 'ALL', label: 'All', count: counts.all },
                  { key: 'OVERDUE', label: 'Overdue', count: counts.overdue, activeClass: 'bg-rose-500 text-white' },
                  { key: 'CURRENT', label: 'Current', count: counts.current, activeClass: 'bg-emerald-500 text-white' },
                ]}
              />
            </div>
          )}
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search invoice, customer, JO..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3">Invoice No.</th>
                {showClientType && <th className="px-5 py-3">Client Type</th>}
                <th className="px-5 py-3">Invoice Date</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">JO No.</th>
                <th className="px-5 py-3 text-right">Invoice</th>
                <th className="px-5 py-3 text-right">Discount</th>
                <th className="px-5 py-3 text-right">Deposit</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3 text-right">Overdue</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <EmptyState
                  colSpan={showClientType ? 14 : 13}
                  title={loading ? 'Loading accounts receivable...' : 'No accounts receivable found'}
                  hint="Try changing the aging filter, client type, or search term"
                />
              )}
              {paged.map(row => (
                <tr key={row.invoiceId} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm">
                    <ReferenceLinkButton value={row.invoiceNo} onClick={() => openInvoice(row.invoiceId)} title="Open invoice" />
                  </td>
                  {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={row.clientType} /></td>}
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{formatShortDate(row.invoiceDate)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.dueDate ? formatShortDate(row.dueDate) : '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">{row.customerName || '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.jobOrderNo || '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right tabular-nums text-slate-700 dark:text-slate-300">{currency(row.invoiceAmount)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{currency(row.discountAmount)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{currency(row.depositAmount)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right tabular-nums text-emerald-700 dark:text-emerald-400">{currency(row.paidAmount)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{currency(row.balanceDue)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{row.daysOverdue > 0 ? `${row.daysOverdue}d` : '-'}</td>
                  <td className="px-5 py-4 align-middle"><StatusBadge status={row.status} /></td>
                  <td className="px-5 py-4 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => collectPayment(row)}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                    >
                      <FileCheck size={15} />
                      Collect
                    </button>
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
