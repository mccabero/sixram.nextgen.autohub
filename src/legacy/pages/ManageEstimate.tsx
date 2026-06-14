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
import managementService, { getPackages, getPackage } from '../services/managementService'
import { getUsers } from '../services/adminService'
import { getJobStatuses, getServiceGroups } from '../services/configService'
import { saveEstimate, updateEstimate, getEstimateById, getNextEstimateReferenceNo, getNextJobOrderReferenceNo, openEstimateFormPdf, saveJobOrder, getJobOrdersSummary } from '../services/operationService'
import { fetchCustomerById } from '../services/customerService'
import LinkedTransactionNotice from '../components/operations/LinkedTransactionNotice'
import { findLinkedWorkflowRecord, pickWorkflowId, pickWorkflowReference } from '../utils/workflowLinks'
import { canConvertFromStatus } from '../utils/statusRules'
import { formatInteger } from '../utils/format'
import PriceEditLockedBadge from '../components/rbac/PriceEditLockedBadge'
import { useCanEditPricePermission } from '../hooks/useCanEditPricePermission'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'
import useDebouncedValue from '../hooks/useDebouncedValue'

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
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(path, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
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
interface ProductRow { key: string; productId: string | number; productName: string; price: number; qty: number; amount: number; isPackage: boolean; isRequired: boolean; isAdditional: boolean; packageKey?: string; search: string; suggestions: any[]; showDrop: boolean; stockOnHand?: number; stockStatus?: string; lowStockThreshold?: number; unitOfMeasureName?: string; partNo?: string }
interface TechRow { key: string; userId: string | number; userName: string; search: string; suggestions: any[]; showDrop: boolean }
let _rowKey = 0
const newSvcRow = (): ServiceRow => ({ key: String(++_rowKey), serviceId: '', serviceName: '', rate: 0, hours: 1, amount: 0, isPackage: false, isRequired: false, isAdditional: false, search: '', suggestions: [], showDrop: false })
const newProdRow = (): ProductRow => ({ key: String(++_rowKey), productId: '', productName: '', price: 0, qty: 1, amount: 0, isPackage: false, isRequired: false, isAdditional: false, search: '', suggestions: [], showDrop: false })
const newTechRow = (): TechRow => ({ key: String(++_rowKey), userId: '', userName: '', search: '', suggestions: [], showDrop: false })
const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
const fmtQty = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0)

function dateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDaysToDateInput(value: string, days: number) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-').map(part => Number(part))
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

function parseNumericInput(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

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
    ? `Available ${fmtQty(available)} ${unitLabel}. Requested ${fmtQty(requestedQty)}. Estimate does not deduct stock.`
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
        className="w-full bg-transparent outline-none text-sm"
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

// Role keyword maps for user filtering
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

function userLabel(u: any): string {
  const name = `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim()
  const pos = String(u.position ?? u.role ?? '').trim()
  return pos ? `${name} (${pos})` : name
}

function userDisplayName(u: any): string {
  return `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim()
}

function userBadge(u: any): string {
  return String(u.position ?? u.role ?? '').trim()
}

export default function ManageEstimate() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const id = params.id
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const selectedCustomerId = searchParams.get('customerId')
  const { showToast } = useToast()
  const modalSearchRef = useRef<HTMLInputElement>(null)
  const showIsChanganOption = useShowIsChanganOption()
  const canEditPrice = useCanEditPricePermission()

  const [form, setForm] = useState<any>(() => {
    const transactionDate = dateInputValue()
    return {
      isChangan: false,
      isPackage: false,
      status: 'OPEN',
      referenceNo: '',
      transactionDate,
      expirationDate: addDaysToDateInput(transactionDate, 30),
      customer: '',
      customerId: '',
      vehicle: '',
      vehicleId: '',
      estimatedDays: 0,
      serviceGroup: '',
      serviceGroupId: '',
      odometer: 0,
      nextServiceReminderDays: 30,
      customerPO: '',
      serviceAdvisorId: '',
      estimatorId: '',
      approvedById: '',
      summary: '',
      laborDiscount: 0,
      productDiscount: 0,
      additionalDiscount: 0
    }
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
  const [showConvertConfirm, setShowConvertConfirm] = useState(false)
  const [converting, setConverting] = useState(false)
  const [linkedJobOrder, setLinkedJobOrder] = useState<Record<string, any> | null>(null)

  // Load reference data on mount
  useEffect(() => {
    ;(async () => {
      const [svcs, prods, users, customersData, sgData, jobStatuses] = await Promise.all([
        managementService.getServices(),
        managementService.getProducts({ isQuickSalesProduct: false }),
        getUsers(),
        apiGet('/api/customers/summary'),
        getServiceGroups().catch(() => []),
        getJobStatuses().catch(() => [])
      ])
      setAllServices(normalizeOptions(Array.isArray(svcs) ? svcs : []))
      setAllProducts(normalizeOptions(Array.isArray(prods) ? prods : []).filter(product => !isQuickSalesProduct(product)))
      setAllUsers(normalizeUsers(Array.isArray(users) ? users : []))

      const rawCustomers: any[] = Array.isArray(customersData)
        ? customersData
        : (customersData?.items ?? customersData?.data ?? [])
      setAllCustomers(rawCustomers.map((c: any) => {
        const cid = c.id ?? c.customerId ?? ''
        const first = c.firstName ?? c.first_name ?? ''
        const last = c.lastName ?? c.last_name ?? ''
        const name = (first || last) ? `${first} ${last}`.trim() : (c.name ?? c.customerName ?? String(cid))
        return { ...c, id: cid, name }
      }))

      const rawSG: any[] = Array.isArray(sgData) ? sgData : (sgData?.items ?? sgData?.data ?? [])
      setAllServiceGroups(rawSG.map((g: any) => ({ id: g.id ?? g.Id ?? '', name: g.name ?? g.Name ?? '' })))
      const mappedJobStatuses = (Array.isArray(jobStatuses) ? jobStatuses : []).map((j: any) => {
        const code = String(j.code ?? j.Code ?? j.name ?? j.Name ?? j.status ?? j.Status ?? '').toUpperCase()
        const name = j.name ?? j.Name ?? j.display ?? j.Status ?? j.status ?? code
        return { id: j.id ?? j.Id ?? '', name: String(name), code }
      })
      setJobStatusList(mappedJobStatuses)
    })()
  }, [])

  useEffect(() => {
    if (!isAdd || !selectedCustomerId || form.customerId) return

    const ctl = new AbortController()
    fetchCustomerById(selectedCustomerId, ctl.signal)
      .then((data: any) => {
        const src = data?.data ?? data?.customer ?? data
        const first = String(src?.firstName ?? src?.first_name ?? src?.givenName ?? src?.given_name ?? '')
        const last = String(src?.lastName ?? src?.last_name ?? src?.familyName ?? src?.family_name ?? '')
        const customerName = `${first} ${last}`.trim() || String(src?.name ?? src?.customerName ?? '')
        const isChangan = (
          src?.isChangan === true ||
          src?.is_changan === true ||
          Number(src?.isChangan) === 1 ||
          Number(src?.is_changan) === 1 ||
          String(src?.clientType ?? '').toUpperCase() === 'CHANGAN'
        )

        setForm((f: any) => ({
          ...f,
          customer: customerName,
          customerId: src?.id ?? src?.customerId ?? src?.customer_id ?? selectedCustomerId,
          isChangan,
        }))
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') {
          showToast('Failed to load selected customer', 'error')
        }
      })

    return () => ctl.abort()
  }, [isAdd, selectedCustomerId, form.customerId, showToast])

  // Load vehicles whenever the selected customer changes
  useEffect(() => {
    const cid = form.customerId
    if (!cid) { setAllVehicles([]); return }
    let mounted = true
    apiGet(`/api/Vehicles/by-customer/${cid}`).then(data => {
      if (!mounted) return
      const items: any[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])
      setAllVehicles(items.map((v: any) => {
        const vid = v.id ?? v.vehicleId ?? ''
        const plateNo = v.plateNo ?? v.plateNumber ?? v.plate ?? ''
        const makeName = v.vehicleModel?.vehicleMake?.name ?? v.vehicleModel?.vehicleMake?.Name ?? v.vehicleMake?.name ?? v.make ?? ''
        const modelName = v.vehicleModel?.name ?? v.vehicleModel?.Name ?? v.model ?? ''
        const makeModel = [makeName, modelName].filter(Boolean).join(' ')
        const label = plateNo ? (makeModel ? `${makeModel} (${plateNo})` : plateNo) : makeModel
        return { id: vid, name: label, label, plateNo }
      }))
    }).catch(() => setAllVehicles([]))
    return () => { mounted = false }
  }, [form.customerId])

  // Auto-populate reference number for new estimates
  useEffect(() => {
    if (!isAdd) return
    ;(async () => {
      try {
        const data: any = await getNextEstimateReferenceNo()
        const nextRef = data?.referenceNo ?? data?.ReferenceNo ?? ''
        if (nextRef) setForm(f => ({ ...f, referenceNo: nextRef }))
      } catch {}
    })()
  }, [isAdd])

  // Load estimate record when editing and bind to form + rows
  useEffect(() => {
    if (isAdd || !id) return
    let mounted = true
    ;(async () => {
      try {
        const data: any = await getEstimateById(id as string)
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

        // Capture candidate status identifiers from the API so we can reconcile
        // with the canonical job-status list returned by `/api/config/job-statuses`.
        const candId = data.jobStatus?.id ?? data.JobStatus?.Id ?? data.jobStatusId ?? data.JobStatusId ?? data.estimateStatus?.id ?? data.EstimateStatus?.Id ?? null
        const candCodeOrName = String(
          data.jobStatus?.code ?? data.jobStatus?.name ?? data.JobStatus?.Code ?? data.JobStatus?.Name ?? data.status ?? data.Status ?? data.estimateStatus?.code ?? data.EstimateStatus?.Code ?? data.estimateStatus?.name ?? data.EstimateStatus?.Name ?? ''
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

        setForm((f: any) => {
          const transactionDate = String(data.TransactionDate ?? data.transactionDate ?? f.transactionDate ?? dateInputValue()).slice(0, 10)
          const existingExpirationDate = String(data.ExpirationDate ?? data.expirationDate ?? '').slice(0, 10)
          return {
            ...f,
            status: (resolvedCode ? String(resolvedCode).toUpperCase() : validStatus),
            isChangan: data.IsChangan ?? data.isChangan ?? f.isChangan,
            isPackage: data.IsPackage ?? data.isPackage ?? f.isPackage,
            isCustomerApproved: data.IsCustomerApproved ?? data.isCustomerApproved ?? f.isCustomerApproved,
            referenceNo: String(data.ReferenceNo ?? data.referenceNo ?? f.referenceNo ?? ''),
            transactionDate,
            expirationDate: existingExpirationDate || addDaysToDateInput(transactionDate, 30),
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
            nextServiceReminderDays: data.NextOdometerReminder ?? data.nextOdometerReminder ?? data.nextServiceReminderDays ?? f.nextServiceReminderDays ?? 30,
            customerPO: data.CustomerPO ?? data.customerPO ?? f.customerPO,
            summary: data.Summary ?? data.summary ?? f.summary,
            subTotal: data.SubTotal ?? data.subTotal ?? f.subTotal,
            VAT12: data.VAT12 ?? data.vat12 ?? f.VAT12,
            laborDiscount: data.LaborDiscount ?? data.laborDiscount ?? f.laborDiscount,
            productDiscount: data.ProductDiscount ?? data.productDiscount ?? f.productDiscount,
            additionalDiscount: data.AdditionalDiscount ?? data.additionalDiscount ?? f.additionalDiscount,
            totalAmount: data.TotalAmount ?? data.totalAmount ?? f.totalAmount,
          }
        })

        const svcArr = data.estimateServices ?? data.EstimateServices ?? data.services ?? data.Services ?? []
        const prodArr = data.estimateProducts ?? data.EstimateProducts ?? data.products ?? data.Products ?? []
        const techArr = data.estimateTechnicians ?? data.EstimateTechnicians ?? data.technicians ?? data.Technicians ?? []
        let parsedDetails: any = null
        const detailsRaw = data.estimateDetails ?? data.EstimateDetails ?? data.details ?? data.Details
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
            return { key: String(++_rowKey), productId: pid, productName: pname, price, qty, amount, isPackage: !!(p.isPackage ?? p.IsPackage), isRequired: !!(p.isRequired ?? p.IsRequired), isAdditional: !!(p.isAdditional ?? p.IsAdditional), packageKey, search: pname, suggestions: [], showDrop: false, ...productStockFields(productInfo) }
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
        showToast(err instanceof Error ? err.message : 'Failed to load estimate', 'error')
      }
    })()
    return () => { mounted = false }
  }, [id, isAdd, showToast])

  useEffect(() => {
    let mounted = true

    async function loadLinkedJobOrder() {
      if (isAdd || !id) {
        setLinkedJobOrder(null)
        return
      }
      try {
        const jobOrders: any = await getJobOrdersSummary()
        if (!mounted) return
        setLinkedJobOrder(findLinkedWorkflowRecord(
          Array.isArray(jobOrders) ? jobOrders : [],
          id,
          ['estimateId', 'EstimateId'],
        ))
      } catch {
        if (mounted) setLinkedJobOrder(null)
      }
    }

    loadLinkedJobOrder()
    return () => { mounted = false }
  }, [id, isAdd])

  // If the job status list becomes available after the estimate was loaded,
  // attempt to reconcile the previously-captured raw status candidate to the
  // canonical status code used in the jobStatusList so the header shows the
  // exact option value from the config endpoint.
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
    setForm((f: any) => {
      if (key === 'transactionDate') {
        return { ...f, transactionDate: value, expirationDate: addDaysToDateInput(String(value || ''), 30) }
      }
      return { ...f, [key]: value }
    })
    setErrors((e: any) => ({ ...e, [key]: '' }))
  }

  // Services / Labor row handlers
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

  // Products row handlers
  function updateProdRow(key: string, patch: Partial<ProductRow>) {
    setProductRows(rows => rows.map(r => { if (r.key !== key) return r; const u = { ...r, ...patch }; u.amount = Number(u.price) * Number(u.qty); return u }))
  }
  function searchProd(key: string, q: string) {
    const suggestions = q.trim() ? allProducts.filter(p => (p.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : allProducts.slice(0, 10)
    updateProdRow(key, { productId: '', search: q, productName: q, suggestions, showDrop: true, stockOnHand: undefined, stockStatus: '', lowStockThreshold: undefined, unitOfMeasureName: '', partNo: '' })
  }
  function selectProd(key: string, prod: any) {
    const available = stockOnHandOf(prod)
    const name = String(prod.name ?? prod.Name ?? 'selected product')
    if (available <= 0) {
      showToast(`Stock advisory: ${name} currently has no stock on hand. Estimate was not deducted.`, 'info')
    }
    setProductRows(rows => rows.map(r => {
      if (r.key !== key) return r
      const price = Number(prod.sellingPrice ?? prod.price ?? 0)
      return { ...r, productId: prod.id, productName: prod.name, search: prod.name, price, qty: r.qty || 1, amount: price * (r.qty || 1), suggestions: [], showDrop: false, ...productStockFields(prod) }
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

  // Technicians row handlers
  function updateTechRow(key: string, patch: Partial<TechRow>) {
    setErrors((e: any) => ({ ...e, technicians: '' }))
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
    setErrors((e: any) => ({ ...e, technicians: '' }))
    setTechRows(rows => [...rows, newTechRow()])
  }

  // Derived totals
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

  const svcPageCount = Math.max(1, Math.ceil(serviceRows.length / svcRpp))
  const pagedSvcRows = serviceRows.slice(svcPage * svcRpp, (svcPage + 1) * svcRpp)
  const prodPageCount = Math.max(1, Math.ceil(productRows.length / prodRpp))
  const pagedProdRows = productRows.slice(prodPage * prodRpp, (prodPage + 1) * prodRpp)

  // Package modal
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
  useEffect(() => { if (pkgPage > pkgPageCount) setPkgPage(pkgPageCount) }, [pkgPageCount])
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
    const packageStockAdvisory = pkgProducts.map((p: any) => {
      const prod = p.product ?? p
      const productInfo = allProducts.find(item => String(item.id) === String(prod.id ?? p.productId ?? '')) ?? prod
      const available = stockOnHandOf(productInfo)
      const qty = Number(p.qty ?? 1) || 1
      const name = String(prod.name ?? p.productName ?? 'package product')
      if (available <= 0) return `No stock available for ${name}.`
      if (qty > available) return `Only ${fmtQty(available)} stock available for ${name}. Package requires ${fmtQty(qty)}.`
      return ''
    }).find(Boolean)

    if (packageStockAdvisory) showToast(`Stock advisory only: ${packageStockAdvisory} Estimate was not deducted.`, 'info')

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
      const pid = pkgKey
      if (pid && prev.some(px => getPkgKey(px) === pid)) return prev
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

  function getJobStatusId(status: string) {
    const target = String(status || '').toUpperCase()
    const match = jobStatusList.find(s =>
      String(s.code).toUpperCase() === target ||
      String(s.name).toUpperCase() === target
    )
    const id = Number(match?.id)
    return Number.isFinite(id) && id > 0 ? id : undefined
  }

  function validate() {
    const e: any = {}
    if (!form.status || !String(form.status).trim()) e.status = 'Required'
    if (!form.referenceNo || !String(form.referenceNo).trim()) e.referenceNo = 'Required'
    if (!form.transactionDate || !String(form.transactionDate).trim()) e.transactionDate = 'Required'
    if (!form.expirationDate || !String(form.expirationDate).trim()) e.expirationDate = 'Required'
    if (!form.customerId && (!form.customer || !String(form.customer).trim())) e.customer = 'Required'
    if (!form.vehicleId && (!form.vehicle || !String(form.vehicle).trim())) e.vehicleId = 'Required'
    if (!form.serviceGroupId && (!form.serviceGroup || !String(form.serviceGroup).trim())) e.serviceGroupId = 'Required'
    if (!form.serviceAdvisorId || !String(form.serviceAdvisorId).trim()) e.serviceAdvisorId = 'Required'
    if (!form.estimatorId || !String(form.estimatorId).trim()) e.estimatorId = 'Required'
    if (!form.approvedById || !String(form.approvedById).trim()) e.approvedById = 'Required'
    if (!techRows.some(r => r.userId && String(r.userId).trim())) e.technicians = 'Required'
    if (totalDiscount > 0 && !String(form.summary ?? '').trim()) e.summary = 'Remarks are required when any discount is greater than 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    const productQuantityError = getProductQuantityError(productRows)
    if (productQuantityError) { showToast(productQuantityError, 'error'); return }
    const productStockAdvisory = getProductStockAdvisory(productRows)
    if (productStockAdvisory) showToast(`Stock advisory only: ${productStockAdvisory} Estimate was not deducted.`, 'info')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...form,
        jobStatusId: getJobStatusId(form.status),
        isPackage: hasPackageContent,
        advisorUserId: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        estimatorUserId: form.estimatorId ? Number(form.estimatorId) : undefined,
        approverUserId: form.approvedById ? Number(form.approvedById) : undefined,
        odometer: parseNumericInput(form.odometer),
        nextOdometerReminder: form.nextServiceReminderDays !== '' && form.nextServiceReminderDays != null ? Number(form.nextServiceReminderDays) : undefined,
        createdById: isAdd && form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        subTotal,
        vat12: vat,
        totalDiscount,
        totalAmount,
        services: serviceRows.filter(r => r.serviceId || r.serviceName).map(r => ({ serviceId: r.serviceId, name: r.serviceName, rate: r.rate, hours: r.hours, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, isAdditional: r.isAdditional, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        products: productRows.filter(r => r.productId || r.productName).map(r => ({ productId: r.productId, name: r.productName, price: r.price, qty: r.qty, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, isAdditional: r.isAdditional, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        technicians: techRows.filter(r => r.userId).map(r => ({ userId: r.userId, name: r.userName })),
        packages: selectedPackages.map(p => ({ id: p.id ?? p.code, packageId: p.id ?? p.code, name: p.name ?? p.title, isAdditional: !!(p.isAdditional ?? p.IsAdditional) }))
      }
      if (isAdd) await saveEstimate(payload)
      else await updateEstimate(id as string, payload)
      showToast(isAdd ? 'Estimate added' : 'Estimate updated', 'success')
      navigate('/operations/estimate')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save estimate', 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentStatus = String(form.status || 'OPEN')
  const StatusIcon = STATUS_ICONS[currentStatus] || ShieldCheck
  const statusClass = STATUS_STYLES[currentStatus] || 'bg-slate-400 text-white'
  const isEditable = isAdd || canConvertFromStatus(currentStatus)
  const linkedJobOrderId = pickWorkflowId(linkedJobOrder)
  const linkedJobOrderReference = pickWorkflowReference(linkedJobOrder)
  const canConvertToJobOrder = !isAdd && canConvertFromStatus(currentStatus) && !linkedJobOrderId

  async function handlePrintEstimate() {
    if (isAdd || !id || printing) return
    setPrinting(true)
    try {
      await openEstimateFormPdf(id)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to print estimate form', 'error')
    } finally {
      setPrinting(false)
    }
  }

  function handleConvertToJobOrder() {
    if (linkedJobOrderId) {
      navigate(`/operations/job-order/${linkedJobOrderId}`)
      return
    }
    if (!canConvertToJobOrder || isAdd || !id) return
    setShowConvertConfirm(true)
  }

  async function confirmConvertToJobOrder() {
    if (!id || converting) return
    const productQuantityError = getProductQuantityError(productRows)
    if (productQuantityError) { showToast(productQuantityError, 'error'); return }
    const productStockError = getProductStockAdvisory(productRows)
    if (productStockError) { showToast(productStockError, 'error'); return }

    setConverting(true)
    try {
      const jobOrders: any = await getJobOrdersSummary()
      const existingJobOrder = findLinkedWorkflowRecord(
        Array.isArray(jobOrders) ? jobOrders : [],
        id,
        ['estimateId', 'EstimateId'],
      )
      const existingJobOrderId = pickWorkflowId(existingJobOrder)
      if (existingJobOrderId) {
        setLinkedJobOrder(existingJobOrder)
        setShowConvertConfirm(false)
        showToast('This estimate already has a linked job order.', 'info')
        navigate(`/operations/job-order/${existingJobOrderId}`)
        return
      }

      const nextRefData: any = await getNextJobOrderReferenceNo()
      const nextReferenceNo = String(nextRefData?.referenceNo ?? nextRefData?.ReferenceNo ?? '').trim()
      if (!nextReferenceNo) throw new Error('Unable to generate the next job order reference number.')

      const openStatus = jobStatusList.find(s =>
        String(s.code).toUpperCase() === 'OPEN' || String(s.name).toUpperCase() === 'OPEN'
      )

      const payload: Record<string, unknown> = {
        isChangan: !!form.isChangan,
        isPackage: hasPackageContent,
        isPaid: false,
        estimateId: Number(id),
        referenceNo: nextReferenceNo,
        transactionDate: form.transactionDate || new Date().toISOString().slice(0, 10),
        expirationDate: form.expirationDate || undefined,
        jobStatusId: openStatus?.id ? Number(openStatus.id) : undefined,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : undefined,
        advisorUserId: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        estimatorUserId: form.estimatorId ? Number(form.estimatorId) : undefined,
        approverUserId: form.approvedById ? Number(form.approvedById) : undefined,
        serviceGroupId: form.serviceGroupId ? Number(form.serviceGroupId) : undefined,
        odometer: parseNumericInput(form.odometer),
        nextOdometerReminder: form.nextServiceReminderDays !== '' && form.nextServiceReminderDays != null ? Number(form.nextServiceReminderDays) : undefined,
        customerPO: form.customerPO ?? '',
        summary: form.summary ?? '',
        subTotal,
        vat12: vat,
        laborDiscount: Number(form.laborDiscount) || 0,
        productDiscount: Number(form.productDiscount) || 0,
        additionalDiscount: Number(form.additionalDiscount) || 0,
        totalAmount,
        createdById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : 0,
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : 0,
        services: serviceRows.filter(r => r.serviceId || r.serviceName).map(r => ({ serviceId: r.serviceId, name: r.serviceName, rate: r.rate, hours: r.hours, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, isAdditional: r.isAdditional, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        products: productRows.filter(r => r.productId || r.productName).map(r => ({ productId: r.productId, name: r.productName, price: r.price, qty: r.qty, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, isAdditional: r.isAdditional, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        technicians: techRows.filter(r => r.userId).map(r => ({ userId: r.userId, name: r.userName })),
        packages: selectedPackages.map(p => ({ id: p.id ?? p.code, packageId: p.id ?? p.code, name: p.name ?? p.title, isAdditional: !!(p.isAdditional ?? p.IsAdditional) })),
      }

      const result: any = await saveJobOrder(payload)
      const newJobOrderId = result?.id ?? result?.Id ?? result?.jobOrderId ?? result?.JobOrderId
      if (!newJobOrderId) throw new Error('Job order was created, but no job order id was returned.')
      setLinkedJobOrder({ id: newJobOrderId, referenceNo: nextReferenceNo })

      const convertedStatus = jobStatusList.find(s =>
        String(s.code).toUpperCase() === 'CONVERTED' ||
        String(s.name).toUpperCase() === 'CONVERTED'
      )

      await updateEstimate(id, {
        jobStatusId: convertedStatus?.id ? Number(convertedStatus.id) : undefined,
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
      } as Record<string, unknown>)

      setShowConvertConfirm(false)
      showToast('Estimate converted to job order', 'success')
      navigate(`/operations/job-order/${newJobOrderId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to convert estimate to job order', 'error')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div>
      <ConfirmModal
        isOpen={showConvertConfirm}
        title="Convert Estimate"
        message="Are you sure you want to convert this estimate to a job order?"
        confirmLabel="Convert"
        cancelLabel="Cancel"
        onConfirm={confirmConvertToJobOrder}
        onCancel={() => !converting && setShowConvertConfirm(false)}
        loading={converting}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{isAdd ? 'Add Estimate' : 'Manage Estimate'}</h2>
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
              <span className="font-medium">New Estimate</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {linkedJobOrderId && (
          <LinkedTransactionNotice
            label="Converted Job Order"
            referenceNo={linkedJobOrderReference}
            hint="This estimate already produced a job order, so converting again is blocked."
            onOpen={() => navigate(`/operations/job-order/${linkedJobOrderId}`)}
          />
        )}

        {/* Top Actions */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Actions</div>
            </div>
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              {showIsChanganOption && (
                <div className="flex items-center gap-3">
                  <Toggle checked={!!form.isChangan} onChange={v => updateField('isChangan', v)} disabled={!isEditable} />
                  <span className="text-sm font-medium text-slate-600">Changan Client?</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={openPackageModal}
                  disabled={!isEditable}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${!isEditable ? 'bg-amber-300 text-white cursor-not-allowed' : 'bg-amber-500 text-white hover:opacity-90'}`}
                >
                  <Box size={14} /> Package
                </button>
                <button
                  onClick={handleConvertToJobOrder}
                  disabled={(!canConvertToJobOrder && !linkedJobOrderId) || converting}
                  title={linkedJobOrderId ? 'Open the linked job order' : canConvertToJobOrder ? 'Convert to job order from the job order module' : 'Only OPEN estimates can be converted to a job order'}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${(canConvertToJobOrder || linkedJobOrderId) && !converting ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-200 text-emerald-700 opacity-60 cursor-not-allowed'}`}
                >
                  <UserPlus size={14} /> {linkedJobOrderId ? 'Open Job Order' : 'Convert to Job Order'}
                </button>
                <button
                  onClick={handlePrintEstimate}
                  disabled={isAdd || printing}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${isAdd || printing ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  <Printer size={14} /> {printing ? 'Printing...' : 'Print Estimate Form'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Services', value: activeServiceCount, tone: 'bg-sky-50 text-sky-700 border-sky-100', icon: Wrench },
            { label: 'Products', value: activeProductCount, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Box },
            { label: 'Technicians', value: selectedTechnicianCount, tone: 'bg-violet-50 text-violet-700 border-violet-100', icon: User },
            { label: 'Estimate Total', value: fmt(totalAmount), tone: 'bg-amber-50 text-amber-700 border-amber-100', icon: DollarSign }
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

        {!isEditable && (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This estimate is currently read-only because its status is <span className="font-semibold">{currentStatus}</span>. You can still print it and review the saved details.
          </div>
        )}

        <fieldset disabled={!isEditable} className="contents">
        {/* Estimate Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t border-b">
              <div className="text-sm font-medium text-slate-700">Estimate Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              {/* Row 1: Status, Reference No., Transaction Date, Expiration Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.status ? 'border-rose-500' : ''}`}>
                    <ShieldCheck className="text-slate-400 shrink-0" size={16} />
                    <select disabled value={form.status} onChange={e => updateField('status', e.target.value)} className="w-full bg-transparent outline-none text-sm">
                      {jobStatusList && jobStatusList.length ? (
                        jobStatusList.map(s => (
                          <option key={String(s.id) || s.code} value={s.code}>{s.name}</option>
                        ))
                      ) : (
                        <>
                          <option>OPEN</option>
                          <option>CLOSED</option>
                          <option>PENDING</option>
                        </>
                      )}
                    </select>
                  </div>
                  {errors.status && <div className="text-rose-600 text-sm mt-1">{errors.status}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference No. <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.referenceNo ? 'border-rose-500' : ''}`}>
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input readOnly placeholder="EST0000001" value={form.referenceNo} className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-default select-none" />
                  </div>
                  {errors.referenceNo && <div className="text-rose-600 text-sm mt-1">{errors.referenceNo}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Transaction Date <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.transactionDate ? 'border-rose-500' : ''}`}>
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e => updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.transactionDate && <div className="text-rose-600 text-sm mt-1">{errors.transactionDate}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expiration Date <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.expirationDate ? 'border-rose-500' : ''}`}>
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.expirationDate} onChange={e => updateField('expirationDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.expirationDate && <div className="text-rose-600 text-sm mt-1">{errors.expirationDate}</div>}
                </div>
              </div>

              {showIsChanganOption && (
                <>
                  {/* Row 2: Estimated Days, Odometer, Next Service Reminder (Days), Customer PO */}
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
                        <input
                          inputMode="numeric"
                          value={formatInteger(form.odometer)}
                          onChange={e => {
                            const raw = String(e.target.value || '').replace(/[^0-9]/g, '')
                            updateField('odometer', raw === '' ? '' : Number(raw))
                          }}
                          className="w-full bg-transparent outline-none text-sm"
                        />
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
                </>
              )}

              {/* Row 3: Customer Name, Vehicle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Customer <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.customer ? 'border-rose-500' : ''}`}>
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={allCustomers.map(c => ({ value: String(c.id), label: c.name }))}
                      value={String(form.customerId ?? '')}
                      onChange={id => {
                        const sel = allCustomers.find(c => String(c.id) === id)
                        updateField('customerId', sel ? sel.id : id)
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
                  <label className="block text-sm font-medium text-slate-700">Vehicle <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.vehicleId ? 'border-rose-500' : ''}`}>
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={allVehicles.map(v => ({ value: String(v.id), label: v.label ?? v.name ?? '' }))}
                      value={String(form.vehicleId ?? '')}
                      onChange={id => {
                        const sel = allVehicles.find(v => String(v.id) === id)
                        updateField('vehicleId', sel ? sel.id : id)
                        updateField('vehicle', sel ? (sel.label ?? sel.name ?? '') : '')
                      }}
                      disabled={!form.customerId}
                      placeholder={form.customerId ? 'Search vehicle...' : 'Select a customer first'}
                    />
                  </div>
                  {errors.vehicleId && <div className="text-rose-600 text-sm mt-1">{errors.vehicleId}</div>}
                </div>
              </div>

              {/* Row 4: Service Group */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Service Group <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.serviceGroupId ? 'border-rose-500' : ''}`}>
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={allServiceGroups.map(g => ({ value: String(g.id), label: g.name }))}
                      value={String(form.serviceGroupId ?? '')}
                      onChange={id => {
                        const sel = allServiceGroups.find(g => String(g.id) === id)
                        updateField('serviceGroupId', sel ? sel.id : id)
                        updateField('serviceGroup', sel ? sel.name : '')
                      }}
                      placeholder="Search service group..."
                    />
                  </div>
                  {errors.serviceGroupId && <div className="text-rose-600 text-sm mt-1">{errors.serviceGroupId}</div>}
                </div>
              </div>

              {/* package bubbles moved outside this box */}
            </div>
          </div>
        </div>

        {/* show package bubbles (if any) outside the Estimate Information box */}
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
                    <button disabled={!isEditable} onClick={() => removeSelectedPackage(i)} className="ml-1 w-5 h-5 rounded-full bg-white text-amber-500 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Services / Labor */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t">
              <div className="text-sm font-medium text-slate-700">Services / Labor</div>
            </div>
            <div className="p-4">
              <table className="w-full table-fixed text-sm">
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
                              onFocus={() => { const s = row.search.trim() ? allServices.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10) : allServices.slice(0, 10); updateSvcRow(row.key, { suggestions: s, showDrop: true }) }}
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
                          <CurrencyInput value={row.rate} onChange={v => updateSvcRow(row.key, { rate: v })} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-14' : ''}`} />
                          {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />}
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

        {/* Products */}
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
                              onFocus={() => { const s = row.search.trim() ? allProducts.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10) : allProducts.slice(0, 10); updateProdRow(row.key, { suggestions: s, showDrop: true }) }}
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
                                const hasStockWarning = available <= 0
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => selectProd(row.key, p)}
                                    className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${hasStockWarning ? 'bg-amber-50/60 text-slate-700' : 'text-slate-700'}`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="min-w-0 truncate">{p.name}</span>
                                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${hasStockWarning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{fmtQty(available)} on hand</span>
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

        {/* Service Personnel */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t border-b">
              <div className="text-sm font-medium text-slate-700">Service Personnel</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              {/* Involved Personnel label removed */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Service Advisor <span className="text-rose-600">*</span></label>
                    <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.serviceAdvisorId ? 'border-rose-500' : ''}`}>
                      <User className="text-slate-400 shrink-0" size={16} />
                      <PersonnelSelect
                        options={serviceAdvisorOptions}
                        value={String(form.serviceAdvisorId ?? '')}
                        onChange={id => {
                          const sel = allUsers.find(u => String(u.id) === id)
                          updateField('serviceAdvisorId', sel ? sel.id : id)
                        }}
                        placeholder="Search advisor..."
                      />
                    </div>
                    {errors.serviceAdvisorId && <div className="text-rose-600 text-sm mt-1">{errors.serviceAdvisorId}</div>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Estimator <span className="text-rose-600">*</span></label>
                    <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.estimatorId ? 'border-rose-500' : ''}`}>
                      <User className="text-slate-400 shrink-0" size={16} />
                      <PersonnelSelect
                        options={estimatorOptions}
                        value={String(form.estimatorId ?? '')}
                        onChange={id => {
                          const sel = allUsers.find(u => String(u.id) === id)
                          updateField('estimatorId', sel ? sel.id : id)
                        }}
                        placeholder="Search estimator..."
                      />
                    </div>
                    {errors.estimatorId && <div className="text-rose-600 text-sm mt-1">{errors.estimatorId}</div>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Approved By <span className="text-rose-600">*</span></label>
                    <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.approvedById ? 'border-rose-500' : ''}`}>
                      <User className="text-slate-400 shrink-0" size={16} />
                      <PersonnelSelect
                        options={approverOptions}
                        value={String(form.approvedById ?? '')}
                        onChange={id => {
                          const sel = allUsers.find(u => String(u.id) === id)
                          updateField('approvedById', sel ? sel.id : id)
                        }}
                        placeholder="Search approver..."
                      />
                    </div>
                    {errors.approvedById && <div className="text-rose-600 text-sm mt-1">{errors.approvedById}</div>}
                  </div>
                </div>
              </div>

              {/* Technicians */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-700">Technicians <span className="text-rose-600">*</span> <span className="text-xs text-slate-500 font-normal">(Max {MAX_TECHNICIANS})</span></div>
                  <div className="text-xs text-slate-500">{selectedTechnicianCount} / {MAX_TECHNICIANS} selected</div>
                </div>
                <div className={`rounded ${errors.technicians ? 'border border-rose-500 px-3 py-2' : ''}`}>
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
                                    const s = row.search.trim() ? pool.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10) : pool.slice(0, 10)
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
                </div>

                <div className="flex justify-end mt-3">
                  <button
                    onClick={addTechRow}
                    disabled={techRows.length >= MAX_TECHNICIANS}
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium ${techRows.length >= MAX_TECHNICIANS ? 'opacity-50 cursor-not-allowed hover:bg-emerald-600' : ''}`}
                  >
                    <Plus size={14} /> Add Technician
                  </button>
                </div>
                {errors.technicians && <div className="text-rose-600 text-sm mt-1">{errors.technicians}</div>}
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

        </fieldset>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !isEditable} className={`px-4 py-2 bg-bosch-blue text-white rounded text-sm ${saving || !isEditable ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>

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
