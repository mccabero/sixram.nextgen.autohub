// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Award, DollarSign, MoreHorizontal, Warehouse, CreditCard } from 'lucide-react'
import DateRangePicker from '../components/ui/DateRangePicker'
import { useToast } from '../contexts/toast'
import { getParametersByGroup } from '../services/configService'
import { openInventoryCheckReportPdf, openInventoryProductsReportPdf } from '../services/managementService'
import {
  openAccountsReceivableDailyReportPdf,
  openAccountsReceivableMonthlyReportPdf,
  openCommissionsSAReportPdf,
  openCommissionsTechReportPdf,
  openCreditCardPaymentReportPdf,
  openDailySalesReportPdf,
  openIncentivesSAReportPdf,
  openIncentivesTechReportPdf,
  openMonthlySalesSummaryPdf,
  openPaymentTypeReportPdf,
  openPettyCashVoucherReportPdf
} from '../services/operationService'

type PdfReportKey =
  | 'daily-sales'
  | 'monthly-sales-summary'
  | 'incentives-tech'
  | 'incentives-sa'
  | 'commissions-tech'
  | 'commissions-sa'
  | 'credit-card-payment'
  | 'accounts-receivable-daily'
  | 'accounts-receivable-monthly'
  | 'payment-type'
  | 'petty-cash-voucher'
  | 'inventory-check'

type InventoryReportStatus = 'all' | 'low-stock' | 'out-of-stock'

const todayLocal = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})()
const currentMonthStart = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
})()

type ReportItem = {
  label: string
  to: string
  withDateRange?: boolean
  openAsPdf?: boolean
  pdfReportKey?: PdfReportKey
  inventoryStatus?: InventoryReportStatus
  singleDayOnly?: boolean
  paymentTypeId?: string | number
  paymentTypeName?: string
  inventoryCheckType?: 'end-of-day' | 'month-end'
}

type PaymentTypeOption = {
  id: string
  name: string
  sortOrder: number
}

const BASE_REPORT_GROUPS: Array<{
  title: string
  iconBg: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  reports: ReportItem[]
}> = [
  {
    title: 'Sales',
    iconBg: 'bg-sky-500',
    Icon: TrendingUp,
    reports: [
      { label: 'Daily Sales', to: '/reports/daily-sales', openAsPdf: true, pdfReportKey: 'daily-sales', singleDayOnly: true },
      { label: 'Monthly Sales Summary', to: '/reports/monthly-sales-summary', openAsPdf: true, pdfReportKey: 'monthly-sales-summary' },
    ],
  },
  {
    title: 'Incentives',
    iconBg: 'bg-amber-500',
    Icon: Award,
    reports: [
      { label: 'Incentives Technician', to: '/reports/incentives-tech', openAsPdf: true, pdfReportKey: 'incentives-tech' },
      { label: 'Incentives Service Advisor', to: '/reports/incentives-sa', openAsPdf: true, pdfReportKey: 'incentives-sa' },
    ],
  },
  {
    title: 'Commissions',
    iconBg: 'bg-emerald-500',
    Icon: DollarSign,
    reports: [
      { label: 'Commissions Technician', to: '/reports/commissions-tech', openAsPdf: true, pdfReportKey: 'commissions-tech' },
      { label: 'Commissions Service Advisor', to: '/reports/commissions-sa', openAsPdf: true, pdfReportKey: 'commissions-sa' },
    ],
  },
  {
    title: 'Inventory',
    iconBg: 'bg-cyan-600',
    Icon: Warehouse,
    reports: [
      { label: 'All Products', to: '/reports/inventory-products?status=all', withDateRange: false, inventoryStatus: 'all' },
      { label: 'Low Stock Products', to: '/reports/inventory-products?status=low-stock', withDateRange: false, inventoryStatus: 'low-stock' },
      { label: 'Out of Stock Products', to: '/reports/inventory-products?status=out-of-stock', withDateRange: false, inventoryStatus: 'out-of-stock' },
      { label: 'End of Day Inventory Check', to: '/reports/inventory-checks?type=end-of-day', openAsPdf: true, pdfReportKey: 'inventory-check', inventoryCheckType: 'end-of-day' },
      { label: 'Month End Inventory Check', to: '/reports/inventory-checks?type=month-end', openAsPdf: true, pdfReportKey: 'inventory-check', inventoryCheckType: 'month-end' },
    ],
  },
  {
    title: 'Receivables',
    iconBg: 'bg-emerald-600',
    Icon: CreditCard,
    reports: [
      { label: 'Accounts Receivable Daily', to: '/reports/accounts-receivable-daily', openAsPdf: true, pdfReportKey: 'accounts-receivable-daily', singleDayOnly: true },
      { label: 'Accounts Receivable Monthly', to: '/reports/accounts-receivable-monthly', openAsPdf: true, pdfReportKey: 'accounts-receivable-monthly' },
    ],
  },
  {
    title: 'Other Reports',
    iconBg: 'bg-violet-500',
    Icon: MoreHorizontal,
    reports: [
      { label: 'Credit Card Payments', to: '/reports/credit-card-payment', openAsPdf: true, pdfReportKey: 'credit-card-payment' },
      { label: 'Petty Cash Voucher', to: '/reports/petty-cash-voucher', openAsPdf: true, pdfReportKey: 'petty-cash-voucher' },
    ],
  },
]

function normalizePaymentTypes(items: any[]): PaymentTypeOption[] {
  return items
    .map(item => {
      const id = String(item?.id ?? item?.Id ?? '').trim()
      const name = String(item?.name ?? item?.Name ?? '').trim()
      const sortOrder = Number(item?.sortOrder ?? item?.SortOrder ?? 0) || 0
      return { id, name, sortOrder }
    })
    .filter(item => item.id && item.name)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

function formatPaymentTypeLabel(value: string) {
  const normalized = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return ''

  const specialCases: Record<string, string> = {
    CASH: 'Cash',
    GCASH: 'GCash',
    MAYA: 'Maya',
    ES: 'ES',
    'LOC CREDIT CARD': 'Local Credit Card',
    'LOCAL CREDIT CARD': 'Local Credit Card',
    'LOC DEBIT CARD': 'Local Debit Card',
    'LOCAL DEBIT CARD': 'Local Debit Card',
    'INT CREDIT CARD': 'International Credit Card',
    'INTERNATIONAL CREDIT CARD': 'International Credit Card',
    'INT DEBIT CARD': 'International Debit Card',
    'INTERNATIONAL DEBIT CARD': 'International Debit Card',
  }

  const key = normalized.toUpperCase()
  if (specialCases[key]) return specialCases[key]

  return normalized
    .toLowerCase()
    .split(' ')
    .map(word => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ')
}

export default function Reports() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string } | null>({ start: currentMonthStart, end: todayLocal })
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null)
  const [openingReport, setOpeningReport] = useState(false)
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([])

  useEffect(() => {
    let active = true

    async function loadPaymentTypes() {
      try {
        const items = await getParametersByGroup('PAYMENT TYPE')
        if (!active) return
        setPaymentTypes(normalizePaymentTypes(Array.isArray(items) ? items : []))
      } catch {
        if (active) setPaymentTypes([])
      }
    }

    void loadPaymentTypes()
    return () => {
      active = false
    }
  }, [])

  const reportGroups = useMemo(() => {
    const paymentTypeReports: ReportItem[] = paymentTypes.map(paymentType => ({
      label: `${formatPaymentTypeLabel(paymentType.name)} Payments`,
      to: `/reports/payment-type?paymentTypeId=${encodeURIComponent(paymentType.id)}&paymentTypeName=${encodeURIComponent(paymentType.name)}`,
      openAsPdf: true,
      pdfReportKey: 'payment-type',
      paymentTypeId: paymentType.id,
      paymentTypeName: paymentType.name,
    }))

    if (paymentTypeReports.length === 0) return BASE_REPORT_GROUPS

    return [
      ...BASE_REPORT_GROUPS,
      {
        title: 'Mode Of Payment',
        iconBg: 'bg-fuchsia-500',
        Icon: CreditCard,
        reports: paymentTypeReports,
      },
    ]
  }, [paymentTypes])

  const isSingleDayReport = selectedReport?.singleDayOnly === true
  const hasValidSelection = isSingleDayReport ? !!dateRange?.start : (!!dateRange?.start && !!dateRange?.end)

  function openReport(to: string) {
    const params = new URLSearchParams()
    if (dateRange?.start) params.set('start', dateRange.start)
    if (dateRange?.end) params.set('end', dateRange.end)
    const separator = to.includes('?') ? '&' : '?'
    navigate(`${to}${separator}${params.toString()}`)
  }

  async function handleReportClick(report: ReportItem) {
    if (openingReport) return

    if (report.inventoryStatus) {
      setOpeningReport(true)
      try {
        await openInventoryProductsReportPdf(report.inventoryStatus)
      } catch (err: any) {
        showToast(err?.message || 'Unable to open the report.', 'error')
      } finally {
        setOpeningReport(false)
      }
      return
    }

    if (report.withDateRange === false) {
      navigate(report.to)
      return
    }

    if (report.singleDayOnly) {
      const selectedDate = dateRange?.start || dateRange?.end || todayLocal
      setDateRange({ start: selectedDate, end: selectedDate })
    }

    setSelectedReport(report)
  }

  function closeDateModal() {
    setSelectedReport(null)
  }

  async function continueToReport() {
    if (!selectedReport || !hasValidSelection || openingReport) return

    setOpeningReport(true)
    try {
      const startDate = dateRange?.start || ''
      const endDate = selectedReport.singleDayOnly ? (dateRange?.start || '') : (dateRange?.end || '')

      if (selectedReport.pdfReportKey === 'daily-sales') {
        await openDailySalesReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'monthly-sales-summary') {
        await openMonthlySalesSummaryPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'incentives-tech') {
        await openIncentivesTechReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'incentives-sa') {
        await openIncentivesSAReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'commissions-tech') {
        await openCommissionsTechReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'commissions-sa') {
        await openCommissionsSAReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'credit-card-payment') {
        await openCreditCardPaymentReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'accounts-receivable-daily') {
        await openAccountsReceivableDailyReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'accounts-receivable-monthly') {
        await openAccountsReceivableMonthlyReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'payment-type' && selectedReport.paymentTypeId) {
        await openPaymentTypeReportPdf(selectedReport.paymentTypeId, startDate, endDate, selectedReport.paymentTypeName)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'petty-cash-voucher') {
        await openPettyCashVoucherReportPdf(startDate, endDate)
        closeDateModal()
        return
      }

      if (selectedReport.pdfReportKey === 'inventory-check' && selectedReport.inventoryCheckType) {
        await openInventoryCheckReportPdf(selectedReport.inventoryCheckType, startDate, endDate)
        closeDateModal()
        return
      }

      openReport(selectedReport.to)
      closeDateModal()
    } catch (err: any) {
      showToast(err?.message || 'Unable to open the report.', 'error')
    } finally {
      setOpeningReport(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Open operational and financial reports by category.
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
          Most reports will ask for a date or date range before opening.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reportGroups.map(group => (
          <div
            key={group.title}
            className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${group.iconBg} shrink-0`}>
                <group.Icon size={18} className="text-white" />
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{group.title}</span>
            </div>
            <ul className="space-y-2">
              {group.reports.map(r => (
                <li key={r.to}>
                  <button
                    onClick={() => handleReportClick(r)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-bosch-blue transition hover:bg-sky-50 hover:underline dark:hover:bg-slate-700/50"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-date-range-title"
        >
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="report-date-range-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {isSingleDayReport ? 'Select report date' : 'Select report date range'}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Choose the {isSingleDayReport ? 'report date' : 'date coverage'} for <span className="font-medium">{selectedReport.label}</span> before {selectedReport.openAsPdf ? 'generating the PDF' : 'opening the report'}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDateModal}
                disabled={openingReport}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                aria-label="Close date range dialog"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {isSingleDayReport ? (
                <div className="space-y-2">
                  <label htmlFor="daily-sales-report-date" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Report date
                  </label>
                  <input
                    id="daily-sales-report-date"
                    type="date"
                    value={dateRange?.start ?? ''}
                    onChange={event => {
                      const value = event.target.value
                      setDateRange(value ? { start: value, end: value } : null)
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              ) : (
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              )}
              {!hasValidSelection && (
                <p className="text-sm text-rose-600 dark:text-rose-300">
                  {isSingleDayReport ? 'Report date is required to continue.' : 'Start date and end date are required to continue.'}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDateModal}
                disabled={openingReport}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={continueToReport}
                disabled={openingReport || !hasValidSelection}
                className="rounded-lg bg-bosch-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-bosch-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {openingReport
                  ? (selectedReport.openAsPdf ? 'Generating PDF...' : 'Opening report...')
                  : (selectedReport.openAsPdf ? 'Open PDF' : 'Open report')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
