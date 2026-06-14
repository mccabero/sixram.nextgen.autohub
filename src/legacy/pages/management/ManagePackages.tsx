// @ts-nocheck
import React, { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Tag, Hash, Calendar, DollarSign, Trash2, Plus, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '../../contexts/toast'
import managementService from '../../services/managementService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import PriceEditLockedBadge from '../../components/rbac/PriceEditLockedBadge'
import PackageJobOrderTable from '../../components/tables/PackageJobOrderTable'
import { useCanEditPricePermission } from '../../hooks/useCanEditPricePermission'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

function CurrencyInput({ value, onChange, className, disabled }: { value: number; onChange: (v: number) => void; className?: string; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  function handleFocus() { if (disabled) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { if (disabled) return; setInputVal(e.target.value) }
  function handleBlur() { if (disabled) return; setFocused(false); onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} disabled={disabled} className={className} />
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

function isQuickSalesProduct(product: any) {
  return Boolean(product?.isQuickSalesProduct ?? product?.IsQuickSalesProduct ?? false)
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

function FloatingDropdown({ anchorEl, open, children }: { anchorEl: HTMLElement | null; open: boolean; children: React.ReactNode }) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setStyle(null)
      return
    }

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect()
      const viewportBottom = window.innerHeight
      const availableHeight = Math.max(160, viewportBottom - rect.bottom - 12)
      setStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(320, availableHeight),
        zIndex: 9999,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, anchorEl])

  if (!open || !style) return null

  return createPortal(
    <div style={style} className="bg-white border rounded shadow-lg overflow-y-auto">
      {children}
    </div>,
    document.body
  )
}

interface ServiceRow { key: string; serviceId: string | number; serviceName: string; rate: number; hours: number; amount: number; search: string; suggestions: any[]; showDrop: boolean }
interface ProductRow { key: string; productId: string | number; productName: string; price: number; qty: number; amount: number; search: string; suggestions: any[]; showDrop: boolean; stockOnHand?: number; stockStatus?: string; lowStockThreshold?: number; unitOfMeasureName?: string; partNo?: string }

let _rowKey = 0
const newSvcRow = (): ServiceRow => ({ key: String(++_rowKey), serviceId: '', serviceName: '', rate: 0, hours: 1, amount: 0, search: '', suggestions: [], showDrop: false })
const newProdRow = (): ProductRow => ({ key: String(++_rowKey), productId: '', productName: '', price: 0, qty: 1, amount: 0, search: '', suggestions: [], showDrop: false })
const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
const fmtQty = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0)
const TABS = ['General Information', 'Transaction']
const firstText = (item: any, keys: string[]) => keys.map(k => item?.[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '')
const moneyText = (value: any) => Number(value || 0) ? fmt(Number(value || 0)) : '0.00'
const optionMatches = (item: any, q: string, keys: string[]) => keys.some(k => String(item?.[k] ?? '').toLowerCase().includes(q))
function stockOnHandOf(product: any) {
  return Number(product?.stockOnHand ?? product?.StockOnHand ?? 0) || 0
}
function productStockFields(product: any) {
  return {
    stockOnHand: stockOnHandOf(product),
    stockStatus: String(product?.stockStatus ?? product?.StockStatus ?? ''),
    lowStockThreshold: Number(product?.lowStockThreshold ?? product?.LowStockThreshold ?? product?.reorderLevel ?? product?.ReorderLevel ?? 5),
    unitOfMeasureName: String(product?.unitOfMeasure?.name ?? product?.UnitOfMeasure?.Name ?? product?.unitOfMeasureName ?? product?.UnitOfMeasureName ?? ''),
    partNo: String(product?.partNo ?? product?.PartNo ?? ''),
  }
}
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
  const tone = available <= 0
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : exceedsStock
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-slate-50 text-slate-700'
  const unitLabel = unit || 'units'
  const title = exceedsStock
    ? `Available ${fmtQty(available)} ${unitLabel}. Requested ${fmtQty(requestedQty)}. Package setup does not deduct stock.`
    : `Available ${fmtQty(available)} ${unitLabel}.`

  return (
    <div className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-2.5 py-1.5 text-xs ${tone}`} title={title}>
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Available</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmtQty(available)}</span>
      <span className="shrink-0 text-slate-500">{unitLabel}</span>
      <StockBadge status={stockStatusForQuantity(available, threshold, status)} />
      {exceedsStock && <span className="shrink-0 font-semibold text-amber-700">Need {fmtQty(requestedQty)}</span>}
    </div>
  )
}
const serviceMeta = (svc: any) => [
  firstText(svc, ['code', 'serviceCode', 'sku']),
  firstText(svc, ['categoryName', 'serviceCategoryName', 'groupName']),
  `Rate ${moneyText(svc?.standardRate ?? svc?.rate)}`,
].filter(Boolean).join(' | ')
const productMeta = (prod: any) => [
  firstText(prod, ['code', 'productCode', 'sku']),
  firstText(prod, ['categoryName', 'productCategoryName', 'groupName']),
  `Price ${moneyText(prod?.sellingPrice ?? prod?.price)}`,
  `Stock ${fmtQty(stockOnHandOf(prod))}`,
].filter(Boolean).join(' | ')

export default function ManagePackages() {
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const copyFromId = new URLSearchParams(location.search).get('copyFrom')
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const canEditPrice = useCanEditPricePermission()
  const showIsChanganOption = useShowIsChanganOption()

  const [form, setForm] = useState<any>({ name: '', code: '', incentiveSA: 0, incentiveTech: 0, nextServiceReminderDays: 0, isHideAmount: false, isHideService: false, isHidePartsAndMaterials: false, isDisplayCode: false, summary: '' })
  const [errors, setErrors] = useState<any>({})
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([newSvcRow()])
  const [productRows, setProductRows] = useState<ProductRow[]>([newProdRow()])
  const [allServices, setAllServices] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [svcPage, setSvcPage] = useState(0)
  const [svcRpp, setSvcRpp] = useState(50)
  const [prodPage, setProdPage] = useState(0)
  const [prodRpp, setProdRpp] = useState(50)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const serviceAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const productAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    ;(async () => {
      const [svcs, prods] = await Promise.all([managementService.getServices(), managementService.getProducts({ isQuickSalesProduct: false })])
      setAllServices(normalizeOptions(Array.isArray(svcs) ? svcs : []))
      setAllProducts(normalizeOptions(Array.isArray(prods) ? prods : []).filter(product => !isQuickSalesProduct(product)))
    })()
  }, [])

  function applyPackageData(data: any, duplicate = false) {
    setForm({
      name: duplicate && data.name ? `Copy of ${data.name}` : data.name ?? '',
      code: duplicate && data.code ? `${data.code}-COPY` : data.code ?? '',
      incentiveSA: data.incentiveSA ?? 0,
      incentiveTech: data.incentiveTech ?? 0,
      nextServiceReminderDays: data.nextServiceReminderDays ?? 0,
      isHideAmount: !!data.isHideAmount,
      isHideService: !!data.isHideService,
      isHidePartsAndMaterials: !!data.isHidePartsAndMaterials,
      isDisplayCode: !!data.isDisplayCode,
      summary: data.summary ?? '',
    })
    const pkgServices = Array.isArray(data.packageServices) && data.packageServices.length ? data.packageServices : (Array.isArray(data.services) ? data.services : [])
    setServiceRows(pkgServices.length
      ? pkgServices.map((s: any) => { const svc = s.service ?? s; const r = Number(s.rate ?? svc.standardRate ?? 0); const h = Number(s.hours ?? svc.standardHours ?? 1); return { key: String(++_rowKey), serviceId: svc.id ?? s.serviceId ?? '', serviceName: svc.name ?? s.serviceName ?? '', rate: r, hours: h, amount: r * h, search: svc.name ?? s.serviceName ?? '', suggestions: [], showDrop: false } })
      : [newSvcRow()])
    const pkgProducts = Array.isArray(data.packageProducts) && data.packageProducts.length ? data.packageProducts : (Array.isArray(data.products) ? data.products : [])
    setProductRows(pkgProducts.length
      ? pkgProducts.map((p: any) => {
        const prod = p.product ?? p
        const pid = prod.id ?? p.productId ?? ''
        const pr = Number(p.price ?? prod.sellingPrice ?? 0)
        const q = Number(p.qty ?? 1)
        const productInfo = allProducts.find(item => String(item.id) === String(pid)) ?? prod
        return { key: String(++_rowKey), productId: pid, productName: prod.name ?? p.productName ?? '', price: pr, qty: q, amount: pr * q, search: prod.name ?? p.productName ?? '', suggestions: [], showDrop: false, ...productStockFields(productInfo) }
      })
      : [newProdRow()])
    setIsDirty(duplicate)
  }

  useEffect(() => {
    if (!id || isAdd) return
    ;(async () => {
      try {
        const data: any = await managementService.getPackage(id as string)
        if (data) applyPackageData(data)
      } catch { showToast('Error loading Package', 'error') }
    })()
  }, [id, location.pathname])

  useEffect(() => {
    if (!isAdd || !copyFromId) return
    ;(async () => {
      try {
        const data: any = await managementService.getPackage(copyFromId)
        if (data) applyPackageData(data, true)
      } catch { showToast('Error loading Package', 'error') }
    })()
  }, [isAdd, copyFromId])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty || isSaving) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, isSaving])

  function updateField(key: string, value: any) {
    setIsDirty(true)
    setForm((f: any) => ({ ...f, [key]: value }))
    setErrors((e: any) => ({ ...e, [key]: '' }))
  }

  const subTotal = useMemo(() => serviceRows.reduce((s, r) => s + r.amount, 0) + productRows.reduce((s, r) => s + r.amount, 0), [serviceRows, productRows])
  const vat = useMemo(() => showIsChanganOption ? subTotal * 0.12 : 0, [showIsChanganOption, subTotal])
  const totalAmount = useMemo(() => showIsChanganOption ? subTotal + vat : subTotal, [showIsChanganOption, subTotal, vat])

  function updateSvcRow(key: string, patch: Partial<ServiceRow>, markDirty = true) {
    if (markDirty) setIsDirty(true)
    setServiceRows(rows => rows.map(r => { if (r.key !== key) return r; const u = { ...r, ...patch }; u.amount = Number(u.rate) * Number(u.hours); return u }))
  }
  function searchSvc(key: string, q: string) {
    const query = q.toLowerCase()
    const suggestions = q.trim() ? allServices.filter(s => optionMatches(s, query, ['name', 'code', 'serviceCode', 'description', 'categoryName', 'serviceCategoryName'])).slice(0, 10) : allServices.slice(0, 10)
    updateSvcRow(key, { search: q, serviceName: q, suggestions, showDrop: true })
  }
  function selectSvc(key: string, svc: any) {
    setIsDirty(true)
    setServiceRows(rows => rows.map(r => { if (r.key !== key) return r; const rate = Number(svc.standardRate ?? svc.rate ?? 0); const hours = Number(svc.standardHours ?? r.hours ?? 1); return { ...r, serviceId: svc.id, serviceName: svc.name, search: svc.name, rate, hours, amount: rate * hours, suggestions: [], showDrop: false } }))
  }

  function updateProdRow(key: string, patch: Partial<ProductRow>, markDirty = true) {
    if (markDirty) setIsDirty(true)
    setProductRows(rows => rows.map(r => { if (r.key !== key) return r; const u = { ...r, ...patch }; u.amount = Number(u.price) * Number(u.qty); return u }))
  }
  function searchProd(key: string, q: string) {
    const query = q.toLowerCase()
    const suggestions = q.trim() ? allProducts.filter(p => optionMatches(p, query, ['name', 'code', 'productCode', 'sku', 'description', 'categoryName', 'productCategoryName'])).slice(0, 10) : allProducts.slice(0, 10)
    updateProdRow(key, { productId: '', search: q, productName: q, suggestions, showDrop: true, stockOnHand: undefined, stockStatus: '', lowStockThreshold: undefined, unitOfMeasureName: '', partNo: '' })
  }
  function selectProd(key: string, prod: any) {
    const available = stockOnHandOf(prod)
    const name = String(prod.name ?? prod.Name ?? 'selected product')
    if (available <= 0) {
      showToast(`Stock advisory: ${name} currently has no stock on hand. Package setup was not deducted.`, 'info')
    }
    setIsDirty(true)
    setProductRows(rows => rows.map(r => { if (r.key !== key) return r; const price = Number(prod.sellingPrice ?? prod.price ?? 0); return { ...r, productId: prod.id, productName: prod.name, search: prod.name, price, qty: r.qty || 1, amount: price * (r.qty || 1), suggestions: [], showDrop: false, ...productStockFields(prod) } }))
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
    return Number(row.stockOnHand ?? 0) || 0
  }

  function getProductQuantityError(rows: ProductRow[]) {
    const invalid = rows.find(row => row.productId && (Number(row.qty ?? 0) || 0) <= 0)
    return invalid ? `Enter a valid quantity for ${invalid.productName || 'selected product'}.` : ''
  }

  function getProductStockAdvisory(rows: ProductRow[]) {
    const selected = new Map<string, { name: string; qty: number; available: number; unit: string }>()
    rows.filter(row => row.productId).forEach(row => {
      const key = String(row.productId)
      const current = selected.get(key) ?? {
        name: row.productName || 'Selected product',
        qty: 0,
        available: availableStockForRow(row),
        unit: row.unitOfMeasureName || 'units',
      }
      current.qty += Number(row.qty ?? 0) || 0
      current.available = Math.max(current.available, availableStockForRow(row))
      selected.set(key, current)
    })

    for (const item of selected.values()) {
      if (item.available <= 0) return `No stock available for ${item.name}.`
      if (item.qty > item.available) return `Only ${fmtQty(item.available)} ${item.unit} available for ${item.name}. Requested ${fmtQty(item.qty)}.`
    }
    return ''
  }

  function validate() { const e: any = {}; if (!form.name || !String(form.name).trim()) e.name = 'Required'; if (!form.code || !String(form.code).trim()) e.code = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  async function handleSave() {
    if (isSaving) return
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    const productQuantityError = getProductQuantityError(productRows)
    if (productQuantityError) { showToast(productQuantityError, 'error'); return }
    const productStockAdvisory = getProductStockAdvisory(productRows)
    if (productStockAdvisory) showToast(`Stock advisory only: ${productStockAdvisory} Package setup was not deducted.`, 'info')
    setIsSaving(true)
    try {
      const body: any = { name: form.name, code: form.code, incentiveSA: Number(form.incentiveSA) || 0, incentiveTech: Number(form.incentiveTech) || 0, nextServiceReminderDays: Number(form.nextServiceReminderDays) || 0, isHideAmount: !!form.isHideAmount, isHideService: !!form.isHideService, isHidePartsAndMaterials: !!form.isHidePartsAndMaterials, isDisplayCode: !!form.isDisplayCode, summary: form.summary, subTotal, vat12: vat, totalAmount, packageServices: serviceRows.filter(r => r.serviceId).map(r => ({ serviceId: r.serviceId, rate: r.rate, hours: r.hours, amount: r.amount })), packageProducts: productRows.filter(r => r.productId).map(r => ({ productId: r.productId, price: r.price, qty: r.qty, amount: r.amount })) }
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await managementService.createPackage(body)
      else await managementService.updatePackage(id as string, body)
      setIsDirty(false)
      showToast(isAdd ? 'Package added' : 'Package updated', 'success')
      navigate('/management/packages')
    } catch { showToast('Error saving Package', 'error') }
    finally { setIsSaving(false) }
  }

  function handleCancel() {
    if (isDirty && !window.confirm('Discard unsaved package changes?')) return
    navigate('/management/packages')
  }

  const svcPageCount = Math.max(1, Math.ceil(serviceRows.length / svcRpp))
  const pagedSvcRows = serviceRows.slice(svcPage * svcRpp, (svcPage + 1) * svcRpp)
  const prodPageCount = Math.max(1, Math.ceil(productRows.length / prodRpp))
  const pagedProdRows = productRows.slice(prodPage * prodRpp, (prodPage + 1) * prodRpp)
  const serviceTotal = serviceRows.reduce((sum, row) => sum + row.amount, 0)
  const productTotal = productRows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Package' : 'Manage Package'}</h2>
      </div>

      <div className="mt-4">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px space-x-2">
            {(isAdd ? [TABS[0]] : TABS).map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 ${activeTab === index ? 'border-b-2 border-bosch-blue text-bosch-blue' : 'text-slate-600 hover:text-bosch-blue'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 0 && (
            <div className="flex flex-col gap-4">
              {/* Package Information */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Package Information</div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Package Name <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Tag className="text-slate-400 shrink-0" size={16} />
                          <input placeholder="Package Name" value={form.name} onChange={e => updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                        {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Package Code <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Hash className="text-slate-400 shrink-0" size={16} />
                          <input placeholder="Package Code" value={form.code} onChange={e => updateField('code', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                        {errors.code && <div className="text-rose-600 text-sm mt-1">{errors.code}</div>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Incentive (SA) <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <DollarSign className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.incentiveSA)} onChange={v => updateField('incentiveSA', v)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Incentive (Technician) <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <DollarSign className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.incentiveTech)} onChange={v => updateField('incentiveTech', v)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </div>
                      <div className="sm:col-start-3 sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Next Service Reminder (Days) <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Calendar className="text-slate-400 shrink-0" size={16} />
                          <input type="number" value={form.nextServiceReminderDays} onChange={e => updateField('nextServiceReminderDays', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Printout Options */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Line Items Printout Options</div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      {([
                        { key: 'isHideAmount',           label: 'Show amounts on printout', inverted: true },
                        { key: 'isHideService',           label: 'Show services on printout', inverted: true },
                        { key: 'isHidePartsAndMaterials', label: 'Show products on printout', inverted: true },
                        { key: 'isDisplayCode',           label: 'Display package code', inverted: false },
                      ] as const).map(({ key, label, inverted }) => {
                        const checked = inverted ? !form[key] : !!form[key]
                        return (
                          <div key={key}>
                            <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
                            <div className="flex items-center gap-2">
                              <Toggle checked={checked} onChange={v => updateField(key, inverted ? !v : v)} />
                              <span className="text-sm text-slate-500">{checked ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Services / Labor */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border">
                  <div className="bg-gray-100 px-4 py-2 flex flex-wrap items-center justify-between gap-2 rounded-t">
                    <div className="text-sm font-medium text-slate-700">Services / Labor</div>
                    <div className="text-xs text-slate-500">{serviceRows.length} rows | Total {fmt(serviceTotal)}</div>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-[760px] w-full table-fixed text-sm">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b text-slate-600 text-left">
                            <th className="pb-2 font-medium pr-3 w-12 text-center">#</th>
                            <th className="pb-2 font-medium pr-3 w-1/2">Service Name</th>
                            <th className="pb-2 font-medium pr-3 text-right">Rate</th>
                            <th className="pb-2 font-medium pr-3 text-right">Hours</th>
                            <th className="pb-2 font-medium pr-3 text-right">Amount</th>
                            <th className="pb-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedSvcRows.map((row, index) => (
                            <tr key={row.key} className="border-b last:border-b-0 hover:bg-slate-50/70">
                              <td className="py-2 pr-3 text-center align-middle text-xs text-slate-400">{svcPage * svcRpp + index + 1}</td>
                              <td className="py-2 pr-3">
                                <div className="relative" ref={node => { serviceAnchorRefs.current[row.key] = node }}>
                                  <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
                                    <Search className="text-slate-400 shrink-0" size={14} />
                                    <input
                                      value={row.search}
                                      onChange={e => searchSvc(row.key, e.target.value)}
                                      onFocus={() => { const q = row.search.toLowerCase(); const s = row.search.trim() ? allServices.filter(x => optionMatches(x, q, ['name', 'code', 'serviceCode', 'description', 'categoryName', 'serviceCategoryName'])).slice(0, 10) : allServices.slice(0, 10); updateSvcRow(row.key, { suggestions: s, showDrop: true }, false) }}
                                      onBlur={() => setTimeout(() => updateSvcRow(row.key, { showDrop: false }, false), 150)}
                                      placeholder="Search service..."
                                      className="w-full bg-transparent outline-none text-sm"
                                    />
                                  </div>
                                  <FloatingDropdown anchorEl={serviceAnchorRefs.current[row.key] ?? null} open={row.showDrop && row.suggestions.length > 0}>
                                    <div onMouseDown={e => e.preventDefault()}>
                                      {row.suggestions.map((s: any) => (
                                        <div key={s.id} onClick={() => selectSvc(row.key, s)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                          <div className="font-medium">{s.name}</div>
                                          <div className="mt-0.5 text-xs text-slate-500">{serviceMeta(s)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </FloatingDropdown>
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                <div className={`relative flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                                  <CurrencyInput value={row.rate} onChange={v => updateSvcRow(row.key, { rate: v })} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm text-right tabular-nums disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-20' : ''}`} />
                                  {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                <div className="border rounded px-3 py-2 bg-white">
                                  <input type="number" step="0.01" value={row.hours} onChange={e => updateSvcRow(row.key, { hours: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-right tabular-nums" />
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                <div className="border rounded px-3 py-2 bg-gray-50">
                                  <input value={fmt(row.amount)} readOnly className="w-full bg-transparent outline-none text-sm text-right text-slate-500 cursor-not-allowed tabular-nums" />
                                </div>
                              </td>
                              <td className="py-2">
                                <button onClick={() => { setIsDirty(true); setServiceRows(r => r.filter(x => x.key !== row.key)); setSvcPage(0) }} title="Remove service" className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <select value={svcRpp} onChange={e => { setSvcRpp(Number(e.target.value)); setSvcPage(0) }} className="border rounded px-1.5 py-1 text-xs bg-white">
                          <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                        </select>
                        <span>{serviceRows.length === 0 ? '0' : `${svcPage * svcRpp + 1}-${Math.min((svcPage + 1) * svcRpp, serviceRows.length)}`} of {serviceRows.length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSvcPage(0)} disabled={svcPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={14} /></button>
                        <button onClick={() => setSvcPage(p => Math.max(0, p - 1))} disabled={svcPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                        <button onClick={() => setSvcPage(p => Math.min(svcPageCount - 1, p + 1))} disabled={svcPage >= svcPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                        <button onClick={() => setSvcPage(svcPageCount - 1)} disabled={svcPage >= svcPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={14} /></button>
                      </div>
                    </div>

                    <div className="flex justify-end mt-3">
                      <button onClick={() => { setIsDirty(true); setServiceRows(r => [...r, newSvcRow()]) }} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium">
                        <Plus size={14} /> Add Service
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border">
                  <div className="bg-gray-100 px-4 py-2 flex flex-wrap items-center justify-between gap-2 rounded-t">
                    <div className="text-sm font-medium text-slate-700">Products</div>
                    <div className="text-xs text-slate-500">{productRows.length} rows | Total {fmt(productTotal)}</div>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-[1080px] w-full table-fixed text-sm">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b text-slate-600 text-left">
                            <th className="pb-2 font-medium pr-3 w-12 text-center">#</th>
                            <th className="pb-2 font-medium pr-3 w-1/2">Product Name</th>
                            <th className="pb-2 font-medium pr-3 text-right whitespace-nowrap w-44">Price</th>
                            <th className="pb-2 font-medium pr-3 text-right whitespace-nowrap w-28">Qty</th>
                            <th className="pb-2 font-medium pr-3 whitespace-nowrap w-72">Stock</th>
                            <th className="pb-2 font-medium pr-3 text-right whitespace-nowrap w-40">Amount</th>
                            <th className="pb-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedProdRows.map((row, index) => (
                            <tr key={row.key} className="border-b last:border-b-0 hover:bg-slate-50/70">
                              <td className="py-2 pr-3 text-center align-middle text-xs text-slate-400">{prodPage * prodRpp + index + 1}</td>
                              <td className="py-2 pr-3 align-middle">
                                <div className="relative" ref={node => { productAnchorRefs.current[row.key] = node }}>
                                  <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
                                    <Search className="text-slate-400 shrink-0" size={14} />
                                    <input
                                      value={row.search}
                                      onChange={e => searchProd(row.key, e.target.value)}
                                      onFocus={() => { const q = row.search.toLowerCase(); const s = row.search.trim() ? allProducts.filter(x => optionMatches(x, q, ['name', 'code', 'productCode', 'sku', 'description', 'categoryName', 'productCategoryName'])).slice(0, 10) : allProducts.slice(0, 10); updateProdRow(row.key, { suggestions: s, showDrop: true }, false) }}
                                      onBlur={() => setTimeout(() => updateProdRow(row.key, { showDrop: false }, false), 150)}
                                      placeholder="Search product..."
                                      className="w-full bg-transparent outline-none text-sm"
                                    />
                                  </div>
                                  <FloatingDropdown anchorEl={productAnchorRefs.current[row.key] ?? null} open={row.showDrop && row.suggestions.length > 0}>
                                    <div onMouseDown={e => e.preventDefault()}>
                                      {row.suggestions.map((p: any) => {
                                        const available = stockOnHandOf(p)
                                        const hasStockWarning = available <= 0
                                        return (
                                          <div
                                            key={p.id}
                                            onClick={() => selectProd(row.key, p)}
                                            className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${hasStockWarning ? 'bg-amber-50/60 text-slate-700' : 'text-slate-700'}`}
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="min-w-0">
                                                <div className="truncate font-medium">{p.name}</div>
                                                <div className="mt-0.5 truncate text-xs text-slate-500">{productMeta(p)}</div>
                                              </div>
                                              <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${hasStockWarning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{fmtQty(available)} on hand</span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </FloatingDropdown>
                                </div>
                              </td>
                              <td className="py-2 pr-3 align-middle">
                                <div className={`relative flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                                  <CurrencyInput value={row.price} onChange={v => updateProdRow(row.key, { price: v })} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm text-right tabular-nums disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-20' : ''}`} />
                                  {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                              </td>
                              <td className="py-2 pr-3 align-middle">
                                <div className="border rounded px-3 py-2 bg-white">
                                  <input type="number" step="1" min="1" value={row.qty} onChange={e => updateProdRow(row.key, { qty: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-right tabular-nums" />
                                </div>
                              </td>
                              <td className="py-2 pr-3 align-middle">
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
                                <button onClick={() => { setIsDirty(true); setProductRows(r => r.filter(x => x.key !== row.key)); setProdPage(0) }} title="Remove product" className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <select value={prodRpp} onChange={e => { setProdRpp(Number(e.target.value)); setProdPage(0) }} className="border rounded px-1.5 py-1 text-xs bg-white">
                          <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                        </select>
                        <span>{productRows.length === 0 ? '0' : `${prodPage * prodRpp + 1}-${Math.min((prodPage + 1) * prodRpp, productRows.length)}`} of {productRows.length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setProdPage(0)} disabled={prodPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={14} /></button>
                        <button onClick={() => setProdPage(p => Math.max(0, p - 1))} disabled={prodPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                        <button onClick={() => setProdPage(p => Math.min(prodPageCount - 1, p + 1))} disabled={prodPage >= prodPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                        <button onClick={() => setProdPage(prodPageCount - 1)} disabled={prodPage >= prodPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={14} /></button>
                      </div>
                    </div>

                    <div className="flex justify-end mt-3">
                      <button onClick={() => { setIsDirty(true); setProductRows(r => [...r, newProdRow()]) }} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium">
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
                          <textarea value={form.summary} onChange={e => updateField('summary', e.target.value)} placeholder="Optional remarks" className="w-full flex-1 p-3 bg-transparent outline-none text-sm resize-none" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-4 justify-center">
                        {([
                          ...(showIsChanganOption ? [
                            { label: 'Sub Total', req: true, value: fmt(subTotal) },
                            { label: 'VAT (12%)', req: true, value: fmt(vat) },
                          ] : []),
                          { label: 'Total Amount', req: true, value: fmt(totalAmount) },
                        ]).map(({ label, req, value }) => (
                          <div key={label} className="flex items-center gap-4">
                            <span className="text-sm font-medium text-slate-700 w-36 shrink-0">{label} {req && <span className="text-rose-600">*</span>}</span>
                            <div className="flex-1 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                              <DollarSign className="text-slate-400 shrink-0" size={16} />
                              <input value={value} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 z-20 -mx-1 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className={`grid gap-3 text-xs sm:text-sm ${showIsChanganOption ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    {showIsChanganOption && (
                      <>
                        <div>
                          <div className="text-slate-500">Subtotal</div>
                          <div className="font-semibold tabular-nums text-slate-800">{fmt(subTotal)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">VAT 12%</div>
                          <div className="font-semibold tabular-nums text-slate-800">{fmt(vat)}</div>
                        </div>
                      </>
                    )}
                    <div>
                      <div className="text-slate-500">Total</div>
                      <div className="font-semibold tabular-nums text-bosch-blue">{fmt(totalAmount)}</div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={handleCancel} disabled={isSaving} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm disabled:opacity-60">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className={'inline-flex items-center gap-2 px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + (isSaving ? ' opacity-70 cursor-not-allowed' : '')}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isAdd && activeTab === 1 && (
            <PackageJobOrderTable packageId={id} />
          )}
        </div>
      </div>
    </div>
  )
}
