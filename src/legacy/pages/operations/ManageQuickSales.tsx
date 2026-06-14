// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { Search, Hash, Calendar, File, User, Plus, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, DollarSign, CreditCard, Tag, X } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import managementService from '../../services/managementService'
import { getNextQuickSaleReferenceNo, getQuickSaleById, saveQuickSale, updateQuickSale } from '../../services/operationService'
import { fetchCustomers } from '../../services/customerService'
import { getUsers } from '../../services/adminService'
import { getJobStatuses, getParametersByGroup } from '../../services/configService'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'
import PriceEditLockedBadge from '../../components/rbac/PriceEditLockedBadge'
import { useCanEditPricePermission } from '../../hooks/useCanEditPricePermission'

function CurrencyInput({ value, onChange, className, readOnly, disabled }: { value: number; onChange?: (v: number) => void; className?: string; readOnly?: boolean; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const locked = readOnly || disabled
  function handleFocus() { if (locked) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { if (locked) return; setInputVal(e.target.value) }
  function handleBlur() { if (locked) return; setFocused(false); onChange?.(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} readOnly={readOnly} disabled={disabled} className={className} />
}

function normalizeOptions(items: any[]): any[] {
  return items.map(item => {
    const id = item.id !== undefined ? item.id
      : (Object.entries(item).find(([k, v]) => k !== 'id' && /id$/i.test(k) && v !== undefined)?.[1])
    const name = item.name !== undefined ? item.name
      : (Object.entries(item).find(([k]) => /name/i.test(k))?.[1] ?? '')
    return { ...item, id, name }
  })
}

function normalizeUsers(items: any[]): any[] {
  return items.map(item => {
    const id = item.id ?? item.userId ?? item.Id ?? item.UserId ?? ''
    const firstName = String(item.firstName ?? item.FirstName ?? item.firstname ?? '')
    const lastName = String(item.lastName ?? item.LastName ?? item.lastname ?? '')
    const name = String(
      item.name
      ?? item.fullName
      ?? [firstName, lastName].filter(Boolean).join(' ').trim()
      ?? item.username
      ?? item.email
      ?? ''
    ).trim()
    const subtitle = String(
      item.position
      ?? item.Position
      ?? item.jobTitle
      ?? item.JobTitle
      ?? item.roleName
      ?? item.RoleName
      ?? item.email
      ?? ''
    ).trim()
    return { ...item, id: String(id), name, subtitle }
  }).filter(item => item.id && item.name)
}

function normalizePaymentTypes(items: any[]): any[] {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    groupName: String(item.parameterGroupName ?? item.ParameterGroupName ?? item.groupName ?? item.GroupName ?? ''),
  })).filter(item => item.id && item.name)
}

function isCashPaymentType(option?: { name?: string } | null): boolean {
  return String(option?.name ?? '').trim().toLowerCase() === 'cash'
}

function normalizeJobStatuses(items: any[]): Array<{ id: string; name: string; code: string }> {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    code: String(item.code ?? item.Code ?? item.name ?? item.Name ?? '').trim().toUpperCase(),
  })).filter(item => item.id)
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

type SearchableSelectOption = {
  value: string
  label: string
  subtitle?: string
}

function SearchableSelect({
  options,
  value,
  onChange,
  onClear,
  placeholder,
  noResultsText,
}: {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  noResultsText?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const filtered = query.trim()
    ? options.filter(option =>
        option.label.toLowerCase().includes(query.toLowerCase())
        || String(option.subtitle ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
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
        <div
          className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-64 overflow-y-auto"
          onMouseDown={e => e.preventDefault()}
        >
          {filtered.length > 0 ? filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setQuery('')
                setOpen(false)
              }}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${option.value === value ? 'bg-sky-50' : ''}`}
            >
              <div className="text-sm text-slate-700">{option.label}</div>
              {option.subtitle && <div className="text-xs text-slate-500">{option.subtitle}</div>}
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-500">{noResultsText ?? 'No results found.'}</div>
          )}
        </div>
      )}
    </div>
  )
}

interface ProductRow { key: string; productId: string | number; productName: string; price: number; qty: number; amount: number; search: string; suggestions: any[]; showDrop: boolean; stockOnHand?: number; stockStatus?: string; lowStockThreshold?: number; unitOfMeasureName?: string; originalQty?: number }

let _rowKey = 0
const newProdRow = (): ProductRow => ({ key: String(++_rowKey), productId: '', productName: '', price: 0, qty: 1, amount: 0, search: '', suggestions: [], showDrop: false })
const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
const fmtQty = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0)
const stockOnHandOf = (product: any) => Number(product?.stockOnHand ?? product?.StockOnHand ?? 0) || 0
const productStockFields = (product: any) => ({
  stockOnHand: stockOnHandOf(product),
  stockStatus: String(product?.stockStatus ?? product?.StockStatus ?? ''),
  lowStockThreshold: Number(product?.lowStockThreshold ?? product?.LowStockThreshold ?? product?.reorderLevel ?? product?.ReorderLevel ?? 5),
  unitOfMeasureName: String(product?.unitOfMeasure?.name ?? product?.UnitOfMeasure?.Name ?? product?.unitOfMeasureName ?? product?.UnitOfMeasureName ?? ''),
})

function stockStatusForQuantity(available: number, threshold?: number, fallback?: string) {
  if (available <= 0) return 'Out of Stock'
  if (available <= Number(threshold ?? 5)) return 'Low Stock'
  return fallback && !/out|low/i.test(fallback) ? fallback : 'In Stock'
}

function StockBadge({ status }: { status?: string }) {
  const normalized = String(status ?? '').toLowerCase()
  const classes = normalized.includes('out')
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : normalized.includes('low')
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-emerald-50 text-emerald-700 ring-emerald-200'

  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${classes}`}>{status || 'In Stock'}</span>
}

function StockAvailabilityPill({ available, unit, status, threshold, requested }: { available: number; unit?: string; status?: string; threshold?: number; requested?: number }) {
  const requestedQty = Number(requested ?? 0) || 0
  const exceedsStock = requestedQty > available
  const tone = available <= 0 || exceedsStock
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : 'border-slate-200 bg-slate-50 text-slate-700'
  const unitLabel = unit || 'units'
  const title = exceedsStock
    ? `Available ${fmtQty(available)} ${unitLabel}. Requested ${fmtQty(requestedQty)}.`
    : `Available ${fmtQty(available)} ${unitLabel}.`

  return (
    <div className={`inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-xs ${tone}`} title={title}>
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Available</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmtQty(available)}</span>
      <span className="shrink-0 text-slate-500">{unitLabel}</span>
      <StockBadge status={stockStatusForQuantity(available, threshold, status)} />
      {exceedsStock && <span className="shrink-0 font-semibold text-rose-700">Need {fmtQty(requestedQty)}</span>}
    </div>
  )
}

export default function ManageQuickSales(){
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { id } = params
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const showIsChanganOption = useShowIsChanganOption()
  const canEditPrice = useCanEditPricePermission()

  const [form, setForm] = useState<any>({
    isChangan: false,
    isSettled: false,
    status: 'OPEN',
    referenceNo: '',
    transactionDate: new Date().toISOString().slice(0,10),
    paymentReferenceNo: '',
    customerId: '',
    customer: '',
    paymentTypeParameterId: '',
    salesPersonUserId: '',
    remarks: '',
    discount: 0,
    payment: 0
  })

  function updateField(k:string, v:any){ setForm((f:any)=>({ ...f, [k]: v })) }

  const [productRows, setProductRows] = useState<ProductRow[]>([newProdRow()])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; mobile: string; clientType: 'BOSCH' | 'CHANGAN' }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; subtitle?: string }>>([])
  const [paymentTypes, setPaymentTypes] = useState<Array<{ id: string; name: string; groupName: string }>>([])
  const [jobStatuses, setJobStatuses] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [prodPage, setProdPage] = useState(0)
  const [prodRpp, setProdRpp] = useState(50)
  const [saving, setSaving] = useState(false)
  const [showValidationErrors, setShowValidationErrors] = useState(false)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const [productsResult, customersResult, usersResult, paymentTypesResult, jobStatusesResult, nextReferenceResult] = await Promise.all([
          managementService.getProducts(),
          fetchCustomers(),
          getUsers(),
          getParametersByGroup('PAYMENT TYPE'),
          getJobStatuses(),
          isAdd ? getNextQuickSaleReferenceNo() : Promise.resolve(null),
        ])
        if (!mounted) return

        setAllProducts(normalizeOptions(Array.isArray(productsResult) ? productsResult : []))
        setCustomers((customersResult?.customers ?? []).map((customer: any) => ({
          id: String(customer.id ?? ''),
          name: String(customer.name ?? '').trim(),
          mobile: String(customer.mobile ?? ''),
          clientType: customer.clientType === 'CHANGAN' ? 'CHANGAN' : 'BOSCH',
        })).filter((customer: any) => customer.id && customer.name))
        setUsers(normalizeUsers(Array.isArray(usersResult) ? usersResult : []))
        setPaymentTypes(normalizePaymentTypes(Array.isArray(paymentTypesResult) ? paymentTypesResult : []))
        const normalizedJobStatuses = normalizeJobStatuses(Array.isArray(jobStatusesResult) ? jobStatusesResult : [])
        setJobStatuses(normalizedJobStatuses)

        if (isAdd) {
          const openStatus = normalizedJobStatuses.find(status =>
            status.code.includes('OPEN') || status.name.toUpperCase().includes('OPEN')
          )
          setForm((current: any) => ({
            ...current,
            jobStatusId: current.jobStatusId || String(openStatus?.id ?? ''),
            referenceNo: String(nextReferenceResult?.referenceNo ?? nextReferenceResult?.ReferenceNo ?? current.referenceNo ?? ''),
          }))
        }
      } catch {
        if (mounted) showToast('Failed to load quick sale dropdown data', 'error')
      }
    })()

    return () => {
      mounted = false
    }
  }, [isAdd, showToast])

  useEffect(() => {
    if (isAdd || !id) return

    let mounted = true

    ;(async () => {
      try {
        const data: any = await getQuickSaleById(id)
        if (!mounted || !data) return

        setForm((current: any) => ({
          ...current,
          isChangan: Boolean(data.isChangan ?? data.IsChangan ?? false),
          referenceNo: String(data.referenceNo ?? data.ReferenceNo ?? ''),
          transactionDate: String(data.transactionDate ?? data.TransactionDate ?? '').slice(0, 10),
          jobStatusId: String(data.jobStatusId ?? data.JobStatusId ?? ''),
          customerId: String(data.customerId ?? data.CustomerId ?? ''),
          paymentTypeParameterId: String(data.paymentTypeParameterId ?? data.PaymentTypeParameterId ?? ''),
          paymentReferenceNo: String(data.paymentReferenceNo ?? data.PaymentReferenceNo ?? ''),
          salesPersonUserId: String(data.salesPersonUserId ?? data.SalesPersonUserId ?? ''),
          remarks: String(data.summary ?? data.Summary ?? ''),
          discount: Number(data.discount ?? data.Discount ?? 0) || 0,
          payment: Number(data.payment ?? data.Payment ?? 0) || 0,
        }))

        const products = Array.isArray(data.products ?? data.Products) ? (data.products ?? data.Products) : []
        _rowKey = 0
        setProductRows(products.length > 0 ? products.map((item: any) => {
          const row = newProdRow()
          const price = Number(item.price ?? item.Price ?? 0) || 0
          const qty = Number(item.qty ?? item.Qty ?? 0) || 0
          const amount = Number(item.amount ?? item.Amount ?? (price * qty)) || 0
          const productName = String(item.productName ?? item.ProductName ?? item.name ?? item.Name ?? '')
          const productId = String(item.productId ?? item.ProductId ?? '')
          const productInfo = allProducts.find(product => String(product.id) === productId)
          return {
            ...row,
            productId,
            productName,
            search: productName,
            price,
            qty,
            amount,
            originalQty: qty,
            ...productStockFields(productInfo),
          }
        }) : [newProdRow()])
        setProdPage(0)
      } catch (error) {
        if (mounted) showToast(error instanceof Error ? error.message : 'Failed to load quick sale', 'error')
      }
    })()

    return () => {
      mounted = false
    }
  }, [id, isAdd, showToast])

  const customerOptions = useMemo(
    () => customers.map(customer => ({
      value: customer.id,
      label: customer.name,
      subtitle: customer.mobile,
    })),
    [customers]
  )

  const userOptions = useMemo(
    () => users.map(user => ({
      value: user.id,
      label: user.name,
      subtitle: user.subtitle,
    })),
    [users]
  )

  const paymentTypeOptions = useMemo(
    () => paymentTypes.map(type => ({
      value: type.id,
      label: type.name,
      subtitle: type.groupName,
    })),
    [paymentTypes]
  )

  const selectedPaymentType = useMemo(
    () => paymentTypes.find(type => type.id === String(form.paymentTypeParameterId ?? '')) ?? null,
    [paymentTypes, form.paymentTypeParameterId]
  )

  const requiresPaymentReferenceNo = Boolean(form.paymentTypeParameterId) && !isCashPaymentType(selectedPaymentType)
  const hasPaymentReferenceNoError = showValidationErrors && requiresPaymentReferenceNo && !String(form.paymentReferenceNo ?? '').trim()

  function handleCustomerChange(customerId: string) {
    const customer = customers.find(item => item.id === customerId)
    setForm((current: any) => ({
      ...current,
      customerId,
      customer: customer?.name ?? '',
      isChangan: customer ? customer.clientType === 'CHANGAN' : false,
    }))
  }

  function updateProdRow(key: string, patch: Partial<ProductRow>) {
    setProductRows(rows => rows.map(r => { if (r.key !== key) return r; const u = { ...r, ...patch }; u.amount = Number(u.price) * Number(u.qty); return u }))
  }
  function searchProd(key: string, q: string) {
    const suggestions = q.trim() ? allProducts.filter(p => (p.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : allProducts.slice(0, 10)
    updateProdRow(key, { productId: '', search: q, productName: q, suggestions, showDrop: true, stockOnHand: undefined, stockStatus: '', lowStockThreshold: undefined, unitOfMeasureName: '', originalQty: 0 })
  }
  function selectProd(key: string, prod: any) {
    const currentRow = productRows.find(row => row.key === key)
    const sameProduct = currentRow ? String(currentRow.productId) === String(prod.id) : false
    const available = stockOnHandOf(prod) + (sameProduct ? Number(currentRow?.originalQty ?? 0) || 0 : 0)
    const name = String(prod.name ?? prod.Name ?? 'selected product')
    if (available <= 0) {
      showToast(`No stock available for ${name}.`, 'error')
      return
    }
    setProductRows(rows => rows.map(r => {
      if (r.key !== key) return r
      const price = Number(prod.sellingPrice ?? prod.price ?? 0)
      const keepOriginalQty = String(r.productId) === String(prod.id)
      return { ...r, productId: prod.id, productName: prod.name, search: prod.name, price, qty: r.qty || 1, amount: price * (r.qty || 1), suggestions: [], showDrop: false, originalQty: keepOriginalQty ? r.originalQty : 0, ...productStockFields(prod) }
    }))
  }

  const productRowProductIds = productRows.map(row => String(row.productId || '')).join('|')

  useEffect(() => {
    if (!allProducts.length) return
    setProductRows(rows => rows.map(row => {
      if (!row.productId) return row
      const product = allProducts.find(item => String(item.id) === String(row.productId))
      return product ? { ...row, ...productStockFields(product) } : row
    }))
  }, [allProducts, productRowProductIds])

  function availableStockForRow(row: ProductRow) {
    return (Number(row.stockOnHand ?? 0) || 0) + (Number(row.originalQty ?? 0) || 0)
  }

  function getProductStockError(rows: ProductRow[]) {
    const selected = new Map<string, { name: string; qty: number; stockOnHand: number; originalQty: number; unit: string }>()
    rows.filter(row => row.productId).forEach(row => {
      const key = String(row.productId)
      const current = selected.get(key) ?? {
        name: row.productName || 'Selected product',
        qty: 0,
        stockOnHand: Number(row.stockOnHand ?? 0) || 0,
        originalQty: 0,
        unit: row.unitOfMeasureName || 'units',
      }
      current.qty += Number(row.qty ?? 0) || 0
      current.stockOnHand = Math.max(current.stockOnHand, Number(row.stockOnHand ?? 0) || 0)
      current.originalQty += Number(row.originalQty ?? 0) || 0
      selected.set(key, current)
    })

    for (const item of selected.values()) {
      const available = item.stockOnHand + item.originalQty
      if (item.qty <= 0) return `Enter a valid quantity for ${item.name}.`
      if (available <= 0) return `No stock available for ${item.name}.`
      if (item.qty > available) return `Only ${fmtQty(available)} ${item.unit} available for ${item.name}. Requested ${fmtQty(item.qty)}.`
    }
    return ''
  }

  const derived = useMemo(()=>{
    const sub = productRows.reduce((s,r)=> s + (Number(r.amount || 0)), 0)
    const vat = Number((sub * 0.12).toFixed(2))
    const discount = Number(form.discount || 0)
    const total = Number((sub + vat - discount).toFixed(2))
    const payment = Number(form.payment || 0)
    const change = Number((payment - total).toFixed(2))
    return { sub, vat, discount, total, payment, change }
  }, [productRows, form.discount, form.payment])

  async function handleSave(){
    if (saving) return
    setShowValidationErrors(true)

    if (typeof currentUserId !== 'number') {
      showToast('Unable to identify the current user', 'error')
      return
    }

    if (requiresPaymentReferenceNo && !String(form.paymentReferenceNo ?? '').trim()) {
      showToast('Payment reference number is required for non-cash payment types', 'error')
      return
    }

    const productStockError = getProductStockError(productRows)
    if (productStockError) {
      showToast(productStockError, 'error')
      return
    }

    setSaving(true)
    try{
      const payload = {
        IsChangan: Boolean(form.isChangan),
        ReferenceNo: String(form.referenceNo ?? '').trim(),
        TransactionDate: form.transactionDate ? new Date(form.transactionDate).toISOString() : undefined,
        CustomerId: form.customerId ? Number(form.customerId) : undefined,
        JobStatusId: form.jobStatusId ? Number(form.jobStatusId) : undefined,
        PaymentTypeParameterId: form.paymentTypeParameterId ? Number(form.paymentTypeParameterId) : undefined,
        PaymentReferenceNo: String(form.paymentReferenceNo ?? '').trim() || undefined,
        SalesPersonUserId: form.salesPersonUserId ? Number(form.salesPersonUserId) : undefined,
        Summary: String(form.remarks ?? '').trim() || undefined,
        SubTotal: derived.sub,
        VAT12: derived.vat,
        Discount: derived.discount,
        TotalAmount: derived.total,
        Payment: derived.payment,
        Change: derived.change,
        Products: productRows.filter(p => p.productId).map(p=>({ productId: Number(p.productId), price: p.price, qty: p.qty, amount: p.amount })),
        CreatedById: currentUserId,
        UpdatedById: currentUserId,
      }
      if (isAdd) await saveQuickSale(payload)
      else await updateQuickSale(id!, payload)
      setShowValidationErrors(false)
      showToast('Quick sale saved', 'success')
      navigate('/operations/quick-sales')
    }catch(e:any){ showToast(e?.message || 'Failed to save', 'error') }finally{ setSaving(false) }
  }

  const prodPageCount = Math.max(1, Math.ceil(productRows.length / prodRpp))
  const pagedProdRows = productRows.slice(prodPage * prodRpp, (prodPage + 1) * prodRpp)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Quick Sale' : 'Manage Quick Sale'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        {/* Quick Sales Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-visible">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Quick Sales Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {showIsChanganOption && (
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">Changan Client?</div>
                    <div className="flex items-center gap-2">
                      <Toggle checked={!!form.isChangan} onChange={v => updateField('isChangan', v)} />
                      <span className="text-sm text-slate-500">{form.isChangan ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Is Settled?</div>
                  <div className="flex items-center gap-2">
                    <Toggle checked={!!form.isSettled} onChange={v => updateField('isSettled', v)} />
                    <span className="text-sm text-slate-500">{form.isSettled ? 'Paid' : 'Unpaid'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <div className="mt-2 flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <select value={String(form.jobStatusId ?? '')} disabled className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed">
                      <option value="">Select status</option>
                      {jobStatuses.map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference No.</label>
                  <div className="mt-2 flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Reference No." value={form.referenceNo} disabled className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Transaction Date</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e=>updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment Reference No.</label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${hasPaymentReferenceNoError ? 'border-rose-500' : ''}`}>
                    <File className={`${hasPaymentReferenceNoError ? 'text-rose-500' : 'text-slate-400'} shrink-0`} size={16} />
                    <input placeholder="Payment Reference No." value={form.paymentReferenceNo} onChange={e=>updateField('paymentReferenceNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {hasPaymentReferenceNoError && <div className="text-rose-600 text-sm mt-1">Required for non-cash payment types</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Customer</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <SearchableSelect
                      options={customerOptions}
                      value={String(form.customerId ?? '')}
                      onChange={handleCustomerChange}
                      onClear={() => handleCustomerChange('')}
                      placeholder="Search customer by name or mobile"
                      noResultsText="No customers found."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment Type</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <SearchableSelect
                      options={paymentTypeOptions}
                      value={String(form.paymentTypeParameterId ?? '')}
                      onChange={value => updateField('paymentTypeParameterId', value)}
                      onClear={() => updateField('paymentTypeParameterId', '')}
                      placeholder="Search payment type"
                      noResultsText="No payment types found."
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Sales Person</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <SearchableSelect
                      options={userOptions}
                      value={String(form.salesPersonUserId ?? '')}
                      onChange={value => updateField('salesPersonUserId', value)}
                      onClear={() => updateField('salesPersonUserId', '')}
                      placeholder="Search sales person"
                      noResultsText="No users found."
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t">
              <div className="text-sm font-medium text-slate-700">Products</div>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="min-w-[1040px] w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-600 text-left">
                      <th className="pb-2 font-medium pr-3 w-1/2">Product Name</th>
                      <th className="pb-2 font-medium pr-3 whitespace-nowrap w-52">Price</th>
                      <th className="pb-2 font-medium pr-3 whitespace-nowrap w-28">Qty</th>
                      <th className="pb-2 font-medium pr-3 whitespace-nowrap w-64">Stock</th>
                      <th className="pb-2 font-medium pr-3 whitespace-nowrap w-40">Amount</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProdRows.map(row => (
                      <tr key={row.key} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 align-middle">
                          <div className="relative">
                            <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
                              <Search className="text-slate-400 shrink-0" size={14} />
                              <input
                                value={row.search}
                                onChange={e => searchProd(row.key, e.target.value)}
                                onFocus={() => { const s = row.search.trim() ? allProducts.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10) : allProducts.slice(0, 10); updateProdRow(row.key, { suggestions: s, showDrop: true }) }}
                                onBlur={() => setTimeout(() => updateProdRow(row.key, { showDrop: false }), 150)}
                                placeholder="Search product..."
                                className="w-full bg-transparent outline-none text-sm"
                              />
                            </div>
                            {row.showDrop && row.suggestions.length > 0 && (
                              <div className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                                {row.suggestions.map((p: any) => {
                                  const available = stockOnHandOf(p)
                                  const blocked = available <= 0
                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => blocked ? showToast(`No stock available for ${p.name ?? 'selected product'}.`, 'error') : selectProd(row.key, p)}
                                      className={`px-3 py-2 text-sm ${blocked ? 'cursor-not-allowed bg-rose-50/50 text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-50'}`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="min-w-0 truncate">{p.name}</span>
                                        <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${blocked ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{fmtQty(available)} on hand</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3 align-middle">
                          <div className={`flex items-center gap-4 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                            <CurrencyInput
                              value={row.price}
                              onChange={v => updateProdRow(row.key, { price: v })}
                              disabled={!canEditPrice}
                              className="min-w-0 flex-1 bg-transparent outline-none text-sm text-right tabular-nums disabled:cursor-not-allowed disabled:text-slate-400"
                            />
                            {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none ml-1" />}
                          </div>
                        </td>
                        <td className="py-2 pr-3 align-middle">
                          <div className="border rounded px-3 py-2 bg-white">
                            <input type="number" step="1" min="1" max={row.productId ? availableStockForRow(row) : undefined} value={row.qty} onChange={e => updateProdRow(row.key, { qty: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-right tabular-nums" />
                          </div>
                        </td>
                        <td className="py-2 pr-3 align-middle whitespace-nowrap">
                          {row.productId ? (
                            <StockAvailabilityPill available={availableStockForRow(row)} unit={row.unitOfMeasureName} status={row.stockStatus} threshold={row.lowStockThreshold} requested={row.qty} />
                          ) : (
                            <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400">Select product</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-middle">
                          <div className="border rounded px-3 py-2 bg-gray-50">
                            <input value={fmt(row.amount)} readOnly className="w-full bg-transparent outline-none text-sm text-right text-slate-500 cursor-not-allowed tabular-nums" />
                          </div>
                        </td>
                        <td className="py-2 align-middle">
                          <button onClick={() => { setProductRows(r => r.filter(x => x.key !== row.key)); setProdPage(0) }} className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select value={prodRpp} onChange={e => { setProdRpp(Number(e.target.value)); setProdPage(0) }} className="border rounded px-1.5 py-1 text-xs bg-white">
                    <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                  </select>
                  <span>{productRows.length === 0 ? '0' : `${prodPage * prodRpp + 1}–${Math.min((prodPage + 1) * prodRpp, productRows.length)}`} of {productRows.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setProdPage(0)} disabled={prodPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={14} /></button>
                  <button onClick={() => setProdPage(p => Math.max(0, p - 1))} disabled={prodPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <button onClick={() => setProdPage(p => Math.min(prodPageCount - 1, p + 1))} disabled={prodPage >= prodPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                  <button onClick={() => setProdPage(prodPageCount - 1)} disabled={prodPage >= prodPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={14} /></button>
                </div>
              </div>

              <div className="flex justify-end mt-3">
                <button onClick={() => setProductRows(r => [...r, newProdRow()])} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium">
                  <Plus size={14} /> Add Product
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Summary</div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">Remarks</label>
                  <div className="mt-2 bg-white border rounded flex-1 flex flex-col">
                    <textarea value={form.remarks} onChange={e => updateField('remarks', e.target.value)} placeholder="Optional remarks" className="w-full flex-1 p-3 bg-transparent outline-none text-sm resize-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-4 justify-center">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-36 shrink-0">Sub Total</span>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <input value={fmt(derived.sub)} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-36 shrink-0">VAT (12%)</span>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <input value={fmt(derived.vat)} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-36 shrink-0">Discount</span>
                    <div className="flex-1 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <CurrencyInput value={Number(form.discount || 0)} onChange={v => updateField('discount', v)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-36 shrink-0">Total Amount <span className="text-rose-600">*</span></span>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <input value={fmt(derived.total)} readOnly className="w-full bg-transparent outline-none text-sm font-semibold text-slate-700 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-36 shrink-0">Payment</span>
                    <div className="flex-1 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <CurrencyInput value={Number(form.payment || 0)} onChange={v => updateField('payment', v)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-36 shrink-0">Change</span>
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <input value={fmt(derived.change)} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate('/operations/quick-sales')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + (saving ? ' opacity-70 cursor-not-allowed' : '')}>{saving ? 'Saving...' : 'Save'}</button>
        </div>

      </div>
    </div>
  )
}
