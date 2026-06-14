// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  CreditCard,
  DollarSign,
  Hash,
  Loader2,
  Plus,
  Printer,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import { useToast } from '../../contexts/toast'
import { fetchCustomers } from '../../services/customerService'
import { getJobStatuses, getParametersByGroup } from '../../services/configService'
import {
  getInvoicesSummary,
  getNextPaymentReferenceNo,
  openPaymentReceiptPdf,
  openPaymentGatePassPdf,
  getPaymentById,
  savePayment,
  updatePayment,
} from '../../services/operationService'

type PaymentFormState = {
  isChangan: boolean
  isFullyPaid: boolean
  jobStatusId: string
  referenceNo: string
  paymentDate: string
  customerId: string
  remarks: string
}

type CustomerOption = {
  id: string
  name: string
  clientType: 'BOSCH' | 'CHANGAN'
}

type JobStatusOption = {
  id: string
  name: string
  code: string
}

type PaymentTypeOption = {
  id: string
  name: string
  groupName: string
}

type SelectOption = {
  value: string
  label: string
}

type InvoiceOption = {
  id: string
  customerId: string
  isChangan: boolean
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  jobOrderId: string
  jobOrderNo: string
  totalAmount: number
  vat12: number
  depositAmount: number
  paidAmount: number
  balanceDue: number
  status: string
}

type PaymentDetailRow = {
  key: string
  id?: number
  invoiceId: string
  paymentTypeParameterId: string
  isFullyPaid: boolean
  isDeposit: boolean
  paymentDate: string
  amountPaid: number
  paymentReferenceNo: string
}

let detailRowSeed = 0

function toDateInput(value: unknown): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function CurrencyInput({
  value,
  onChange,
  className,
  readOnly,
}: {
  value: number
  onChange?: (v: number) => void
  className?: string
  readOnly?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')

  function handleFocus() {
    if (readOnly) return
    setFocused(true)
    setInputVal(value === 0 ? '' : String(value))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputVal(e.target.value)
  }

  function handleBlur() {
    setFocused(false)
    if (onChange) onChange(parseFloat(inputVal.replace(/,/g, '')) || 0)
  }

  const display = focused
    ? inputVal
    : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

  return (
    <input
      value={display}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      readOnly={readOnly}
      className={className}
    />
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-bosch-blue' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded shadow-sm">
      <div className="rounded border overflow-visible">
        <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t">
          <div className="text-sm font-medium text-slate-700">{title}</div>
        </div>
        <div className="p-4 rounded-b">{children}</div>
      </div>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'warning' | 'success' | 'strong'
}) {
  const toneClass = {
    default: 'bg-slate-50 border-slate-200 text-slate-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    strong: 'bg-sky-50 border-sky-200 text-sky-800',
  }[tone]

  return (
    <div className={`rounded border px-3 py-2 ${toneClass}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{formatMoney(value)}</div>
    </div>
  )
}

function SearchableSelect({
  options,
  value,
  onChange,
  onClear,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const filtered = query.trim()
    ? options.filter(option => option.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div className="relative w-full">
      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
        <Search className="text-slate-400 shrink-0" size={16} />
        <input
          type="text"
          value={open ? query : (selected?.label ?? '')}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-sm"
        />
        {value && onClear && (
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              onClear()
              setQuery('')
              setOpen(false)
            }}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow z-50 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No results</div>
          ) : filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                onChange(option.value)
                setQuery('')
                setOpen(false)
              }}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 text-sm ${option.value === value ? 'bg-blue-50 font-medium' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function normalizeJobStatuses(items: any[]): JobStatusOption[] {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    code: String(item.code ?? item.Code ?? item.name ?? item.Name ?? '').toUpperCase(),
  })).filter(item => item.id)
}

function normalizePaymentTypes(items: any[]): PaymentTypeOption[] {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    groupName: String(
      item.parameterGroup?.name
      ?? item.parameterGroup?.Name
      ?? item.group?.name
      ?? item.group?.Name
      ?? item.groupName
      ?? item.GroupName
      ?? ''
    ),
  })).filter(item => item.id && item.name)
}

function isDepositPaymentType(option: Pick<PaymentTypeOption, 'name' | 'groupName'>): boolean {
  const haystack = `${option.groupName} ${option.name}`.toLowerCase()
  return haystack.includes('deposit') || haystack.includes('down payment')
}

function isCashPaymentType(option?: Pick<PaymentTypeOption, 'name'> | null): boolean {
  return String(option?.name ?? '').trim().toLowerCase() === 'cash'
}

function normalizeInvoices(items: any[]): InvoiceOption[] {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    customerId: String(item.customerId ?? item.CustomerId ?? ''),
    isChangan: Boolean(item.isChangan ?? item.IsChangan ?? false),
    invoiceNo: String(item.invoiceNo ?? item.InvoiceNo ?? ''),
    invoiceDate: toDateInput(item.invoiceDate ?? item.InvoiceDate),
    dueDate: toDateInput(item.dueDate ?? item.DueDate),
    jobOrderId: String(item.jobOrderId ?? item.JobOrderId ?? ''),
    jobOrderNo: String(item.jobOrder ?? item.jobOrderNo ?? item.JobOrder ?? ''),
    totalAmount: Number(item.totalAmount ?? item.TotalAmount ?? 0) || 0,
    vat12: Number(item.vat12 ?? item.VAT12 ?? 0) || 0,
    depositAmount: Number(item.depositAmount ?? item.DepositAmount ?? 0) || 0,
    paidAmount: Number(item.paidAmount ?? item.PaidAmount ?? 0) || 0,
    balanceDue: Math.max(0, Number(item.balanceDue ?? item.BalanceDue ?? 0) || 0),
    status: String(item.status ?? item.Status ?? ''),
  })).filter(item => item.id)
}

export default function ManagePayment() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeId } = useParams<{ id: string }>()
  const isAddMode = location.pathname.endsWith('/add') || !routeId
  const routeState = location.state as { sourceInvoiceId?: string; sourceCustomerId?: string } | null
  const queryParams = new URLSearchParams(location.search)
  const sourceInvoiceId = String(routeState?.sourceInvoiceId ?? queryParams.get('invoiceId') ?? '')
  const sourceCustomerId = String(routeState?.sourceCustomerId ?? queryParams.get('customerId') ?? '')
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const { showToast } = useToast()
  const initialSourceInvoiceApplied = useRef(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [jobStatuses, setJobStatuses] = useState<JobStatusOption[]>([])
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([])
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [detailRows, setDetailRows] = useState<PaymentDetailRow[]>([])
  const [initialPaymentAmountByInvoice, setInitialPaymentAmountByInvoice] = useState<Record<string, number>>({})
  const [savedPaymentBalance, setSavedPaymentBalance] = useState(0)
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [form, setForm] = useState<PaymentFormState>({
    isChangan: false,
    isFullyPaid: false,
    jobStatusId: '',
    referenceNo: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    customerId: '',
    remarks: '',
  })

  function updateForm<K extends keyof PaymentFormState>(key: K, value: PaymentFormState[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function createDetailRow(invoiceId = ''): PaymentDetailRow {
    detailRowSeed += 1
    return {
      key: `payment-detail-${detailRowSeed}`,
      invoiceId,
      paymentTypeParameterId: '',
      isFullyPaid: false,
      isDeposit: false,
      paymentDate: form.paymentDate,
      amountPaid: 0,
      paymentReferenceNo: '',
    }
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const [customerResult, jobStatusResult, invoiceResult, groupedPaymentTypes] = await Promise.all([
          fetchCustomers(),
          getJobStatuses(),
          getInvoicesSummary(),
          getParametersByGroup('PAYMENT TYPE'),
        ])
        if (!mounted) return

        const normalizedCustomers: CustomerOption[] = (customerResult?.customers ?? []).map((customer: any) => ({
          id: String(customer.id),
          name: String(customer.name ?? '').trim(),
          clientType: customer.clientType === 'CHANGAN' ? 'CHANGAN' : 'BOSCH',
        })).filter((customer: CustomerOption) => customer.id)
        const normalizedStatuses = normalizeJobStatuses(Array.isArray(jobStatusResult) ? jobStatusResult : [])
        const normalizedInvoices = normalizeInvoices(Array.isArray(invoiceResult) ? invoiceResult : [])

        const resolvedPaymentTypes = normalizePaymentTypes(Array.isArray(groupedPaymentTypes) ? groupedPaymentTypes : [])
          .filter(type => {
            const groupName = type.groupName.trim().toUpperCase()
            return groupName === 'PAYMENT TYPE' || groupName === 'PAYMENTTYPE'
          })

        setCustomers(normalizedCustomers)
        setJobStatuses(normalizedStatuses)
        setInvoices(normalizedInvoices)
        setPaymentTypes(resolvedPaymentTypes)
        setInitialPaymentAmountByInvoice({})
        setSavedPaymentBalance(0)

        if (isAddMode) {
          const nextReference: any = await getNextPaymentReferenceNo().catch(() => null)
          const openStatus = normalizedStatuses.find(status =>
            status.code.includes('OPEN') || status.name.toUpperCase().includes('OPEN')
          )

          setForm(current => ({
            ...current,
            jobStatusId: current.jobStatusId || String(openStatus?.id ?? ''),
            referenceNo: String(nextReference?.referenceNo ?? nextReference?.ReferenceNo ?? current.referenceNo ?? ''),
          }))
        } else if (routeId) {
          const payment: any = await getPaymentById(routeId)
          if (!mounted || !payment) return

          const details = Array.isArray(payment.paymentDetails ?? payment.PaymentDetails)
            ? (payment.paymentDetails ?? payment.PaymentDetails)
            : []

          setForm({
            isChangan: Boolean(payment.isChangan ?? payment.IsChangan ?? false),
            isFullyPaid: Boolean(payment.isFullyPaid ?? payment.IsFullyPaid ?? false),
            jobStatusId: String(payment.jobStatusId ?? payment.JobStatusId ?? ''),
            referenceNo: String(payment.referenceNo ?? payment.ReferenceNo ?? ''),
            paymentDate: toDateInput(payment.paymentDate ?? payment.PaymentDate),
            customerId: String(payment.customerId ?? payment.CustomerId ?? ''),
            remarks: String(payment.remarks ?? payment.Remarks ?? ''),
          })
          setSavedPaymentBalance(Math.max(0, Number(payment.balance ?? payment.Balance ?? 0) || 0))

          const normalizedDetails = details.map((detail: any) => {
            const row = createDetailRow(String(detail.invoiceId ?? detail.InvoiceId ?? ''))
            return {
              ...row,
              id: Number(detail.id ?? detail.Id ?? 0) || undefined,
              paymentTypeParameterId: String(detail.paymentTypeParameterId ?? detail.PaymentTypeParameterId ?? ''),
              isFullyPaid: Boolean(detail.isFullyPaid ?? detail.IsFullyPaid ?? false),
              isDeposit: Boolean(detail.isDeposit ?? detail.IsDeposit ?? false),
              paymentDate: toDateInput(detail.paymentDate ?? detail.PaymentDate ?? payment.paymentDate ?? payment.PaymentDate),
              amountPaid: Number(detail.amountPaid ?? detail.AmountPaid ?? 0) || 0,
              paymentReferenceNo: String(detail.paymentReferenceNo ?? detail.PaymentReferenceNo ?? ''),
            }
          })

          const originalAmounts = normalizedDetails.reduce<Record<string, number>>((totals, detail) => {
            if (!detail.invoiceId) return totals
            totals[detail.invoiceId] = (totals[detail.invoiceId] ?? 0) + Number(detail.amountPaid || 0)
            return totals
          }, {})

          setDetailRows(normalizedDetails)
          setInitialPaymentAmountByInvoice(originalAmounts)
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to load payment form', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [isAddMode, routeId, showToast])

  const customerById = useMemo(
    () => Object.fromEntries(customers.map(customer => [customer.id, customer])),
    [customers]
  )

  const customerOptions = useMemo(
    () => customers.map(customer => ({ value: customer.id, label: customer.name })),
    [customers]
  )

  const paymentTypeById = useMemo(
    () => Object.fromEntries(paymentTypes.map(type => [type.id, type])),
    [paymentTypes]
  )

  const depositPaymentTypeOptions = useMemo(
    () => paymentTypes.filter(isDepositPaymentType),
    [paymentTypes]
  )

  const regularPaymentTypeOptions = useMemo(
    () => paymentTypes.filter(type => !isDepositPaymentType(type)),
    [paymentTypes]
  )

  const invoiceById = useMemo(
    () => Object.fromEntries(invoices.map(invoice => [invoice.id, invoice])),
    [invoices]
  )

  useEffect(() => {
    if (initialSourceInvoiceApplied.current) return
    if (!sourceInvoiceId) return
    if (detailRows.length > 0 || paymentTypes.length === 0 || invoices.length === 0) return

    const invoice = invoiceById[sourceInvoiceId]
    if (!invoice) return
    if (!isAddMode && form.customerId && invoice.customerId !== form.customerId) return

    const resolvedCustomerId = invoice.customerId || sourceCustomerId
    if (!resolvedCustomerId) return

    const outstandingAmount = getInvoiceOutstandingAmount(sourceInvoiceId)
    if (outstandingAmount <= 0) return

    const customer = customerById[resolvedCustomerId]
    setForm(current => ({
      ...current,
      customerId: resolvedCustomerId,
      isChangan: customer ? customer.clientType === 'CHANGAN' : invoice.isChangan,
    }))

    const nextRow = createDetailRow(sourceInvoiceId)
    nextRow.amountPaid = outstandingAmount
    nextRow.paymentTypeParameterId = getDefaultPaymentTypeId(false)

    initialSourceInvoiceApplied.current = true
    setDetailRows([nextRow])
  }, [customerById, detailRows.length, form.customerId, invoiceById, invoices.length, isAddMode, paymentTypes.length, sourceCustomerId, sourceInvoiceId])

  const selectedInvoiceIds = useMemo(
    () => Array.from(new Set(detailRows.map(row => row.invoiceId).filter(Boolean))),
    [detailRows]
  )

  function getInvoiceOutstandingAmount(invoiceId: string): number {
    const invoice = invoiceById[invoiceId]
    if (!invoice) return 0
    return Math.max(0, Number(invoice.balanceDue || 0) + Number(initialPaymentAmountByInvoice[invoiceId] ?? 0))
  }

  function getAllocatedInvoiceAmount(rows: PaymentDetailRow[], invoiceId: string, excludingKey?: string): number {
    return rows.reduce((sum, row) => {
      if (!row.invoiceId || row.invoiceId !== invoiceId || row.key === excludingKey) return sum
      return sum + Number(row.amountPaid || 0)
    }, 0)
  }

  function getRowAvailableAmount(rows: PaymentDetailRow[], invoiceId: string, rowKey?: string): number {
    return Math.max(0, getInvoiceOutstandingAmount(invoiceId) - getAllocatedInvoiceAmount(rows, invoiceId, rowKey))
  }

  const customerInvoices = useMemo(() => {
    return invoices.filter(invoice =>
      invoice.customerId === form.customerId
      && (getInvoiceOutstandingAmount(invoice.id) > 0 || selectedInvoiceIds.includes(invoice.id))
    )
  }, [form.customerId, invoices, selectedInvoiceIds, initialPaymentAmountByInvoice])

  const customerInvoiceSummary = useMemo(() => {
    return customerInvoices.reduce((summary, invoice) => {
      const originalPaymentAmount = Number(initialPaymentAmountByInvoice[invoice.id] ?? 0)
      summary.outstanding += getInvoiceOutstandingAmount(invoice.id)
      summary.deposit += Number(invoice.depositAmount || 0)
      summary.paid += Math.max(0, Number(invoice.paidAmount || 0) - originalPaymentAmount)
      return summary
    }, { outstanding: 0, deposit: 0, paid: 0 })
  }, [customerInvoices, initialPaymentAmountByInvoice])

  const customerRemainingBalance = useMemo(() => {
    return customerInvoices.reduce((sum, invoice) => {
      const originalPaymentAmount = Number(initialPaymentAmountByInvoice[invoice.id] ?? 0)
      const remainingBalanceBeforeCurrentPayment = Math.max(0, Number(invoice.balanceDue || 0) + originalPaymentAmount)
      const currentAllocatedAmount = getAllocatedInvoiceAmount(detailRows, invoice.id)
      return sum + Math.max(0, remainingBalanceBeforeCurrentPayment - currentAllocatedAmount)
    }, 0)
  }, [customerInvoices, detailRows, initialPaymentAmountByInvoice])

  const selectedInvoices = useMemo(() => {
    return selectedInvoiceIds
      .map(invoiceId => invoiceById[invoiceId])
      .filter((invoice): invoice is InvoiceOption => Boolean(invoice))
  }, [invoiceById, selectedInvoiceIds])

  const selectedInvoiceOptions = useMemo<SelectOption[]>(() => {
    return selectedInvoices.map(invoice => ({
      value: invoice.id,
      label: invoice.invoiceNo,
    }))
  }, [selectedInvoices])

  const selectedStatus = useMemo(() => (
    jobStatuses.find(status => status.id === form.jobStatusId) ?? null
  ), [jobStatuses, form.jobStatusId])

  const isOpenStatus = Boolean(
    selectedStatus
    && (selectedStatus.code.includes('OPEN') || selectedStatus.name.toUpperCase().includes('OPEN'))
  )

  const canCreateNewPayment = Boolean(selectedStatus && !isOpenStatus)

  const summary = useMemo(() => {
    const invoiceTotalAmount = selectedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
    const vat12 = selectedInvoices.reduce((sum, invoice) => sum + invoice.vat12, 0)
    const existingDepositAmount = selectedInvoices.reduce((sum, invoice) => sum + invoice.depositAmount, 0)
    const previousPaidAmount = selectedInvoices.reduce((sum, invoice) => {
      const currentPaymentOriginalAmount = Number(initialPaymentAmountByInvoice[invoice.id] ?? 0)
      return sum + Math.max(0, Number(invoice.paidAmount || 0) - currentPaymentOriginalAmount)
    }, 0)
    const outstandingAmount = selectedInvoices.reduce((sum, invoice) => sum + getInvoiceOutstandingAmount(invoice.id), 0)
    const currentPaymentAmount = detailRows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0)
    const depositTaggedAmount = detailRows.reduce((sum, row) => row.isDeposit ? sum + Number(row.amountPaid || 0) : sum, 0)
    const remainingBalance = Math.max(0, outstandingAmount - currentPaymentAmount)
    const overpaymentAmount = Math.max(0, currentPaymentAmount - outstandingAmount)

    return {
      invoiceTotalAmount,
      vat12,
      existingDepositAmount,
      previousPaidAmount,
      outstandingAmount,
      currentPaymentAmount,
      depositTaggedAmount,
      remainingBalance,
      overpaymentAmount,
    }
  }, [detailRows, initialPaymentAmountByInvoice, selectedInvoices])

  const effectivePaymentRemainingBalance = isAddMode
    ? summary.remainingBalance
    : savedPaymentBalance

  const canPrintGatePass = Boolean(
    !isAddMode
    && routeId
    && !isOpenStatus
    && effectivePaymentRemainingBalance <= 0.0001
    && customerRemainingBalance <= 0.0001
  )
  const canCompletePayment = Boolean(
    isOpenStatus
    && summary.remainingBalance <= 0.0001
    && customerRemainingBalance <= 0.0001
  )

  function getPaymentTypeOptionsForRow(row: PaymentDetailRow): PaymentTypeOption[] {
    if (row.isDeposit) {
      return depositPaymentTypeOptions.length > 0 ? depositPaymentTypeOptions : paymentTypes
    }
    return regularPaymentTypeOptions.length > 0 ? regularPaymentTypeOptions : paymentTypes
  }

  function getDefaultPaymentTypeId(isDeposit: boolean): string {
    if (isDeposit) return depositPaymentTypeOptions[0]?.id ?? paymentTypes[0]?.id ?? ''
    return regularPaymentTypeOptions[0]?.id ?? paymentTypes[0]?.id ?? ''
  }

  function handleCustomerChange(customerId: string) {
    const customer = customerById[customerId]
    setDetailRows([])
    setForm(current => ({
      ...current,
      customerId,
      isChangan: customer ? customer.clientType === 'CHANGAN' : false,
    }))
  }

  function handlePaymentDateChange(paymentDate: string) {
    const previousPaymentDate = form.paymentDate
    updateForm('paymentDate', paymentDate)
    setDetailRows(current => current.map(row => ({
      ...row,
      paymentDate: !row.paymentDate || row.paymentDate === previousPaymentDate ? paymentDate : row.paymentDate,
    })))
  }

  function toggleInvoiceSelection(invoiceId: string) {
    const isSelected = selectedInvoiceIds.includes(invoiceId)

    if (isSelected) {
      setDetailRows(current => current.filter(row => row.invoiceId !== invoiceId))
      return
    }

    setDetailRows(current => {
    if (current.some(row => row.invoiceId === invoiceId)) return current
    const nextRow = createDetailRow(invoiceId)
    nextRow.amountPaid = getRowAvailableAmount(current, invoiceId)
    nextRow.paymentTypeParameterId = getDefaultPaymentTypeId(false)
    return [...current, nextRow]
  })
}

  function selectAllOutstandingInvoices() {
    if (!form.customerId) {
      showToast('Select a customer first', 'error')
      return
    }

    setDetailRows(current => {
      let nextRows = [...current]
      for (const invoice of customerInvoices) {
      if (getInvoiceOutstandingAmount(invoice.id) <= 0 || nextRows.some(row => row.invoiceId === invoice.id)) continue
      const nextRow = createDetailRow(invoice.id)
      nextRow.amountPaid = getRowAvailableAmount(nextRows, invoice.id)
      nextRow.paymentTypeParameterId = getDefaultPaymentTypeId(false)
      nextRows = [...nextRows, nextRow]
    }
    return nextRows
  })
  }

  function clearPaymentSelection() {
    setDetailRows([])
  }

  function updateDetailRow(key: string, patch: Partial<PaymentDetailRow>) {
    setDetailRows(current => current.map(row => {
      if (row.key !== key) return row
      const next = { ...row, ...patch }
      const nextInvoiceId = String(patch.invoiceId ?? next.invoiceId ?? '')
      const nextIsDeposit = Boolean(patch.isDeposit ?? next.isDeposit)
      const allowedPaymentTypeOptions = nextIsDeposit
        ? (depositPaymentTypeOptions.length > 0 ? depositPaymentTypeOptions : paymentTypes)
        : (regularPaymentTypeOptions.length > 0 ? regularPaymentTypeOptions : paymentTypes)

      if (patch.invoiceId !== undefined && patch.invoiceId !== row.invoiceId && patch.amountPaid === undefined) {
        next.amountPaid = getRowAvailableAmount(current, nextInvoiceId, row.key)
      }
      if (patch.amountPaid !== undefined && nextInvoiceId) {
        const rowMaxAmount = getRowAvailableAmount(current, nextInvoiceId, row.key)
        next.amountPaid = Math.max(0, Math.min(Number(patch.amountPaid || 0), rowMaxAmount))
      }
      if (patch.isFullyPaid !== undefined && nextInvoiceId) {
        next.amountPaid = patch.isFullyPaid ? getRowAvailableAmount(current, nextInvoiceId, row.key) : next.amountPaid
      }
      if (!allowedPaymentTypeOptions.some(option => option.id === next.paymentTypeParameterId)) {
        next.paymentTypeParameterId = allowedPaymentTypeOptions[0]?.id ?? ''
      }
      const rowMaxAmount = nextInvoiceId ? getRowAvailableAmount(current, nextInvoiceId, row.key) : 0
      next.isFullyPaid = nextInvoiceId ? Math.abs(Number(next.amountPaid || 0) - rowMaxAmount) <= 0.0001 && rowMaxAmount > 0 : false
      return next
    }))
  }

  function handleAddPaymentOption() {
    if (selectedInvoiceIds.length === 0) {
      showToast('Select at least one invoice first', 'error')
      return
    }

    setDetailRows(current => {
      const targetInvoiceId = selectedInvoiceIds.find(invoiceId => getRowAvailableAmount(current, invoiceId) > 0)
      if (!targetInvoiceId) {
        showToast('All selected invoices are already fully allocated', 'error')
        return current
    }
    const nextRow = createDetailRow(targetInvoiceId)
    nextRow.amountPaid = getRowAvailableAmount(current, targetInvoiceId)
    nextRow.paymentTypeParameterId = getDefaultPaymentTypeId(false)
    return [...current, nextRow]
  })
}

  function handleRemoveDetailRow(key: string) {
    setDetailRows(current => current.filter(detail => detail.key !== key))
  }

  function isPaymentReferenceRequired(row: PaymentDetailRow) {
    if (!row.paymentTypeParameterId) return false
    return !isCashPaymentType(paymentTypeById[row.paymentTypeParameterId])
  }

  function hasPaymentReferenceError(row: PaymentDetailRow) {
    return showValidationErrors && isPaymentReferenceRequired(row) && !row.paymentReferenceNo.trim()
  }

  async function persistPayment(options?: {
    forceIsFullyPaid?: boolean
    forceJobStatusId?: string
    successMessage?: string
  }) {
    if (saving) return
    setShowValidationErrors(true)
    if (typeof currentUserId !== 'number') {
      showToast('Unable to identify the current user', 'error')
      return
    }
    if (!form.customerId) {
      showToast('Select a customer', 'error')
      return
    }
    if (!form.jobStatusId) {
      showToast('Payment status is not configured', 'error')
      return
    }
    if (!form.referenceNo.trim()) {
      showToast('Enter a reference number', 'error')
      return
    }
    if (selectedInvoiceIds.length === 0) {
      showToast('Select at least one invoice', 'error')
      return
    }

    const validDetails = detailRows.filter(row =>
      row.invoiceId
      && row.paymentTypeParameterId
      && Number(row.amountPaid || 0) > 0
    )

    if (validDetails.length === 0) {
      showToast('Add at least one payment detail row with amount and payment type', 'error')
      return
    }

    const missingReferenceRow = validDetails.find(row =>
      isPaymentReferenceRequired(row) && !row.paymentReferenceNo.trim()
    )

    if (missingReferenceRow) {
      showToast('Reference number is required for non-cash payment types', 'error')
      return
    }

    const overAllocatedInvoice = selectedInvoices.find(invoice =>
      getAllocatedInvoiceAmount(validDetails, invoice.id) - getInvoiceOutstandingAmount(invoice.id) > 0.0001
    )

    if (overAllocatedInvoice) {
      showToast(`Applied amount exceeds the outstanding balance for ${overAllocatedInvoice.invoiceNo}`, 'error')
      return
    }

    const resolvedIsFullyPaid = options?.forceIsFullyPaid ?? (summary.remainingBalance <= 0.0001)
    const resolvedJobStatusId = options?.forceJobStatusId ?? form.jobStatusId

    const payload: Record<string, unknown> = {
      IsChangan: form.isChangan,
      IsFullyPaid: resolvedIsFullyPaid,
      ReferenceNo: form.referenceNo.trim(),
      PaymentDate: form.paymentDate ? new Date(form.paymentDate).toISOString() : undefined,
      JobStatusId: Number(resolvedJobStatusId),
      CustomerId: Number(form.customerId),
      InvoiceTotalAmount: Number(summary.invoiceTotalAmount.toFixed(2)),
      VAT12: Number(summary.vat12.toFixed(2)),
      DepositAmount: Number(summary.existingDepositAmount.toFixed(2)),
      AmountPayable: Number(summary.outstandingAmount.toFixed(2)),
      TotalPaidAmount: Number(summary.currentPaymentAmount.toFixed(2)),
      Balance: Number(summary.remainingBalance.toFixed(2)),
      Remarks: form.remarks.trim() || undefined,
      UpdatedById: currentUserId,
      PaymentDetails: validDetails.map(row => ({
        PaymentTypeParameterId: Number(row.paymentTypeParameterId),
        InvoiceId: Number(row.invoiceId),
        IsFullyPaid: row.isFullyPaid,
        AmountPaid: Number(row.amountPaid || 0),
        IsDeposit: row.isDeposit,
        PaymentDate: row.paymentDate ? new Date(row.paymentDate).toISOString() : undefined,
        PaymentReferenceNo: row.paymentReferenceNo.trim() || undefined,
      })),
    }

    if (isAddMode) {
      payload.CreatedById = currentUserId
    }

    setSaving(true)
    try {
      if (isAddMode) {
        await savePayment(payload)
      } else if (routeId) {
        await updatePayment(routeId, payload)
      }
      setSavedPaymentBalance(Number(summary.remainingBalance.toFixed(2)))
      setInitialPaymentAmountByInvoice(validDetails.reduce<Record<string, number>>((totals, row) => {
        const invoiceId = String(row.invoiceId)
        totals[invoiceId] = (totals[invoiceId] ?? 0) + Number(row.amountPaid || 0)
        return totals
      }, {}))
      updateForm('isFullyPaid', resolvedIsFullyPaid)
      updateForm('jobStatusId', resolvedJobStatusId)
      setShowValidationErrors(false)
      showToast(options?.successMessage ?? 'Payment saved successfully', 'success')
      navigate('/operations/payment')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save payment', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    await persistPayment()
  }

  async function handlePrintReceipt() {
    if (isAddMode || !routeId) {
      showToast('Save the payment first before printing the receipt', 'error')
      return
    }

    try {
      await openPaymentReceiptPdf(routeId)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to print payment receipt', 'error')
    }
  }

  async function handlePrintGatePass() {
    if (isAddMode || !routeId) {
      showToast('Save the payment first before printing the gate pass', 'error')
      return
    }
    if (isOpenStatus || effectivePaymentRemainingBalance > 0.0001) {
      showToast('Gate pass can only be printed for completed payments with zero remaining balance', 'error')
      return
    }
    if (customerRemainingBalance > 0.0001) {
      showToast('Gate pass can only be printed when the customer has no remaining balance', 'error')
      return
    }

    try {
      await openPaymentGatePassPdf(routeId)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to print gate pass', 'error')
    }
  }

  async function handleCompletePayment() {
    if (summary.remainingBalance > 0.0001) {
      showToast('Remaining balance must be zero before completing the payment', 'error')
      return
    }
    if (customerRemainingBalance > 0.0001) {
      showToast('Customer remaining balance must be zero before completing the payment', 'error')
      return
    }

    const completedStatus = jobStatuses.find(status =>
      status.code.includes('COMPLETED')
      || status.code.includes('PAID')
      || status.name.toUpperCase().includes('COMPLETED')
      || status.name.toUpperCase().includes('PAID')
    )

    await persistPayment({
      forceIsFullyPaid: true,
      forceJobStatusId: completedStatus?.id ?? form.jobStatusId,
      successMessage: 'Payment completed successfully',
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading payment form...
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAddMode ? 'Add Payment' : 'Manage Payment'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Section title="Actions">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Client Type</span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${form.customerId ? (form.isChangan ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700') : 'bg-slate-100 text-slate-500'}`}>
                {form.customerId ? (form.isChangan ? 'CHANGAN' : 'BOSCH') : 'Select customer'}
              </span>
              {selectedStatus && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedStatus.name}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/operations/accounts-receivable')}
                className="px-4 py-2 rounded text-sm flex items-center gap-2 bg-white border text-slate-700 hover:bg-slate-50"
              >
                <CreditCard size={14} />
                Accounts Receivable
              </button>
              {canCreateNewPayment && (
                <button
                  type="button"
                  onClick={() => navigate('/operations/payment/add')}
                  className="px-4 py-2 rounded text-sm flex items-center gap-2 bg-bosch-blue text-white hover:opacity-90"
                >
                  <Plus size={14} />
                  New Payment
                </button>
              )}
              {isOpenStatus && (
                <button
                  type="button"
                  onClick={handleCompletePayment}
                  disabled={!canCompletePayment}
                  title={canCompletePayment ? 'Complete payment' : 'Customer and payment remaining balances must both be zero'}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${canCompletePayment ? 'bg-emerald-600 text-white hover:opacity-90' : 'bg-emerald-200 text-emerald-700 cursor-not-allowed'}`}
                >
                  <CreditCard size={14} />
                  Complete Payment
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintReceipt}
                disabled={isAddMode || !routeId}
                className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${isAddMode || !routeId ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                <Printer size={14} />
                Print Receipt
              </button>
              <button
                type="button"
                onClick={handlePrintGatePass}
                disabled={!canPrintGatePass}
                title={canPrintGatePass ? 'Print gate pass' : 'Available only for completed payments with no customer balance'}
                className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${canPrintGatePass ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
              >
                <Printer size={14} />
                Print Gate Pass
              </button>
            </div>
          </div>
        </Section>

        <Section title="Payment Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Status <span className="text-rose-600">*</span></label>
              <div className="mt-2 flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
                <Tag className="text-slate-400 shrink-0" size={16} />
                <select
                  value={form.jobStatusId}
                  disabled
                  className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed"
                >
                  <option value="">Select status</option>
                  {jobStatuses.map(status => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Reference No. <span className="text-rose-600">*</span></label>
              <div className="mt-2 flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
                <Hash className="text-slate-400 shrink-0" size={16} />
                <input
                  value={form.referenceNo}
                  disabled
                  placeholder="PY0000001"
                  className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Transaction Date <span className="text-rose-600">*</span></label>
              <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                <Calendar className="text-slate-400 shrink-0" size={16} />
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={e => handlePaymentDateChange(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">Customer <span className="text-rose-600">*</span></label>
            <SearchableSelect
              options={customerOptions}
              value={form.customerId}
              onChange={handleCustomerChange}
              onClear={() => handleCustomerChange('')}
              placeholder="Search customer..."
            />
          </div>
        </Section>

        <Section title="Invoices">
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="rounded border bg-slate-50 px-3 py-2">
              <div className="text-xs font-medium text-slate-500">Open Invoices</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{customerInvoices.length}</div>
            </div>
            <div className="rounded border bg-sky-50 px-3 py-2">
              <div className="text-xs font-medium text-sky-700">Selected</div>
              <div className="mt-1 text-sm font-semibold text-sky-800">{selectedInvoiceIds.length}</div>
            </div>
            <div className="rounded border bg-amber-50 px-3 py-2">
              <div className="text-xs font-medium text-amber-700">Applied Deposit</div>
              <div className="mt-1 text-sm font-semibold text-amber-800">{formatMoney(customerInvoiceSummary.deposit)}</div>
            </div>
            <div className="rounded border bg-slate-50 px-3 py-2">
              <div className="text-xs font-medium text-slate-500">Prior Payments</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">{formatMoney(customerInvoiceSummary.paid)}</div>
            </div>
            <div className="rounded border bg-emerald-50 px-3 py-2">
              <div className="text-xs font-medium text-emerald-700">Customer Outstanding</div>
              <div className="mt-1 text-sm font-semibold text-emerald-800">{formatMoney(customerInvoiceSummary.outstanding)}</div>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-500">
              {form.customerId ? 'Choose one or more invoices to create payment rows.' : 'Select a customer to see unpaid invoices.'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllOutstandingInvoices}
                disabled={!form.customerId || customerInvoices.length === 0}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm ${form.customerId && customerInvoices.length > 0 ? 'bg-bosch-blue text-white hover:opacity-90' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
              >
                <Plus size={14} />
                Select All
              </button>
              <button
                type="button"
                onClick={clearPaymentSelection}
                disabled={detailRows.length === 0}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm ${detailRows.length > 0 ? 'bg-white border text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                <X size={14} />
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="pb-2 font-medium pr-4">Select</th>
                  <th className="pb-2 font-medium pr-4">Invoice No.</th>
                  <th className="pb-2 font-medium pr-4">Invoice Date</th>
                  <th className="pb-2 font-medium pr-4">Job Order No.</th>
                  <th className="pb-2 font-medium pr-4 text-right">Total</th>
                  <th className="pb-2 font-medium pr-4 text-right">Deposit</th>
                  <th className="pb-2 font-medium pr-4 text-right">Paid</th>
                  <th className="pb-2 font-medium pr-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {customerInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      {form.customerId ? 'No open invoices found for this customer.' : 'Select a customer to load invoices.'}
                    </td>
                  </tr>
                )}
                {customerInvoices.map(invoice => {
                  const selected = selectedInvoiceIds.includes(invoice.id)
                  const outstandingAmount = getInvoiceOutstandingAmount(invoice.id)
                  const previousPaidAmount = Math.max(0, Number(invoice.paidAmount || 0) - Number(initialPaymentAmountByInvoice[invoice.id] ?? 0))
                  return (
                    <tr key={invoice.id} className={`border-b last:border-b-0 ${selected ? 'bg-sky-50/70' : ''}`}>
                      <td className="py-3 pr-4">
                        <Toggle checked={selected} onChange={() => toggleInvoiceSelection(invoice.id)} />
                      </td>
                      <td className="py-3 pr-4 text-slate-700 font-medium">{invoice.invoiceNo}</td>
                      <td className="py-3 pr-4 text-slate-600">{invoice.invoiceDate || '-'}</td>
                      <td className="py-3 pr-4 text-slate-600">{invoice.jobOrderNo || '-'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                        {formatMoney(Number(invoice.totalAmount || 0))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-amber-700">
                        {formatMoney(Number(invoice.depositAmount || 0))}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                        {formatMoney(previousPaidAmount)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-800">
                        {formatMoney(outstandingAmount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Payment Details">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="pb-2 font-medium pr-4">Invoice No.</th>
                  <th className="pb-2 font-medium pr-4">Due Date</th>
                  <th className="pb-2 font-medium pr-4 text-right">Available</th>
                  <th className="pb-2 font-medium pr-4">Full</th>
                  <th className="pb-2 font-medium pr-4">Payment Type</th>
                  <th className="pb-2 font-medium pr-4">Payment Date</th>
                  <th className="pb-2 font-medium pr-4 text-right">Amount Paid</th>
                  <th className="pb-2 font-medium pr-4">Reference No.</th>
                  <th className="pb-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400">
                      Select an invoice to create payment details.
                    </td>
                  </tr>
                )}
                {detailRows.map(row => {
                  const invoice = invoiceById[row.invoiceId]
                  const availableAmount = row.invoiceId ? getRowAvailableAmount(detailRows, row.invoiceId, row.key) : 0
                  const paymentTypeOptions = getPaymentTypeOptionsForRow(row)
                  return (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white min-w-[12rem]">
                          <Search className="text-slate-400 shrink-0" size={15} />
                          <select
                            value={row.invoiceId}
                            onChange={e => updateDetailRow(row.key, { invoiceId: e.target.value })}
                            className="w-full bg-transparent outline-none text-sm"
                          >
                            <option value="">Select invoice</option>
                            {selectedInvoiceOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-slate-600">{invoice?.dueDate || '-'}</span>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-700">
                        {formatMoney(availableAmount)}
                      </td>
                      <td className="py-3 pr-4">
                        <Toggle
                          checked={row.isFullyPaid}
                          onChange={value => updateDetailRow(row.key, {
                            isFullyPaid: value,
                            amountPaid: value && row.invoiceId ? getRowAvailableAmount(detailRows, row.invoiceId, row.key) : row.amountPaid,
                          })}
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white min-w-[13rem]">
                          <CreditCard className="text-slate-400 shrink-0" size={15} />
                          <select
                            value={row.paymentTypeParameterId}
                            onChange={e => updateDetailRow(row.key, { paymentTypeParameterId: e.target.value })}
                            className="w-full bg-transparent outline-none text-sm"
                          >
                            <option value="">Select payment type</option>
                            {paymentTypeOptions.map(type => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white min-w-[11rem]">
                          <Calendar className="text-slate-400 shrink-0" size={15} />
                          <input
                            type="date"
                            value={row.paymentDate}
                            onChange={e => updateDetailRow(row.key, { paymentDate: e.target.value })}
                            className="w-full bg-transparent outline-none text-sm"
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white min-w-[11rem]">
                          <DollarSign className="text-slate-400 shrink-0" size={15} />
                          <CurrencyInput
                            value={Number(row.amountPaid || 0)}
                            onChange={value => updateDetailRow(row.key, { amountPaid: value })}
                            className="w-full bg-transparent outline-none text-sm text-right"
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className={`flex items-center gap-2 border rounded px-3 py-2 bg-white min-w-[13rem] ${hasPaymentReferenceError(row) ? 'border-rose-500' : ''}`}>
                          <Hash className={`${hasPaymentReferenceError(row) ? 'text-rose-500' : 'text-slate-400'} shrink-0`} size={15} />
                          <input
                            value={row.paymentReferenceNo}
                            onChange={e => updateDetailRow(row.key, { paymentReferenceNo: e.target.value })}
                            placeholder="Reference no."
                            className="w-full bg-transparent outline-none text-sm"
                          />
                        </div>
                        {hasPaymentReferenceError(row) && (
                          <div className="mt-1 text-sm text-rose-600">Required for non-cash payment types</div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailRow(row.key)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded bg-rose-500 text-white hover:bg-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={handleAddPaymentOption}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium"
            >
              <Plus size={14} />
              Add Payment Option
            </button>
          </div>
        </Section>

        <Section title="Payment Summary">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,1fr)] gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-slate-700">Remarks</label>
              <div className="mt-2 bg-white border rounded">
                <textarea
                  value={form.remarks}
                  onChange={e => updateForm('remarks', e.target.value)}
                  placeholder="Optional remarks"
                  className="w-full p-3 bg-transparent outline-none h-36 text-sm resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryTile label="Invoice Total" value={summary.invoiceTotalAmount} />
              <SummaryTile label="VAT (12%)" value={summary.vat12} />
              <SummaryTile label="Applied Deposit" value={summary.existingDepositAmount} tone="warning" />
              <SummaryTile label="Previous Payments" value={summary.previousPaidAmount} />
              <SummaryTile label="Outstanding" value={summary.outstandingAmount} tone="strong" />
              <SummaryTile label="This Payment" value={summary.currentPaymentAmount} tone="success" />
              <div className="sm:col-span-2">
                <SummaryTile label="Remaining Balance" value={summary.remainingBalance} tone={summary.remainingBalance <= 0.0001 ? 'success' : 'strong'} />
              </div>

              {summary.depositTaggedAmount > 0 && (
                <div className="sm:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Deposit-tagged amount in this payment: {formatMoney(summary.depositTaggedAmount)}
                </div>
              )}

              {summary.overpaymentAmount > 0 && (
                <div className="sm:col-span-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  Payment exceeds outstanding balance by {formatMoney(summary.overpaymentAmount)}
                </div>
              )}
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm inline-flex items-center gap-2' + (saving ? ' opacity-70 cursor-not-allowed' : '')}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
