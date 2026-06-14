// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  Tag,
  Hash,
  Calendar,
  DollarSign,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ShieldCheck,
  Edit2,
  Box,
  Printer,
  UserPlus,
  Check,
  User,
  Wrench
} from 'lucide-react'
import { useToast } from '../contexts/toast'
import ConfirmModal from '../components/ui/ConfirmModal'
import PinVerificationModal from '../components/operations/PinVerificationModal'
import managementService, { getPackages, getPackage } from '../services/managementService'
import { getUsers } from '../services/adminService'
import { getJobStatuses, getServiceGroups } from '../services/configService'
import { completeJobOrder, openJobOrderFormPdf, getInvoicesSummary, unlockJobOrderEditing } from '../services/operationService'
import { fetchVehicleById } from '../services/vehicleService'
import LinkedTransactionNotice from '../components/operations/LinkedTransactionNotice'
import PriceEditLockedBadge from '../components/rbac/PriceEditLockedBadge'
import { findLinkedWorkflowRecord, pickWorkflowId, pickWorkflowReference } from '../utils/workflowLinks'
import { canConvertFromStatus } from '../utils/statusRules'
import { useCanEditPricePermission } from '../hooks/useCanEditPricePermission'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'
import useDebouncedValue from '../hooks/useDebouncedValue'

async function sendJson(path: string, method: string, body?: Record<string, unknown>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    let message = text.trim()
    if (message) {
      try {
        const parsed = JSON.parse(message)
        if (typeof parsed === 'string' && parsed.trim()) message = parsed.trim()
        else if (parsed && typeof parsed === 'object') message = String((parsed as any).message ?? (parsed as any).Message ?? message)
      } catch {
        // keep raw API text
      }
    }
    throw new Error(message || `HTTP ${res.status}`)
  }
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

const saveJobOrder = (body: Record<string, unknown>) =>
  sendJson('/api/operations/joborders', 'POST', body)

const updateJobOrder = (id: string, body: Record<string, unknown>) =>
  sendJson(`/api/operations/joborders/${id}`, 'PUT', body)

const getJobOrderById = (id: string) =>
  sendJson(`/api/operations/joborders/${id}`, 'GET')

function extractInvoiceId(value: any, allowGenericId = true): any {
  if (!value) return null
  if (typeof value !== 'object') return null
  const direct =
    value.invoiceId
    ?? value.InvoiceId
    ?? value.invoiceID
    ?? value.InvoiceID
    ?? (allowGenericId ? (value.id ?? value.Id) : null)
  if (direct) return direct
  const nestedKeys = ['data', 'Data', 'invoice', 'Invoice', 'result', 'Result', 'payload', 'Payload']
  for (const key of nestedKeys) {
    const found = extractInvoiceId(value[key], allowGenericId)
    if (found) return found
  }
  return null
}

function CurrencyInput({ value, onChange, className, readOnly, disabled }: { value: number; onChange?: (v: number) => void; className?: string; readOnly?: boolean; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const locked = readOnly || disabled
  function handleFocus() { if (locked) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { if (locked) return; setInputVal(e.target.value) }
  function handleBlur() { if (locked) return; setFocused(false); onChange && onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
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

function isQuickSalesProduct(product: any) {
  return Boolean(product?.isQuickSalesProduct ?? product?.IsQuickSalesProduct ?? false)
}

function normalizeUsers(items: any[]): any[] {
  return items.map(u => {
    const id = u.id ?? u.userId ?? u.uuid
    const firstName = u.firstName ?? u.FirstName ?? u.firstname ?? ''
    const lastName = u.lastName ?? u.LastName ?? u.lastname ?? ''
    const name = u.name ?? u.fullName ?? ([firstName, lastName].filter(Boolean).join(' ').trim()) ?? u.username ?? u.email ?? ''
    const role = typeof u.role === 'object' && u.role !== null
      ? (u.role.name ?? u.role.Name ?? u.primaryRole ?? u.roleName ?? '')
      : (u.role ?? u.primaryRole ?? u.roleName ?? '')
    const assignedRoles = Array.isArray(u.roles)
      ? u.roles.map((r: any) => typeof r === 'object' && r !== null ? (r.name ?? r.Name ?? '') : String(r ?? '')).filter(Boolean)
      : []
    const position = String(u.position ?? u.Position ?? u.jobTitle ?? u.JobTitle ?? u.title ?? u.designation ?? u.Designation ?? role).trim()
    const isActive = (u.isActive ?? u.IsActive ?? (typeof u.status === 'string' ? (String(u.status).toLowerCase() === 'active') : undefined)) ?? true
    return { ...u, id, name, firstName, lastName, role: String(role ?? '').trim(), position, assignedRoles, isActive }
  })
}

async function apiGet(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(path, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${checked ? 'bg-bosch-blue' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

interface ServiceRow { key: string; serviceId: string | number; serviceName: string; rate: number; hours: number; amount: number; isPackage: boolean; isRequired: boolean; isAdditional: boolean; packageKey?: string; search: string; suggestions: any[]; showDrop: boolean }
interface ProductRow { key: string; productId: string | number; productName: string; price: number; qty: number; amount: number; isPackage: boolean; isRequired: boolean; isAdditional: boolean; packageKey?: string; search: string; suggestions: any[]; showDrop: boolean; stockOnHand?: number; stockStatus?: string; lowStockThreshold?: number; unitOfMeasureName?: string; partNo?: string; originalQty?: number }
interface TechRow { key: string; userId: string | number; userName: string; search: string; suggestions: any[]; showDrop: boolean }

let _rowKey = 0
const newSvcRow = (): ServiceRow => ({ key: String(++_rowKey), serviceId: '', serviceName: '', rate: 0, hours: 1, amount: 0, isPackage: false, isRequired: false, isAdditional: false, search: '', suggestions: [], showDrop: false })
const newProdRow = (): ProductRow => ({ key: String(++_rowKey), productId: '', productName: '', price: 0, qty: 1, amount: 0, isPackage: false, isRequired: false, isAdditional: false, search: '', suggestions: [], showDrop: false })
const newTechRow = (): TechRow => ({ key: String(++_rowKey), userId: '', userName: '', search: '', suggestions: [], showDrop: false })
const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
const fmtQty = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0)

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
  const tone = available <= 0 || exceedsStock
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : 'border-slate-200 bg-slate-50 text-slate-700'
  const unitLabel = unit || 'units'
  const title = exceedsStock
    ? `Available ${fmtQty(available)} ${unitLabel}. Requested ${fmtQty(requestedQty)}.`
    : `Available ${fmtQty(available)} ${unitLabel}.`

  return (
    <div className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-2.5 py-1.5 text-xs ${tone}`} title={title}>
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Available</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmtQty(available)}</span>
      <span className="shrink-0 text-slate-500">{unitLabel}</span>
      <StockBadge status={stockStatusForQuantity(available, threshold, status)} />
      {exceedsStock && <span className="shrink-0 font-semibold text-rose-700">Need {fmtQty(requestedQty)}</span>}
    </div>
  )
}

interface SearchableSelectOption { value: string; label: string }
interface PersonnelOption extends SearchableSelectOption { badge?: string }

function SearchableSelect({ options, value, onChange, disabled, placeholder }: {
  options: SearchableSelectOption[]
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div className="flex-1 relative">
      <input
        type="text"
        value={open ? query : (selected?.label ?? '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm disabled:text-slate-400"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow z-50 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No results</div>
          ) : filtered.map(o => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setQuery(''); setOpen(false) }}
              className={`px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm ${o.value === value ? 'bg-blue-50 font-medium' : ''}`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonnelSelect({ options, value, onChange, disabled, placeholder }: {
  options: PersonnelOption[]
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        String(o.badge ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options

  return (
    <div className="flex-1 relative">
      <input
        type="text"
        value={open ? query : (selected?.label ?? '')}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm disabled:text-slate-400"
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow z-50 max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No results</div>
          ) : filtered.map(o => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setQuery(''); setOpen(false) }}
              className="px-3 py-2 hover:bg-slate-50 cursor-pointer"
            >
              <div className="text-sm text-slate-800">{o.label}</div>
              {o.badge && <div className="text-xs text-slate-400 mt-0.5">{o.badge}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-sky-600 text-white',
  PENDING: 'bg-amber-500 text-white',
  CLOSED: 'bg-slate-400 text-white',
  VOID: 'bg-rose-600 text-white',
  DELETED: 'bg-rose-600 text-white'
}

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  OPEN: ShieldCheck,
  PENDING: Edit2,
  CLOSED: X,
  VOID: X,
  DELETED: X
}

const MAX_TECHNICIANS = 5

let masterDataCache: {
  services?: any[]
  products?: any[]
  users?: any[]
  customers?: any[]
  serviceGroups?: any[]
  jobStatuses?: Array<{ id?: string | number; name: string; code: string }>
} | null = null

const vehiclesByCustomerCache = new Map<string, any[]>()

const ROLE_FILTERS: Record<string, string[]> = {
  advisor: ['ADVISOR', 'SERVICE ADVISOR', 'SA'],
  estimator: ['ESTIMATOR', 'ESTIMATE'],
  approver: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'APPROVER', 'HEAD'],
}

function filterUsersByRole(users: any[], keywords: string[]): any[] {
  if (!keywords.length) return users
  return users.filter(u => {
    if (!u || u.isActive === false) return false
    const haystacks = [
      u.role,
      u.position,
      u.roleName,
      ...(Array.isArray(u.assignedRoles) ? u.assignedRoles : []),
      ...(Array.isArray(u.roles) ? u.roles.map((r: any) => typeof r === 'object' && r !== null ? (r.name ?? r.Name ?? '') : String(r ?? '')) : [])
    ].map(v => String(v ?? '').toUpperCase()).filter(Boolean)
    return keywords.some(kw => haystacks.some(h => h.includes(kw.toUpperCase())))
  })
}

function userDisplayName(u: any): string {
  return `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim()
}

function userBadge(u: any): string {
  return String(u.position ?? u.role ?? '').trim()
}

export default function ManageJobOrder() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const id = params.id
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const selectedVehicleId = searchParams.get('vehicleId')
  const { showToast } = useToast()
  const modalSearchRef = useRef<HTMLInputElement>(null)
  const showIsChanganOption = useShowIsChanganOption()

  const [form, setForm] = useState<any>({
    isChangan: false,
    isPackage: false,
    status: 'OPEN',
    referenceNo: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    expirationDate: '',
    customer: '',
    customerId: '',
    vehicle: '',
    vehicleId: '',
    estimatedDays: 0,
    serviceGroup: '',
    serviceGroupId: '',
    odometer: 0,
    nextServiceReminderDays: 0,
    customerPO: '',
    serviceAdvisorId: '',
    estimatorId: '',
    approvedById: '',
    summary: '',
    laborDiscount: 0,
    productDiscount: 0,
    additionalDiscount: 0
  })
  const [errors, setErrors] = useState<any>({})

  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([newSvcRow()])
  const [productRows, setProductRows] = useState<ProductRow[]>([newProdRow()])
  const [techRows, setTechRows] = useState<TechRow[]>([newTechRow()])
  const [allServices, setAllServices] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [allVehicles, setAllVehicles] = useState<any[]>([])
  const [allServiceGroups, setAllServiceGroups] = useState<any[]>([])
  const [jobStatusList, setJobStatusList] = useState<Array<{ id?: string | number; name: string; code: string }>>([])
  const [rawStatusCandidates, setRawStatusCandidates] = useState<{ id?: string | number | null; code?: string | null } | null>(null)

  const [svcPage, setSvcPage] = useState(0)
  const [svcRpp, setSvcRpp] = useState(50)
  const [prodPage, setProdPage] = useState(0)
  const [prodRpp, setProdRpp] = useState(50)

  const [showPackageModal, setShowPackageModal] = useState(false)
  const [packagesList, setPackagesList] = useState<any[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packageSearch, setPackageSearch] = useState('')
  const debouncedPackageSearch = useDebouncedValue(packageSearch)
  const [pkgPage, setPkgPage] = useState(1)
  const [pkgPageSize, setPkgPageSize] = useState(10)
  const [selectedPackages, setSelectedPackages] = useState<any[]>([])
  const [applyingPkgId, setApplyingPkgId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [linkedInvoice, setLinkedInvoice] = useState<Record<string, any> | null>(null)
  const [isEditUnlocked, setIsEditUnlocked] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const canEditPrice = useCanEditPricePermission()

  useEffect(() => {
    ;(async () => {
      if (masterDataCache) {
        setAllServices(masterDataCache.services ?? [])
        setAllProducts((masterDataCache.products ?? []).filter(product => !isQuickSalesProduct(product)))
        setAllUsers(masterDataCache.users ?? [])
        setAllCustomers(masterDataCache.customers ?? [])
        setAllServiceGroups(masterDataCache.serviceGroups ?? [])
        setJobStatusList(masterDataCache.jobStatuses ?? [])
        return
      }

      const results = await Promise.allSettled([
        managementService.getServices(),
        managementService.getProducts({ isQuickSalesProduct: false }),
        getUsers(),
        apiGet('/api/customers/summary'),
        getServiceGroups().catch(() => []),
        getJobStatuses().catch(() => [])
      ])

      const svcs = results[0].status === 'fulfilled' ? results[0].value : []
      const prods = results[1].status === 'fulfilled' ? results[1].value : []
      const users = results[2].status === 'fulfilled' ? results[2].value : []
      const customersData = results[3].status === 'fulfilled' ? results[3].value : []
      const sgData = results[4].status === 'fulfilled' ? results[4].value : []
      const jobStatuses = results[5].status === 'fulfilled' ? results[5].value : []

      const normalizedServices = normalizeOptions(Array.isArray(svcs) ? svcs : [])
      const normalizedProducts = normalizeOptions(Array.isArray(prods) ? prods : []).filter(product => !isQuickSalesProduct(product))
      const normalizedUsersList = normalizeUsers(Array.isArray(users) ? users : [])

      const rawCustomers: any[] = Array.isArray(customersData)
        ? customersData
        : (customersData?.items ?? customersData?.data ?? [])
      const normalizedCustomers = rawCustomers.map((c: any) => {
        const cid = c.id ?? c.customerId ?? ''
        const first = c.firstName ?? c.first_name ?? ''
        const last = c.lastName ?? c.last_name ?? ''
        const name = (first || last) ? `${first} ${last}`.trim() : (c.name ?? c.customerName ?? String(cid))
        return { ...c, id: cid, name }
      })

      const rawSG: any[] = Array.isArray(sgData) ? sgData : (sgData?.items ?? sgData?.data ?? [])
      const normalizedServiceGroups = rawSG.map((g: any) => ({ id: g.id ?? g.Id ?? '', name: g.name ?? g.Name ?? '' }))

      const mappedJobStatuses = (Array.isArray(jobStatuses) ? jobStatuses : []).map((j: any) => {
        const code = String(j.code ?? j.Code ?? j.name ?? j.Name ?? j.status ?? j.Status ?? '').toUpperCase()
        const name = j.name ?? j.Name ?? j.display ?? j.Status ?? j.status ?? code
        return { id: j.id ?? j.Id ?? '', name: String(name), code }
      })

      masterDataCache = {
        services: normalizedServices,
        products: normalizedProducts,
        users: normalizedUsersList,
        customers: normalizedCustomers,
        serviceGroups: normalizedServiceGroups,
        jobStatuses: mappedJobStatuses
      }

      setAllServices(normalizedServices)
      setAllProducts(normalizedProducts)
      setAllUsers(normalizedUsersList)
      setAllCustomers(normalizedCustomers)
      setAllServiceGroups(normalizedServiceGroups)
      setJobStatusList(mappedJobStatuses)
    })()
  }, [])

  useEffect(() => {
    if (!isAdd || !selectedVehicleId || form.vehicleId) return

    const ctl = new AbortController()
    ;(async () => {
      try {
        const data: any = await fetchVehicleById(selectedVehicleId, ctl.signal)
        const src = data?.data ?? data?.vehicle ?? data
        const customerObj = src?.customer ?? src?.owner ?? null
        const first = String(customerObj?.firstName ?? customerObj?.FirstName ?? '')
        const last = String(customerObj?.lastName ?? customerObj?.LastName ?? '')
        const customerName = `${first} ${last}`.trim()
          || String(customerObj?.name ?? src?.customerName ?? src?.ownerName ?? '')
        const customerId = customerObj?.id ?? customerObj?.Id ?? src?.customerId ?? src?.customer_id ?? src?.ownerId ?? src?.owner_id ?? ''
        const plateNo = String(src?.plateNo ?? src?.plateNumber ?? src?.plate ?? '').trim()
        const makeName = String(src?.vehicleModel?.vehicleMake?.name ?? src?.vehicleModel?.vehicleMake?.Name ?? src?.vehicleMake?.name ?? src?.make ?? '').trim()
        const modelName = String(src?.vehicleModel?.name ?? src?.vehicleModel?.Name ?? src?.model ?? '').trim()
        const makeModel = [makeName, modelName].filter(Boolean).join(' ').trim()
        const vehicleLabel = plateNo ? (makeModel ? `${makeModel} (${plateNo})` : plateNo) : makeModel
        const isChangan = (
          src?.isChangan === true ||
          src?.is_changan === true ||
          Number(src?.isChangan) === 1 ||
          Number(src?.is_changan) === 1 ||
          String(src?.clientType ?? '').toUpperCase() === 'CHANGAN'
        )

        setForm((f: any) => ({
          ...f,
          isChangan,
          customer: customerName || f.customer,
          customerId: customerId || f.customerId,
          vehicle: vehicleLabel || f.vehicle,
          vehicleId: src?.id ?? src?.vehicleId ?? src?.vehicle_id ?? selectedVehicleId,
        }))
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          showToast('Failed to load selected vehicle', 'error')
        }
      }
    })()

    return () => ctl.abort()
  }, [form.vehicleId, isAdd, selectedVehicleId, showToast])

  useEffect(() => {
    const cid = form.customerId
    if (!cid) { setAllVehicles([]); return }
    const cacheKey = String(cid)
    const cached = vehiclesByCustomerCache.get(cacheKey)
    if (cached) {
      setAllVehicles(cached)
      return
    }
    let mounted = true
    apiGet(`/api/Vehicles/by-customer/${cid}`).then(data => {
      if (!mounted) return
      const items: any[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])
      const normalizedVehicles = items.map((v: any) => {
        const vid = v.id ?? v.vehicleId ?? ''
        const plateNo = v.plateNo ?? v.plateNumber ?? v.plate ?? ''
        const makeName = v.vehicleModel?.vehicleMake?.name ?? v.vehicleModel?.vehicleMake?.Name ?? v.vehicleMake?.name ?? v.make ?? ''
        const modelName = v.vehicleModel?.name ?? v.vehicleModel?.Name ?? v.model ?? ''
        const makeModel = [makeName, modelName].filter(Boolean).join(' ')
        const label = plateNo ? (makeModel ? `${makeModel} (${plateNo})` : plateNo) : makeModel
        return { id: vid, name: label, label, plateNo }
      })
      vehiclesByCustomerCache.set(cacheKey, normalizedVehicles)
      setAllVehicles(normalizedVehicles)
    }).catch(() => setAllVehicles([]))
    return () => { mounted = false }
  }, [form.customerId])

  useEffect(() => {
    if (isAdd || !id) return
    let mounted = true
    ;(async () => {
      try {
        const data: any = await getJobOrderById(id)
        if (!mounted || !data) return

        const vehicleObj = data.Vehicle ?? data.vehicle
        const vehicleModel = vehicleObj?.vehicleModel ?? vehicleObj?.VehicleModel
        const vehicleMake = vehicleModel?.vehicleMake ?? vehicleModel?.VehicleMake
        const makeName = String(vehicleMake?.name ?? vehicleMake?.Name ?? '').trim()
        const modelName = String(vehicleModel?.name ?? vehicleModel?.Name ?? '').trim()
        const plateNo = String(vehicleObj?.plateNo ?? vehicleObj?.PlateNo ?? '').trim()
        const makeModel = [makeName, modelName].filter(Boolean).join(' ').trim()
        const vehicleLabel = plateNo ? (makeModel ? `${makeModel} (${plateNo})` : plateNo) : makeModel

        const customerObj = data.Customer ?? data.customer
        const customerName = customerObj
          ? `${customerObj.FirstName ?? customerObj.firstName ?? ''} ${customerObj.LastName ?? customerObj.lastName ?? ''}`.trim()
          : (data.CustomerName ?? data.customerName ?? '')

        const sgObj = data.ServiceGroup ?? data.serviceGroup
        const sgName = sgObj?.name ?? sgObj?.Name ?? data.serviceGroupName ?? ''

        const candId = data.jobStatus?.id ?? data.JobStatus?.Id ?? data.jobStatusId ?? data.JobStatusId ?? null
        const candCodeOrName = String(
          data.jobStatus?.code ?? data.jobStatus?.name ?? data.JobStatus?.Code ?? data.JobStatus?.Name ?? data.status ?? data.Status ?? ''
        ).trim()
        setRawStatusCandidates({ id: candId ?? undefined, code: candCodeOrName || undefined })

        let resolvedCode: string | undefined
        if (Array.isArray(jobStatusList) && jobStatusList.length) {
          if (candId != null) {
            const byId = jobStatusList.find((s: any) => String(s.id) === String(candId))
            if (byId) resolvedCode = String(byId.code ?? byId.name ?? '')
          }
          if (!resolvedCode && candCodeOrName) {
            const cs = candCodeOrName.toUpperCase()
            const byCode = jobStatusList.find((s: any) => String(s.code).toUpperCase() === cs)
            if (byCode) resolvedCode = String(byCode.code)
            else {
              const byName = jobStatusList.find((s: any) => String(s.name).toUpperCase() === cs)
              if (byName) resolvedCode = String(byName.code)
            }
          }
        }

        const rawStatus = String(candCodeOrName || '').toUpperCase()
        const validStatus = rawStatus === 'OPEN' || rawStatus === 'CLOSED' || rawStatus === 'PENDING' ? rawStatus : 'OPEN'

        setForm((f: any) => ({
          ...f,
          status: (resolvedCode ? String(resolvedCode).toUpperCase() : validStatus),
          isChangan: data.IsChangan ?? data.isChangan ?? f.isChangan,
          isPackage: data.IsPackage ?? data.isPackage ?? f.isPackage,
          referenceNo: String(data.ReferenceNo ?? data.referenceNo ?? f.referenceNo ?? ''),
          transactionDate: String(data.TransactionDate ?? data.transactionDate ?? f.transactionDate ?? '').slice(0, 10),
          expirationDate: String(data.ExpirationDate ?? data.expirationDate ?? f.expirationDate ?? '').slice(0, 10),
          estimatedDays: data.EstimatedDays ?? data.estimatedDays ?? f.estimatedDays,
          serviceGroup: sgName || f.serviceGroup,
          serviceGroupId: data.ServiceGroupId ?? data.serviceGroupId ?? f.serviceGroupId,
          customer: customerName || f.customer,
          customerId: data.CustomerId ?? data.customerId ?? customerObj?.Id ?? customerObj?.id ?? f.customerId,
          vehicle: vehicleLabel || f.vehicle,
          vehicleId: data.VehicleId ?? data.vehicleId ?? vehicleObj?.Id ?? vehicleObj?.id ?? f.vehicleId,
          serviceAdvisorId: data.AdvisorUserId ?? data.advisorUserId ?? data.AdvisorUser?.Id ?? f.serviceAdvisorId,
          estimatorId: data.EstimatorUserId ?? data.estimatorUserId ?? data.EstimatorUser?.Id ?? f.estimatorId,
          approvedById: data.ApproverUserId ?? data.approverUserId ?? data.ApproverUser?.Id ?? f.approvedById,
          odometer: data.Odometer ?? data.odometer ?? f.odometer,
          nextServiceReminderDays: data.NextOdometerReminder ?? data.nextOdometerReminder ?? data.nextServiceReminderDays ?? f.nextServiceReminderDays,
          customerPO: data.CustomerPO ?? data.customerPO ?? f.customerPO,
          summary: data.Summary ?? data.summary ?? f.summary,
          laborDiscount: data.LaborDiscount ?? data.laborDiscount ?? f.laborDiscount,
          productDiscount: data.ProductDiscount ?? data.productDiscount ?? f.productDiscount,
          additionalDiscount: data.AdditionalDiscount ?? data.additionalDiscount ?? f.additionalDiscount,
        }))

        const svcArr = data.jobOrderServices ?? data.JobOrderServices ?? data.services ?? data.Services ?? []
        const prodArr = data.jobOrderProducts ?? data.JobOrderProducts ?? data.products ?? data.Products ?? []
        const techArr = data.jobOrderTechnicians ?? data.JobOrderTechnicians ?? data.technicians ?? data.Technicians ?? []
        let parsedDetails: any = null
        const detailsRaw = data.jobOrderDetails ?? data.JobOrderDetails ?? data.details ?? data.Details
        if (!Array.isArray(svcArr) && typeof detailsRaw === 'string' && detailsRaw.trim()) {
          try { parsedDetails = JSON.parse(detailsRaw) } catch { parsedDetails = null }
        } else if (detailsRaw && typeof detailsRaw === 'object') parsedDetails = detailsRaw

        const servicesSource = Array.isArray(svcArr) && svcArr.length ? svcArr : (parsedDetails?.services ?? parsedDetails?.Services ?? [])
        const productsSource = Array.isArray(prodArr) && prodArr.length ? prodArr : (parsedDetails?.products ?? parsedDetails?.Products ?? [])
        const techsSource = Array.isArray(techArr) && techArr.length ? techArr : (parsedDetails?.technicians ?? parsedDetails?.Technicians ?? [])

        if (Array.isArray(servicesSource) && servicesSource.length) {
          setServiceRows(() => servicesSource.map((s: any) => {
            const sid = s.serviceId ?? s.ServiceId ?? s.service?.id ?? s.Service?.id ?? s.Service?.Id ?? s.id ?? ''
            const sname = s.serviceName ?? s.name ?? s.service?.name ?? s.Service?.name ?? s.Service?.Name ?? ''
            const rate = Number(s.rate ?? s.serviceRate ?? s.laborRate ?? s.service?.standardRate ?? s.service?.rate ?? s.Service?.standardRate ?? s.Service?.rate ?? s.standardRate ?? s.price ?? 0) || 0
            const hours = Number(s.hours ?? s.quantity ?? s.qty ?? 1) || 1
            const amount = Number(s.amount ?? s.total ?? (rate * hours)) || (rate * hours)
            const pkgId = s.packageId ?? s.PackageId ?? s.package_id ?? null
            const packageKey = pkgId != null ? String(pkgId) : undefined
            return { key: String(++_rowKey), serviceId: sid, serviceName: sname, rate, hours, amount, isPackage: !!(s.isPackage ?? s.IsPackage), isRequired: !!(s.isRequired ?? s.IsRequired), isAdditional: !!(s.isAdditional ?? s.IsAdditional), packageKey, search: sname, suggestions: [], showDrop: false }
          }))
        }

        if (Array.isArray(productsSource) && productsSource.length) {
          setProductRows(() => productsSource.map((p: any) => {
            const pid = p.productId ?? p.ProductId ?? p.product?.id ?? p.Product?.id ?? p.Product?.Id ?? p.id ?? ''
            const pname = p.productName ?? p.name ?? p.product?.name ?? p.Product?.name ?? p.Product?.Name ?? ''
            const productInfo = p.product ?? p.Product ?? allProducts.find(prod => String(prod.id) === String(pid))
            const price = Number(p.price ?? p.sellingPrice ?? p.unitPrice ?? 0) || 0
            const qty = Number(p.qty ?? p.quantity ?? 1) || 1
            const amount = Number(p.amount ?? p.total ?? (price * qty)) || (price * qty)
            const pkgId = p.packageId ?? p.PackageId ?? p.package_id ?? null
            const packageKey = pkgId != null ? String(pkgId) : undefined
            return { key: String(++_rowKey), productId: pid, productName: pname, price, qty, amount, isPackage: !!(p.isPackage ?? p.IsPackage), isRequired: !!(p.isRequired ?? p.IsRequired), isAdditional: !!(p.isAdditional ?? p.IsAdditional), packageKey, search: pname, suggestions: [], showDrop: false, originalQty: qty, ...productStockFields(productInfo) }
          }))
        }

        if (Array.isArray(techsSource) && techsSource.length) {
          setTechRows(() => techsSource.map((t: any) => {
            const uid = t.userId ?? t.UserId ?? t.technicianUserId ?? t.TechnicianUserId ?? t.technicianUser?.id ?? t.TechnicianUser?.id ?? t.id ?? ''
            const techUser = t.technicianUser ?? t.TechnicianUser ?? null
            const uname = t.userName || t.name || (techUser ? `${techUser.firstName ?? techUser.FirstName ?? ''} ${techUser.lastName ?? techUser.LastName ?? ''}`.trim() : '') || ''
            return { key: String(++_rowKey), userId: uid, userName: uname, search: uname, suggestions: [], showDrop: false }
          }))
        }

        const pkgs = parsedDetails?.packages ?? parsedDetails?.Packages ?? data.packages ?? data.Packages ?? []
        if (Array.isArray(pkgs) && pkgs.length) {
          setSelectedPackages(pkgs.map((p: any) => ({ id: p.id ?? p.code ?? p.Id ?? p.Code ?? p.name ?? p.Name ?? '', name: p.name ?? p.Name ?? p.title ?? p.Title ?? '', isAdditional: !!(p.isAdditional ?? p.IsAdditional) })))
        }
      } catch (err: any) {
        showToast(err instanceof Error ? err.message : 'Failed to load job order', 'error')
      }
    })()
    return () => { mounted = false }
  }, [id, isAdd, showToast])

  useEffect(() => {
    let mounted = true

    async function loadLinkedInvoice() {
      if (isAdd || !id) {
        setLinkedInvoice(null)
        return
      }
      try {
        const invoices: any = await getInvoicesSummary()
        if (!mounted) return
        setLinkedInvoice(findLinkedWorkflowRecord(
          Array.isArray(invoices) ? invoices : [],
          id,
          ['jobOrderId', 'JobOrderId'],
        ))
      } catch {
        if (mounted) setLinkedInvoice(null)
      }
    }

    loadLinkedInvoice()
    return () => { mounted = false }
  }, [id, isAdd])

  useEffect(() => {
    if (!rawStatusCandidates || !Array.isArray(jobStatusList) || !jobStatusList.length) return
    const { id: candId, code: candCode } = rawStatusCandidates
    let resolved: any = null
    if (candId != null) resolved = jobStatusList.find(s => String(s.id) === String(candId))
    if (!resolved && candCode) {
      const cs = String(candCode).toUpperCase()
      resolved = jobStatusList.find(s => String(s.code).toUpperCase() === cs) || jobStatusList.find(s => String(s.name).toUpperCase() === cs)
    }
    if (resolved) {
      setForm((f: any) => {
        const newStatus = String(resolved.code).toUpperCase()
        if (String(f.status) === String(newStatus)) return f
        return { ...f, status: newStatus }
      })
      setRawStatusCandidates(null)
    }
  }, [jobStatusList, rawStatusCandidates])

  function updateField(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }))
    setErrors((e: any) => ({ ...e, [key]: '' }))
  }

  function updateSvcRow(key: string, patch: Partial<ServiceRow>) {
    setServiceRows(rows => rows.map(r => { if (r.key !== key) return r; const u = { ...r, ...patch }; u.amount = Number(u.rate) * Number(u.hours); return u }))
  }
  function searchSvc(key: string, q: string) {
    const suggestions = q.trim() ? allServices.filter(s => (s.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : allServices.slice(0, 10)
    updateSvcRow(key, { search: q, serviceName: q, suggestions, showDrop: true })
  }
  function selectSvc(key: string, svc: any) {
    setServiceRows(rows => rows.map(r => {
      if (r.key !== key) return r
      const rate = Number(svc.standardRate ?? svc.rate ?? 0)
      const hours = Number(svc.standardHours ?? r.hours ?? 1)
      return { ...r, serviceId: svc.id, serviceName: svc.name, search: svc.name, rate, hours, amount: rate * hours, suggestions: [], showDrop: false }
    }))
  }

  function updateProdRow(key: string, patch: Partial<ProductRow>) {
    setProductRows(rows => rows.map(r => { if (r.key !== key) return r; const u = { ...r, ...patch }; u.amount = Number(u.price) * Number(u.qty); return u }))
  }
  function searchProd(key: string, q: string) {
    const suggestions = q.trim() ? allProducts.filter(p => (p.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : allProducts.slice(0, 10)
    updateProdRow(key, { productId: '', search: q, productName: q, suggestions, showDrop: true, stockOnHand: undefined, stockStatus: '', lowStockThreshold: undefined, unitOfMeasureName: '', partNo: '', originalQty: 0 })
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
      if (!product) return row
      return { ...row, ...productStockFields(product) }
    }))
  }, [allProducts, productRowProductIds])

  function availableStockForRow(row: ProductRow) {
    return (Number(row.stockOnHand ?? 0) || 0) + (Number(row.originalQty ?? 0) || 0)
  }

  function getProductStockError(rows: ProductRow[]) {
    const selected = new Map<string, { name: string; qty: number; stockOnHand: number; originalQty: number; unit: string; threshold?: number; status?: string }>()
    rows.filter(row => row.productId).forEach(row => {
      const key = String(row.productId)
      const current = selected.get(key) ?? {
        name: row.productName || 'Selected product',
        qty: 0,
        stockOnHand: Number(row.stockOnHand ?? 0) || 0,
        originalQty: 0,
        unit: row.unitOfMeasureName || 'units',
        threshold: row.lowStockThreshold,
        status: row.stockStatus,
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

  function updateTechRow(key: string, patch: Partial<TechRow>) {
    setTechRows(rows => rows.map(r => r.key === key ? { ...r, ...patch } : r))
  }
  function searchTech(key: string, q: string) {
    const selectedIds = new Set(techRows.filter(r => r.key !== key && r.userId).map(r => String(r.userId)))
    const pool = technicianUsers.filter(u => !selectedIds.has(String(u.id)))
    const query = q.toLowerCase()
    const suggestions = q.trim()
      ? pool.filter(u => {
          const name = String(u.name || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()).toLowerCase()
          const badge = userBadge(u).toLowerCase()
          return name.includes(query) || badge.includes(query)
        }).slice(0, 10)
      : pool.slice(0, 10)
    updateTechRow(key, { search: q, userName: q, suggestions, showDrop: true })
  }
  function selectTech(key: string, u: any) {
    const name = `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim()
    updateTechRow(key, { userId: u.id, userName: name, search: name, suggestions: [], showDrop: false })
  }
  function addTechRow() {
    if (techRows.length >= MAX_TECHNICIANS) return
    setTechRows(rows => [...rows, newTechRow()])
  }

  const subTotal = useMemo(
    () => serviceRows.reduce((s, r) => s + (r.amount || 0), 0) + productRows.reduce((s, r) => s + (r.amount || 0), 0),
    [serviceRows, productRows]
  )
  const vat = useMemo(() => showIsChanganOption ? subTotal * 0.12 : 0, [showIsChanganOption, subTotal])
  const totalDiscount = useMemo(
    () => Number(form.laborDiscount || 0) + Number(form.productDiscount || 0) + Number(form.additionalDiscount || 0),
    [form.laborDiscount, form.productDiscount, form.additionalDiscount]
  )
  const totalAmount = useMemo(() => subTotal + vat - totalDiscount, [subTotal, vat, totalDiscount])
  const activeServiceCount = useMemo(() => serviceRows.filter(r => r.serviceId || r.serviceName).length, [serviceRows])
  const activeProductCount = useMemo(() => productRows.filter(r => r.productId || r.productName).length, [productRows])
  const selectedTechnicianCount = useMemo(() => techRows.filter(r => r.userId).length, [techRows])
  const hasPackageContent = useMemo(
    () => selectedPackages.length > 0 || serviceRows.some(r => r.isPackage || !!r.packageKey) || productRows.some(r => r.isPackage || !!r.packageKey),
    [selectedPackages, serviceRows, productRows]
  )

  const serviceAdvisorOptions = useMemo<PersonnelOption[]>(
    () => filterUsersByRole(allUsers, ROLE_FILTERS.advisor).map(u => ({ value: String(u.id), label: userDisplayName(u), badge: userBadge(u) || undefined })),
    [allUsers]
  )
  const estimatorOptions = useMemo<PersonnelOption[]>(
    () => filterUsersByRole(allUsers, ROLE_FILTERS.estimator).map(u => ({ value: String(u.id), label: userDisplayName(u), badge: userBadge(u) || undefined })),
    [allUsers]
  )
  const approverOptions = useMemo<PersonnelOption[]>(
    () => filterUsersByRole(allUsers, ROLE_FILTERS.approver).map(u => ({ value: String(u.id), label: userDisplayName(u), badge: userBadge(u) || undefined })),
    [allUsers]
  )
  const technicianUsers = useMemo(
    () => filterUsersByRole(allUsers, ['TECH', 'TECHNICIAN']),
    [allUsers]
  )
  const statusOptions = useMemo<SearchableSelectOption[]>(
    () => (jobStatusList.length
      ? jobStatusList.map(s => ({ value: s.code, label: s.name }))
      : [{ value: 'OPEN', label: 'OPEN' }, { value: 'PENDING', label: 'PENDING' }, { value: 'CLOSED', label: 'CLOSED' }]),
    [jobStatusList]
  )

  const svcPageCount = Math.max(1, Math.ceil(serviceRows.length / svcRpp))
  const pagedSvcRows = serviceRows.slice(svcPage * svcRpp, (svcPage + 1) * svcRpp)
  const prodPageCount = Math.max(1, Math.ceil(productRows.length / prodRpp))
  const pagedProdRows = productRows.slice(prodPage * prodRpp, (prodPage + 1) * prodRpp)

  async function loadPackages() {
    setPackagesLoading(true)
    try {
      const pkgs = await getPackages()
      setPackagesList(Array.isArray(pkgs) ? pkgs : [])
    } catch {
      setPackagesList([])
    } finally {
      setPackagesLoading(false)
    }
  }
  function openPackageModal() {
    setShowPackageModal(true)
    loadPackages()
    setTimeout(() => modalSearchRef.current?.focus(), 50)
  }
  useEffect(() => {
    if (!showPackageModal) return
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') setShowPackageModal(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showPackageModal])

  const filteredPackages = packagesList.filter(p => !debouncedPackageSearch || String(p.name || p.title || p.code || p.id).toLowerCase().includes(debouncedPackageSearch.toLowerCase()))
  const totalPackages = filteredPackages.length
  const pkgPageCount = Math.max(1, Math.ceil(totalPackages / pkgPageSize))
  useEffect(() => { if (pkgPage > pkgPageCount) setPkgPage(pkgPageCount) }, [pkgPageCount, pkgPage])
  const pkgPageStart = totalPackages === 0 ? 0 : (pkgPage - 1) * pkgPageSize + 1
  const pkgPageEnd = Math.min(pkgPage * pkgPageSize, totalPackages)
  const currentPkgItems = filteredPackages.slice((pkgPage - 1) * pkgPageSize, pkgPage * pkgPageSize)

  useEffect(() => {
    setForm((f: any) => {
      if (!!f.isPackage === hasPackageContent) return f
      return { ...f, isPackage: hasPackageContent }
    })
  }, [hasPackageContent])

  function getPackageAmount(pkg: any): number {
    if (!pkg) return 0
    const tryNumber = (v: any) => { if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null }
    const candidates = [pkg.totalAmount, pkg.amount, pkg.price, pkg.total, pkg.listPrice, pkg.sellingPrice, pkg.unitPrice, pkg.rate, pkg.cost, pkg.value]
    for (const c of candidates) { const n = tryNumber(c); if (n != null) return n }
    const cents = tryNumber(pkg.amountInCents ?? pkg.priceInCents ?? pkg.totalInCents)
    if (cents != null) return cents / 100
    if (Array.isArray(pkg.items) || Array.isArray(pkg.components) || Array.isArray(pkg.products)) {
      const arr = pkg.items || pkg.components || pkg.products
      const sum = arr.reduce((s: any, it: any) => { const n = tryNumber(it.amount ?? it.price ?? it.total ?? it.unitPrice); return s + (n || 0) }, 0)
      if (sum > 0) return sum
    }
    return 0
  }

  const getPkgKey = (p: any) => String(p?.id ?? p?.Id ?? p?.code ?? p?.Code ?? p?.name ?? p?.Name ?? '')

  function applyPackage(pkg: any) {
    const pkgKey = getPkgKey(pkg)
    const pkgServices = Array.isArray(pkg.packageServices) ? pkg.packageServices : (Array.isArray(pkg.services) ? pkg.services : [])
    const pkgProducts = Array.isArray(pkg.packageProducts) ? pkg.packageProducts : (Array.isArray(pkg.products) ? pkg.products : [])
    const packageStockError = pkgProducts.map((p: any) => {
      const prod = p.product ?? p
      const productInfo = allProducts.find(item => String(item.id) === String(prod.id ?? p.productId ?? '')) ?? prod
      const available = stockOnHandOf(productInfo)
      const qty = Number(p.qty ?? 1) || 1
      const name = String(prod.name ?? p.productName ?? 'package product')
      if (available <= 0) return `No stock available for ${name}. Package was not added.`
      if (qty > available) return `Only ${fmtQty(available)} stock available for ${name}. Package requires ${fmtQty(qty)}.`
      return ''
    }).find(Boolean)

    if (packageStockError) {
      showToast(packageStockError, 'error')
      return
    }

    if (pkgServices.length) {
      setServiceRows(rows => {
        const base = rows.filter(r => r.serviceId || r.serviceName)
        const added = pkgServices.map((s: any) => {
          const svc = s.service ?? s
          const rate = Number(s.rate ?? svc.standardRate ?? 0)
          const hours = Number(s.hours ?? svc.standardHours ?? 1)
          return { key: String(++_rowKey), serviceId: svc.id ?? s.serviceId ?? '', serviceName: svc.name ?? s.serviceName ?? '', rate, hours, amount: rate * hours, isPackage: true, isRequired: !!(s.isRequired ?? s.IsRequired), isAdditional: false, packageKey: pkgKey, search: svc.name ?? s.serviceName ?? '', suggestions: [], showDrop: false }
        })
        return base.length ? [...base, ...added] : added
      })
    }
    if (pkgProducts.length) {
      setProductRows(rows => {
        const base = rows.filter(r => r.productId || r.productName)
        const added = pkgProducts.map((p: any) => {
          const prod = p.product ?? p
          const price = Number(p.price ?? prod.sellingPrice ?? 0)
          const qty = Number(p.qty ?? 1)
          const productInfo = allProducts.find(item => String(item.id) === String(prod.id ?? p.productId ?? '')) ?? prod
          return { key: String(++_rowKey), productId: prod.id ?? p.productId ?? '', productName: prod.name ?? p.productName ?? '', price, qty, amount: price * qty, isPackage: true, isRequired: !!(p.isRequired ?? p.IsRequired), isAdditional: false, packageKey: pkgKey, search: prod.name ?? p.productName ?? '', suggestions: [], showDrop: false, ...productStockFields(productInfo) }
        })
        return base.length ? [...base, ...added] : added
      })
    }

    setSelectedPackages(prev => {
      if (pkgKey && prev.some(px => getPkgKey(px) === pkgKey)) return prev
      return [...prev, pkg]
    })
    setShowPackageModal(false)
  }

  async function handleApplyPackage(pkg: any) {
    const pkgId = pkg.id ?? pkg.Id
    setApplyingPkgId(pkgId)
    try {
      const full = await getPackage(String(pkgId))
      applyPackage(full ?? pkg)
    } catch {
      applyPackage(pkg)
    } finally {
      setApplyingPkgId(null)
    }
  }

  function removeSelectedPackage(idx: number) {
    const pkg = selectedPackages[idx]
    if (pkg) {
      const pkgKey = String(pkg.id ?? pkg.code ?? pkg.name ?? '')
      if (pkgKey) {
        setServiceRows(r => r.filter(row => row.packageKey !== pkgKey))
        setProductRows(r => r.filter(row => row.packageKey !== pkgKey))
      }
    }
    setSelectedPackages(s => s.filter((_, i) => i !== idx))
  }

  function validate() {
    const e: any = {}
    if (!form.referenceNo || !String(form.referenceNo).trim()) e.referenceNo = 'Required'
    if (!form.customerId && (!form.customer || !String(form.customer).trim())) e.customer = 'Required'
    if (totalDiscount > 0 && !String(form.summary ?? '').trim()) e.summary = 'Remarks are required when any discount is greater than 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    const productStockError = getProductStockError(productRows)
    if (productStockError) { showToast(productStockError, 'error'); return }
    setSaving(true)
    try {
      const resolvedJobStatus = jobStatusList.find(s => String(s.code).toUpperCase() === String(form.status).toUpperCase())
      const payload: Record<string, unknown> = {
        ...form,
        isPackage: hasPackageContent,
        advisorUserId: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        estimatorUserId: form.estimatorId ? Number(form.estimatorId) : undefined,
        approverUserId: form.approvedById ? Number(form.approvedById) : undefined,
        nextOdometerReminder: form.nextServiceReminderDays !== '' && form.nextServiceReminderDays != null ? Number(form.nextServiceReminderDays) : undefined,
        createdById: isAdd && form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        jobStatusId: resolvedJobStatus?.id ? Number(resolvedJobStatus.id) : undefined,
        subTotal,
        vat12: vat,
        totalDiscount,
        totalAmount,
        services: serviceRows.filter(r => r.serviceId || r.serviceName).map(r => ({ serviceId: r.serviceId, name: r.serviceName, rate: r.rate, hours: r.hours, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, isAdditional: r.isAdditional, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        products: productRows.filter(r => r.productId || r.productName).map(r => ({ productId: r.productId, name: r.productName, price: r.price, qty: r.qty, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, isAdditional: r.isAdditional, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        technicians: techRows.filter(r => r.userId).map(r => ({ userId: r.userId, name: r.userName })),
        packages: selectedPackages.map(p => ({ id: p.id ?? p.code, packageId: p.id ?? p.code, name: p.name ?? p.title, isAdditional: !!(p.isAdditional ?? p.IsAdditional) }))
      }
      if (isAdd) await saveJobOrder(payload)
      else await updateJobOrder(id as string, payload)
      showToast(isAdd ? 'Job Order added' : 'Job Order updated', 'success')
      navigate('/operations/job-order')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save job order', 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentStatus = String(form.status || 'OPEN')
  const StatusIcon = STATUS_ICONS[currentStatus] || ShieldCheck
  const statusClass = STATUS_STYLES[currentStatus] || 'bg-slate-400 text-white'
  const linkedInvoiceId = pickWorkflowId(linkedInvoice)
  const linkedInvoiceReference = pickWorkflowReference(linkedInvoice)
  const canConvertToInvoice = !isAdd && canConvertFromStatus(currentStatus) && !linkedInvoiceId
  const canUnlockEditing = !isAdd && currentStatus !== 'COMPLETED' && !unlocking
  const isLockedForEditing = !isAdd && !isEditUnlocked

  async function handlePrintJobOrder() {
    if (isAdd || printing || !id) return
    setPrinting(true)
    try {
      await openJobOrderFormPdf(id)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to print job order form', 'error')
    } finally {
      setPrinting(false)
    }
  }

  function handleConvertToInvoice() {
    if (linkedInvoiceId) {
      navigate(`/operations/invoice/${linkedInvoiceId}`)
      return
    }
    if (!canConvertToInvoice || isAdd || !id) return
    setShowCompleteConfirm(true)
  }

  async function confirmCompleteJobOrder() {
    if (!id || completing) return

    setCompleting(true)
    try {
      const invoices: any = await getInvoicesSummary()
      const existingInvoice = findLinkedWorkflowRecord(
        Array.isArray(invoices) ? invoices : [],
        id,
        ['jobOrderId', 'JobOrderId'],
      )
      const existingInvoiceId = pickWorkflowId(existingInvoice)
      if (existingInvoiceId) {
        setLinkedInvoice(existingInvoice)
        setShowCompleteConfirm(false)
        showToast('This job order already has a linked invoice.', 'info')
        navigate(`/operations/invoice/${existingInvoiceId}`)
        return
      }

      const result: any = await completeJobOrder(id, {
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
      })
      const payload = result?.data ?? result?.Data ?? result
      const invoicePayload = payload?.invoice ?? payload?.Invoice ?? payload
      let newInvoiceId = extractInvoiceId(result)

      if (!newInvoiceId) {
        const refreshedJobOrder: any = await getJobOrderById(id)
        newInvoiceId = extractInvoiceId(refreshedJobOrder, false)
      }

      if (!newInvoiceId) {
        const invoices: any = await sendJson('/api/operations/invoices/summary', 'GET')
        const matchedInvoice = (Array.isArray(invoices) ? invoices : [])
          .find((item: any) => String(item?.jobOrderId ?? item?.JobOrderId ?? '') === String(id))
        newInvoiceId = matchedInvoice?.id ?? matchedInvoice?.Id
      }
      if (!newInvoiceId) {
        throw new Error('Job order was completed, but no invoice id was returned.')
      }
      setLinkedInvoice({
        id: newInvoiceId,
        invoiceNo: invoicePayload?.invoiceNo ?? invoicePayload?.InvoiceNo ?? '',
        jobOrderId: id,
      })

      setShowCompleteConfirm(false)
      showToast(
        invoicePayload?.existingInvoice || invoicePayload?.ExistingInvoice
          ? 'Job order completed and existing invoice opened'
          : 'Job order completed and invoice created',
        'success'
      )
      navigate(`/operations/invoice/${newInvoiceId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to complete job order', 'error')
    } finally {
      setCompleting(false)
    }
  }

  function handleUpdateJobOrderAccess() {
    if (!canUnlockEditing) return
    if (isEditUnlocked) {
      showToast('Editing is already enabled for this job order', 'info')
      return
    }
    setShowUnlockModal(true)
  }

  function closeUnlockModal() {
    if (unlocking) return
    setShowUnlockModal(false)
  }

  async function confirmUnlockEditing(code: string) {
    if (!/^\d{6}$/.test(code)) {
      showToast('Please enter a 6-digit code', 'error')
      return
    }

    setUnlocking(true)
    try {
      await unlockJobOrderEditing(id!, code)
      setIsEditUnlocked(true)
      setShowUnlockModal(false)
      showToast('Job order editing enabled', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to verify code', 'error')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div>
      <ConfirmModal
        isOpen={showCompleteConfirm}
        title="Complete Job Order"
        message="Are you sure you want to complete this job order?"
        confirmLabel="Complete"
        cancelLabel="Cancel"
        onConfirm={confirmCompleteJobOrder}
        onCancel={() => !completing && setShowCompleteConfirm(false)}
        loading={completing}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{isAdd ? 'Add Job Order' : 'Manage Job Order'}</h2>
          <span className={`px-3 py-1 rounded-full ${statusClass} text-sm flex items-center gap-2`}>
            <StatusIcon size={14} />
            <span className="font-medium">{currentStatus}</span>
          </span>
          {form.isChangan && (
            <span className="px-3 py-1 rounded-full bg-sky-600 text-white text-sm font-medium">Changan</span>
          )}
          {isAdd && (
            <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-sm flex items-center gap-2">
              <User size={14} />
              <span className="font-medium">New Job Order</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {linkedInvoiceId && (
          <LinkedTransactionNotice
            label="Completed Invoice"
            referenceNo={linkedInvoiceReference}
            hint="This job order already produced an invoice, so completing again is blocked."
            onOpen={() => navigate(`/operations/invoice/${linkedInvoiceId}`)}
          />
        )}

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Actions</div>
            </div>
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              {showIsChanganOption && (
                <div className="flex items-center gap-3">
                  <Toggle checked={!!form.isChangan} onChange={v => updateField('isChangan', v)} disabled={isLockedForEditing} />
                  <span className={`text-sm font-medium ${isLockedForEditing ? 'text-slate-400' : 'text-slate-600'}`}>Changan Client?</span>
                  {isLockedForEditing && currentStatus !== 'COMPLETED' && (
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                      Editing locked until code verification
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleUpdateJobOrderAccess}
                  disabled={!canUnlockEditing}
                  title={canUnlockEditing ? 'Use a one-time void code to enable editing' : 'Completed job orders can no longer be updated'}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${canUnlockEditing ? 'bg-bosch-blue text-white hover:opacity-90' : 'bg-bosch-blue/50 text-white cursor-not-allowed opacity-70'}`}
                >
                  <Edit2 size={14} /> {unlocking ? 'Updating...' : 'Update Job Order'}
                </button>
                <button
                  onClick={handleConvertToInvoice}
                  disabled={(!canConvertToInvoice && !linkedInvoiceId) || completing}
                  title={linkedInvoiceId ? 'Open the linked invoice' : canConvertToInvoice ? 'Complete the job order and create an invoice' : 'Only OPEN job orders can be completed'}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${(canConvertToInvoice || linkedInvoiceId) && !completing ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-300 text-white opacity-60 cursor-not-allowed'}`}
                >
                  <UserPlus size={14} /> {linkedInvoiceId ? 'Open Invoice' : 'Complete Job Order'}
                </button>
                <button
                  onClick={openPackageModal}
                  disabled={isLockedForEditing}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${isLockedForEditing ? 'bg-amber-300 text-white cursor-not-allowed' : 'bg-amber-500 text-white hover:opacity-90'}`}
                >
                  <Box size={14} /> Package
                </button>
                <button
                  onClick={handlePrintJobOrder}
                  disabled={isAdd || printing}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${isAdd || printing ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  <Printer size={14} /> {printing ? 'Printing...' : 'Print Job Order Form'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <fieldset disabled={isLockedForEditing} className={isLockedForEditing ? 'opacity-70' : ''}>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Services', value: activeServiceCount, tone: 'bg-sky-50 text-sky-700 border-sky-100', icon: Wrench },
            { label: 'Products', value: activeProductCount, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Box },
            { label: 'Technicians', value: selectedTechnicianCount, tone: 'bg-violet-50 text-violet-700 border-violet-100', icon: User },
            { label: 'Job Order Total', value: fmt(totalAmount), tone: 'bg-amber-50 text-amber-700 border-amber-100', icon: DollarSign }
          ].map(card => (
            <div key={card.label} className={`rounded border px-4 py-3 ${card.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide">{card.label}</div>
                  <div className="mt-1 text-lg font-semibold">{card.value}</div>
                </div>
                <div className="shrink-0 rounded bg-white/70 p-2">
                  <card.icon size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t border-b">
              <div className="text-sm font-medium text-slate-700">Job Order Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <ShieldCheck className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={statusOptions}
                      value={String(form.status ?? '')}
                      onChange={value => updateField('status', value)}
                      placeholder="Select status..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference No. <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input value={form.referenceNo} onChange={e => updateField('referenceNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.referenceNo && <div className="text-rose-600 text-sm mt-1">{errors.referenceNo}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Transaction Date</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e => updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expiration Date</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.expirationDate} onChange={e => updateField('expirationDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              {showIsChanganOption && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Estimated Days</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <Hash className="text-slate-400 shrink-0" size={16} />
                      <input type="number" value={form.estimatedDays} onChange={e => updateField('estimatedDays', Number(e.target.value))} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Odometer</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <Hash className="text-slate-400 shrink-0" size={16} />
                      <input type="number" value={form.odometer} onChange={e => updateField('odometer', Number(e.target.value))} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Next Service Reminder (Days)</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <Calendar className="text-slate-400 shrink-0" size={16} />
                      <input type="number" value={form.nextServiceReminderDays} onChange={e => updateField('nextServiceReminderDays', Number(e.target.value))} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Customer PO</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <Hash className="text-slate-400 shrink-0" size={16} />
                      <input value={form.customerPO} onChange={e => updateField('customerPO', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Customer <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={allCustomers.map(c => ({ value: String(c.id), label: c.name }))}
                      value={String(form.customerId ?? '')}
                      onChange={cid => {
                        const sel = allCustomers.find(c => String(c.id) === cid)
                        updateField('customerId', sel ? sel.id : cid)
                        updateField('customer', sel ? sel.name : '')
                        updateField('vehicleId', '')
                        updateField('vehicle', '')
                      }}
                      placeholder="Search customer..."
                    />
                  </div>
                  {errors.customer && <div className="text-rose-600 text-sm mt-1">{errors.customer}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Vehicle</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={allVehicles.map(v => ({ value: String(v.id), label: v.label ?? v.name ?? '' }))}
                      value={String(form.vehicleId ?? '')}
                      onChange={vid => {
                        const sel = allVehicles.find(v => String(v.id) === vid)
                        updateField('vehicleId', sel ? sel.id : vid)
                        updateField('vehicle', sel ? (sel.label ?? sel.name ?? '') : '')
                      }}
                      disabled={!form.customerId}
                      placeholder={form.customerId ? 'Search vehicle...' : 'Select a customer first'}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Service Group</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={allServiceGroups.map(g => ({ value: String(g.id), label: g.name }))}
                      value={String(form.serviceGroupId ?? '')}
                      onChange={gid => {
                        const sel = allServiceGroups.find(g => String(g.id) === gid)
                        updateField('serviceGroupId', sel ? sel.id : gid)
                        updateField('serviceGroup', sel ? sel.name : '')
                      }}
                      placeholder="Search service group..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedPackages.length > 0 && (
          <div className="bg-white rounded shadow-sm">
            <div className="rounded border overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-700">Selected Packages</div>
                <div className="text-xs text-slate-500">{selectedPackages.length} applied</div>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {selectedPackages.map((sp: any, i: number) => (
                  <div key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-white text-sm">
                    <Box className="w-4 h-4" />
                    <span className="font-medium truncate max-w-[220px]">{sp.name ?? sp.title ?? sp.code ?? sp.id}</span>
                    <button onClick={() => removeSelectedPackage(i)} className="ml-1 w-5 h-5 rounded-full bg-white text-amber-500 flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t">
              <div className="text-sm font-medium text-slate-700">Services / Labor</div>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-600 text-left">
                    <th className="pb-2 font-medium pr-3 w-1/2">Service Name</th>
                    <th className="pb-2 font-medium pr-3">Rate</th>
                    <th className="pb-2 font-medium pr-3">Hours</th>
                    <th className="pb-2 font-medium pr-3">Amount</th>
                    <th className="pb-2 font-medium pr-3 text-center w-16">Pkg</th>
                    <th className="pb-2 font-medium pr-3 text-center w-24">Required</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSvcRows.map(row => (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 align-middle">
                        <div className="relative">
                          <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
                            <Search className="text-slate-400 shrink-0" size={14} />
                            <input
                              value={row.search}
                              onChange={e => searchSvc(row.key, e.target.value)}
                              onFocus={() => {
                                const s = row.search.trim()
                                  ? allServices.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10)
                                  : allServices.slice(0, 10)
                                updateSvcRow(row.key, { suggestions: s, showDrop: true })
                              }}
                              onBlur={() => setTimeout(() => updateSvcRow(row.key, { showDrop: false }), 150)}
                              placeholder="Search service..."
                              className="min-w-0 flex-1 bg-transparent outline-none text-sm"
                            />
                            {row.isAdditional && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Additional</span>}
                          </div>
                          {row.showDrop && row.suggestions.length > 0 && (
                            <div className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                              {row.suggestions.map((s: any) => (
                                <div key={s.id} onClick={() => selectSvc(row.key, s)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                  {s.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className={`relative flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                          <CurrencyInput value={row.rate} onChange={v => updateSvcRow(row.key, { rate: v })} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-20' : ''}`} />
                          {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="border rounded px-3 py-2 bg-white">
                          <input type="number" step="0.01" value={row.hours} onChange={e => updateSvcRow(row.key, { hours: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="border rounded px-3 py-2 bg-gray-50">
                          <input value={fmt(row.amount)} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <Toggle checked={row.isPackage} onChange={v => updateSvcRow(row.key, { isPackage: v })} />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <Toggle checked={row.isRequired} onChange={v => updateSvcRow(row.key, { isRequired: v })} />
                      </td>
                      <td className="py-2">
                        <button onClick={() => { setServiceRows(r => r.filter(x => x.key !== row.key)); setSvcPage(0) }} className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600">
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
                  <select value={svcRpp} onChange={e => { setSvcRpp(Number(e.target.value)); setSvcPage(0) }} className="border rounded px-1.5 py-1 text-xs bg-white">
                    <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                  </select>
                  <span>{serviceRows.length === 0 ? '0' : `${svcPage * svcRpp + 1}–${Math.min((svcPage + 1) * svcRpp, serviceRows.length)}`} of {serviceRows.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSvcPage(0)} disabled={svcPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={14} /></button>
                  <button onClick={() => setSvcPage(p => Math.max(0, p - 1))} disabled={svcPage === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <button onClick={() => setSvcPage(p => Math.min(svcPageCount - 1, p + 1))} disabled={svcPage >= svcPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                  <button onClick={() => setSvcPage(svcPageCount - 1)} disabled={svcPage >= svcPageCount - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={14} /></button>
                </div>
              </div>

              <div className="flex justify-end mt-3">
                <button onClick={() => setServiceRows(r => [...r, newSvcRow()])} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium">
                  <Plus size={14} /> Add Service
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t">
              <div className="text-sm font-medium text-slate-700">Products</div>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="min-w-[1120px] w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b text-slate-600 text-left">
                    <th className="pb-2 font-medium pr-3 w-1/2">Product Name</th>
                    <th className="pb-2 font-medium pr-3 whitespace-nowrap w-44">Price</th>
                    <th className="pb-2 font-medium pr-3 whitespace-nowrap w-28">Qty</th>
                    <th className="pb-2 font-medium pr-3 whitespace-nowrap w-72">Stock</th>
                    <th className="pb-2 font-medium pr-3 whitespace-nowrap w-40">Amount</th>
                    <th className="pb-2 font-medium pr-3 text-center whitespace-nowrap w-16">Pkg</th>
                    <th className="pb-2 font-medium pr-3 text-center whitespace-nowrap w-24">Required</th>
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
                              onFocus={() => {
                                const s = row.search.trim()
                                  ? allProducts.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10)
                                  : allProducts.slice(0, 10)
                                updateProdRow(row.key, { suggestions: s, showDrop: true })
                              }}
                              onBlur={() => setTimeout(() => updateProdRow(row.key, { showDrop: false }), 150)}
                              placeholder="Search product..."
                              className="min-w-0 flex-1 bg-transparent outline-none text-sm"
                            />
                            {row.isAdditional && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">Additional</span>}
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
                        <div className={`relative flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                          <CurrencyInput value={row.price} onChange={v => updateProdRow(row.key, { price: v })} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm text-right tabular-nums disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-20' : ''}`} />
                          {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />}
                        </div>
                      </td>
                      <td className="py-2 pr-3 align-middle">
                        <div className="border rounded px-3 py-2 bg-white">
                          <input type="number" step="1" min="1" max={row.productId ? availableStockForRow(row) : undefined} value={row.qty} onChange={e => updateProdRow(row.key, { qty: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-right tabular-nums" />
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
                      <td className="py-2 pr-3 text-center align-middle">
                        <Toggle checked={row.isPackage} onChange={v => updateProdRow(row.key, { isPackage: v })} />
                      </td>
                      <td className="py-2 pr-3 text-center align-middle">
                        <Toggle checked={row.isRequired} onChange={v => updateProdRow(row.key, { isRequired: v })} />
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

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t border-b">
              <div className="text-sm font-medium text-slate-700">Service Personnel</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Service Advisor</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <User className="text-slate-400 shrink-0" size={16} />
                      <PersonnelSelect
                        options={serviceAdvisorOptions}
                        value={String(form.serviceAdvisorId ?? '')}
                        onChange={uid => {
                          const sel = allUsers.find(u => String(u.id) === uid)
                          updateField('serviceAdvisorId', sel ? sel.id : uid)
                        }}
                        placeholder="Search advisor..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Estimator</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <User className="text-slate-400 shrink-0" size={16} />
                      <PersonnelSelect
                        options={estimatorOptions}
                        value={String(form.estimatorId ?? '')}
                        onChange={uid => {
                          const sel = allUsers.find(u => String(u.id) === uid)
                          updateField('estimatorId', sel ? sel.id : uid)
                        }}
                        placeholder="Search estimator..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Approved By</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <User className="text-slate-400 shrink-0" size={16} />
                      <PersonnelSelect
                        options={approverOptions}
                        value={String(form.approvedById ?? '')}
                        onChange={uid => {
                          const sel = allUsers.find(u => String(u.id) === uid)
                          updateField('approvedById', sel ? sel.id : uid)
                        }}
                        placeholder="Search approver..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-700">Technicians <span className="text-xs text-slate-500 font-normal">(Max {MAX_TECHNICIANS})</span></div>
                  <div className="text-xs text-slate-500">{selectedTechnicianCount} / {MAX_TECHNICIANS} selected</div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-600 text-left">
                      <th className="pb-2 font-medium pr-3"></th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {techRows.map(row => (
                      <tr key={row.key} className="border-b last:border-b-0">
                        <td className="py-2 pr-3">
                          <div className="relative">
                            <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
                              <Wrench className="text-slate-400 shrink-0" size={14} />
                              <input
                                value={row.search}
                                onChange={e => searchTech(row.key, e.target.value)}
                                onFocus={() => {
                                  const selectedIds = new Set(techRows.filter(r => r.key !== row.key && r.userId).map(r => String(r.userId)))
                                  const pool = technicianUsers.filter(u => !selectedIds.has(String(u.id)))
                                  const s = row.search.trim()
                                    ? pool.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase()) || userBadge(x).toLowerCase().includes(row.search.toLowerCase())).slice(0, 10)
                                    : pool.slice(0, 10)
                                  updateTechRow(row.key, { suggestions: s, showDrop: true })
                                }}
                                onBlur={() => setTimeout(() => updateTechRow(row.key, { showDrop: false }), 150)}
                                placeholder="Search technician..."
                                className="w-full bg-transparent outline-none text-sm"
                              />
                            </div>
                            {row.showDrop && row.suggestions.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                                {row.suggestions.map((u: any) => (
                                  <div key={u.id} onClick={() => selectTech(row.key, u)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                    <div className="text-sm text-slate-800">{userDisplayName(u)}</div>
                                    {userBadge(u) && <div className="text-xs text-slate-400 mt-0.5">{userBadge(u)}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2">
                          <button onClick={() => setTechRows(r => r.filter(x => x.key !== row.key))} className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end mt-3">
                  <button
                    onClick={addTechRow}
                    disabled={techRows.length >= MAX_TECHNICIANS}
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium ${techRows.length >= MAX_TECHNICIANS ? 'opacity-50 cursor-not-allowed hover:bg-emerald-600' : ''}`}
                  >
                    <Plus size={14} /> Add Technician
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Summary</div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
                <div className="rounded border bg-slate-50 p-4 flex flex-col h-full">
                  <label className="block text-sm font-medium text-slate-700">Remarks {totalDiscount > 0 && <span className="text-rose-600">*</span>}</label>
                  <div className={`mt-2 bg-white border rounded flex-1 flex flex-col min-h-[216px] ${errors.summary ? 'border-rose-400' : ''}`}>
                    <textarea value={form.summary} onChange={e => updateField('summary', e.target.value)} placeholder={totalDiscount > 0 ? 'Required when discount is applied' : 'Optional remarks'} className="w-full flex-1 p-3 bg-transparent outline-none text-sm resize-none" />
                  </div>
                  {errors.summary && <div className="text-rose-600 text-sm mt-1">{errors.summary}</div>}
                </div>
                <div className="rounded border bg-slate-50 p-4 flex flex-col gap-4 justify-center h-full">
                  {([
                    { label: 'Sub Total', req: true, value: fmt(subTotal) },
                    ...(showIsChanganOption ? [{ label: 'VAT (12%)', req: true, value: fmt(vat) }] : []),
                    { label: 'Labor Discount', req: true, field: 'laborDiscount' },
                    { label: 'Product Discount', req: true, field: 'productDiscount' },
                    { label: 'Additional Discount', req: true, field: 'additionalDiscount' },
                    { label: 'Total Amount', req: true, value: fmt(totalAmount) }
                  ] as Array<{ label: string; req: boolean; value?: string; field?: 'laborDiscount' | 'productDiscount' | 'additionalDiscount' }>).map(({ label, req, value, field }) => (
                    <div key={label} className="flex items-center gap-4">
                      <span className="text-sm font-medium text-slate-700 w-36 shrink-0">{label} {req && <span className="text-rose-600">*</span>}</span>
                      <div className={`flex-1 flex items-center gap-2 border rounded px-3 py-2 ${label === 'Total Amount' ? 'bg-sky-50 border-sky-100' : 'bg-white'}`}>
                        <DollarSign className="text-slate-400 shrink-0" size={16} />
                        {field ? (
                          <CurrencyInput value={Number(form[field]) || 0} onChange={v => updateField(field, v)} className="w-full bg-transparent outline-none text-sm" />
                        ) : (
                          <input value={value} readOnly className={`w-full bg-transparent outline-none cursor-not-allowed ${label === 'Total Amount' ? 'text-base font-semibold text-sky-900' : 'text-sm text-slate-500'}`} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 pb-4">
          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className={`px-4 py-2 bg-bosch-blue text-white rounded text-sm ${saving ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}>
            {saving ? 'Saving...' : 'Saved'}
          </button>
        </div>
        </fieldset>
      </div>

      <PinVerificationModal
        isOpen={showUnlockModal}
        title="Access Code Required"
        description="Enter a valid one-time 6-digit void code to unlock job order editing. The code expires automatically and cannot be used again."
        label="Access Code"
        digitAriaLabelPrefix="Code digit"
        confirmLabel="Enable Editing"
        cancelLabel="Cancel"
        loading={unlocking}
        onConfirm={confirmUnlockEditing}
        onCancel={closeUnlockModal}
      />

      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="package-modal-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPackageModal(false)} />
          <div className="relative z-10 w-full max-w-3xl bg-white rounded shadow-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <Box size={16} className="text-slate-700" />
                <div id="package-modal-title" className="text-sm font-medium text-slate-700">Select Package</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white border rounded px-3 py-1.5">
                  <Search className="text-slate-400" size={14} />
                  <input ref={modalSearchRef} value={packageSearch} onChange={e => { setPackageSearch(e.target.value); setPkgPage(1) }} placeholder="Search packages..." className="w-56 bg-transparent outline-none text-sm" />
                </div>
                {packageSearch && (
                  <button onClick={() => { setPackageSearch(''); setPkgPage(1) }} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">Clear</button>
                )}
                <button onClick={() => setShowPackageModal(false)} className="p-1.5 rounded bg-rose-500 text-white hover:bg-rose-600"><X size={14} /></button>
              </div>
            </div>

            <div className="p-4">
              {packagesLoading ? (
                <div className="text-center py-8 text-sm text-slate-500">Loading packages...</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-slate-600 text-left">
                        <th className="pb-2 font-medium pr-3">Code</th>
                        <th className="pb-2 font-medium pr-3">Name</th>
                        <th className="pb-2 font-medium pr-3 text-right">Amount</th>
                        <th className="pb-2 w-28"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPkgItems.map((p, i) => {
                        const pKey = getPkgKey(p)
                        const isApplied = selectedPackages.some(sp => getPkgKey(sp) === pKey)
                        const isLoading = applyingPkgId === (p.id ?? p.Id)
                        return (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="py-2 pr-3 text-slate-700">{p.code ?? p.id}</td>
                            <td className="py-2 pr-3 text-slate-700">{p.name ?? p.title}</td>
                            <td className="py-2 pr-3 text-right text-slate-700">{fmt(getPackageAmount(p))}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => !isApplied && handleApplyPackage(p)}
                                disabled={isLoading || isApplied}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded ${isApplied ? 'bg-slate-300 text-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'} text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                <Check size={12} />
                                {isLoading ? 'Loading...' : (isApplied ? 'Applied' : 'Apply')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span>Rows per page:</span>
                      <select value={pkgPageSize} onChange={e => { setPkgPageSize(Number(e.target.value)); setPkgPage(1) }} className="border rounded px-1.5 py-1 text-xs bg-white">
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                      </select>
                      <span>{pkgPageStart}–{pkgPageEnd} of {totalPackages}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPkgPage(1)} disabled={pkgPage <= 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsLeft size={14} /></button>
                      <button onClick={() => setPkgPage(p => Math.max(1, p - 1))} disabled={pkgPage <= 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                      <button onClick={() => setPkgPage(p => Math.min(pkgPageCount, p + 1))} disabled={pkgPage >= pkgPageCount} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                      <button onClick={() => setPkgPage(pkgPageCount)} disabled={pkgPage >= pkgPageCount} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"><ChevronsRight size={14} /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
