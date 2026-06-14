// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import getCurrentUserId from '../auth/getCurrentUserId'
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
  Check,
  User,
  Wrench,
  CreditCard
} from 'lucide-react'
import { useToast } from '../contexts/toast'
import managementService, { getPackages, getPackage } from '../services/managementService'
import { getUsers } from '../services/adminService'
import { getJobStatuses, getServiceGroups } from '../services/configService'
import { getInvoiceById, getNextInvoiceNo, openInvoiceReportPdf, proceedInvoiceToPayment, getPaymentsSummary } from '../services/operationService'
import LinkedTransactionNotice from '../components/operations/LinkedTransactionNotice'
import { findPaymentLinkedToInvoice, pickWorkflowId, pickWorkflowReference } from '../utils/workflowLinks'
import { canConvertFromStatus } from '../utils/statusRules'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'
import useDebouncedValue from '../hooks/useDebouncedValue'

async function sendJson(path: string, method: string, body?: Record<string, unknown>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`)
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

const saveInvoice = (body: Record<string, unknown>) => sendJson('/api/operations/invoices', 'POST', body)
const updateInvoice = (id: string, body: Record<string, unknown>) => sendJson(`/api/operations/invoices/${id}`, 'PUT', body)

function CurrencyInput({ value, onChange, className, readOnly }: { value: number; onChange?: (v: number) => void; className?: string; readOnly?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  function handleFocus() { if (readOnly) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setInputVal(e.target.value) }
  function handleBlur() { setFocused(false); onChange && onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} readOnly={readOnly} className={className} />
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

interface ServiceRow { key: string; serviceId: string | number; serviceName: string; rate: number; hours: number; amount: number; isPackage: boolean; isRequired: boolean; packageKey?: string; search: string; suggestions: any[]; showDrop: boolean }
interface ProductRow { key: string; productId: string | number; productName: string; price: number; qty: number; amount: number; isPackage: boolean; isRequired: boolean; packageKey?: string; search: string; suggestions: any[]; showDrop: boolean }
interface TechRow { key: string; userId: string | number; userName: string; search: string; suggestions: any[]; showDrop: boolean }

let _rowKey = 0
const newSvcRow = (): ServiceRow => ({ key: String(++_rowKey), serviceId: '', serviceName: '', rate: 0, hours: 1, amount: 0, isPackage: false, isRequired: false, search: '', suggestions: [], showDrop: false })
const newProdRow = (): ProductRow => ({ key: String(++_rowKey), productId: '', productName: '', price: 0, qty: 1, amount: 0, isPackage: false, isRequired: false, search: '', suggestions: [], showDrop: false })
const newTechRow = (): TechRow => ({ key: String(++_rowKey), userId: '', userName: '', search: '', suggestions: [], showDrop: false })
const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))

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
  PAID: 'bg-emerald-600 text-white',
  CONVERTED: 'bg-emerald-600 text-white',
  CLOSED: 'bg-slate-400 text-white',
  VOID: 'bg-rose-600 text-white',
  DELETED: 'bg-rose-600 text-white'
}
const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  OPEN: ShieldCheck,
  PENDING: Edit2,
  PAID: Check,
  CONVERTED: Check,
  CLOSED: X,
  VOID: X,
  DELETED: X
}

const MAX_TECHNICIANS = 5

let invoiceMasterDataCache: {
  services?: any[]
  products?: any[]
  users?: any[]
  customers?: any[]
  serviceGroups?: any[]
  jobStatuses?: Array<{ id?: string | number; name: string; code: string }>
} | null = null

const invoiceVehiclesByCustomerCache = new Map<string, any[]>()

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

export default function ManageInvoice() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const id = params.id
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const { showToast } = useToast()
  const modalSearchRef = useRef<HTMLInputElement>(null)
  const showIsChanganOption = useShowIsChanganOption()

  const [form, setForm] = useState<any>({
    isChangan: false,
    isPackage: false,
    status: 'OPEN',
    referenceNo: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    customer: '',
    customerId: '',
    vehicle: '',
    vehicleId: '',
    jobOrderId: '',
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
    additionalDiscount: 0,
    amountPaid: 0
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
  const [proceedingToPayment, setProceedingToPayment] = useState(false)
  const [linkedPayment, setLinkedPayment] = useState<Record<string, any> | null>(null)

  useEffect(() => {
    ;(async () => {
      if (invoiceMasterDataCache) {
        setAllServices(invoiceMasterDataCache.services ?? [])
        setAllProducts(invoiceMasterDataCache.products ?? [])
        setAllUsers(invoiceMasterDataCache.users ?? [])
        setAllCustomers(invoiceMasterDataCache.customers ?? [])
        setAllServiceGroups(invoiceMasterDataCache.serviceGroups ?? [])
        setJobStatusList(invoiceMasterDataCache.jobStatuses ?? [])
        return
      }

      const results = await Promise.allSettled([
        managementService.getServices(),
        managementService.getProducts(),
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
      const normalizedProducts = normalizeOptions(Array.isArray(prods) ? prods : [])
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

      invoiceMasterDataCache = {
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
    if (!isAdd) return
    let mounted = true
    ;(async () => {
      try {
        const data: any = await getNextInvoiceNo()
        const nextNo = String(data?.invoiceNo ?? data?.InvoiceNo ?? data?.referenceNo ?? data?.ReferenceNo ?? '').trim()
        if (mounted && nextNo) setForm((f: any) => f.referenceNo ? f : { ...f, referenceNo: nextNo })
      } catch {
        if (mounted) setForm((f: any) => f.referenceNo ? f : { ...f, referenceNo: 'INV0000001' })
      }
    })()
    return () => { mounted = false }
  }, [isAdd])

  useEffect(() => {
    const cid = form.customerId
    if (!cid) { setAllVehicles([]); return }
    const cacheKey = String(cid)
    const cached = invoiceVehiclesByCustomerCache.get(cacheKey)
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
      invoiceVehiclesByCustomerCache.set(cacheKey, normalizedVehicles)
      setAllVehicles(normalizedVehicles)
    }).catch(() => setAllVehicles([]))
    return () => { mounted = false }
  }, [form.customerId])

  // Load invoice when editing and bind to form + rows
  useEffect(() => {
    if (isAdd || !id) return
    let mounted = true
    ;(async () => {
      try {
        const data: any = await getInvoiceById(id as string)
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
        const customerName = customerObj ? `${customerObj.FirstName ?? customerObj.firstName ?? ''} ${customerObj.LastName ?? customerObj.lastName ?? ''}`.trim() : (data.CustomerName ?? data.customerName ?? '')
        const sgObj = data.ServiceGroup ?? data.serviceGroup
        const sgName = sgObj?.name ?? sgObj?.Name ?? data.serviceGroupName ?? ''

        setForm((f: any) => ({
          ...f,
          status: String(data.JobStatus?.Code ?? data.JobStatus?.Name ?? data.jobStatus?.code ?? data.jobStatus?.name ?? data.Status ?? data.status ?? f.status ?? 'OPEN').toUpperCase(),
          isChangan: data.IsChangan ?? data.isChangan ?? f.isChangan,
          isPackage: data.IsPackage ?? data.isPackage ?? f.isPackage,
          referenceNo: String(data.InvoiceNo ?? data.invoiceNo ?? data.ReferenceNo ?? data.referenceNo ?? data.Reference ?? f.referenceNo ?? ''),
          transactionDate: String(data.InvoiceDate ?? data.invoiceDate ?? data.TransactionDate ?? data.transactionDate ?? data.date ?? f.transactionDate ?? '').slice(0,10),
          dueDate: String(data.DueDate ?? data.dueDate ?? data.Due ?? f.dueDate ?? '').slice(0,10),
          jobOrderId: data.JobOrderId ?? data.jobOrderId ?? f.jobOrderId,
          estimatedDays: data.EstimatedDays ?? data.estimatedDays ?? f.estimatedDays,
          serviceGroup: sgName || f.serviceGroup,
          serviceGroupId: data.ServiceGroupId ?? data.serviceGroupId ?? sgObj?.Id ?? sgObj?.id ?? f.serviceGroupId,
          customer: customerName || f.customer,
          customerId: data.CustomerId ?? data.customerId ?? customerObj?.Id ?? customerObj?.id ?? f.customerId,
          vehicle: vehicleLabel || f.vehicle,
          vehicleId: data.VehicleId ?? data.vehicleId ?? vehicleObj?.Id ?? vehicleObj?.id ?? f.vehicleId,
          jobStatusId: data.JobStatusId ?? data.jobStatusId ?? data.JobStatus?.Id ?? data.jobStatus?.id ?? f.jobStatusId,
          serviceAdvisorId: data.AdvisorUserId ?? data.advisorUserId ?? data.AdvisorUser?.Id ?? f.serviceAdvisorId,
          estimatorId: data.EstimatorUserId ?? data.estimatorUserId ?? data.EstimatorUser?.Id ?? f.estimatorId,
          approvedById: data.ApproverUserId ?? data.approverUserId ?? data.ApproverUser?.Id ?? f.approvedById,
          odometer: data.Odometer ?? data.odometer ?? f.odometer,
          nextServiceReminderDays: data.NextServiceReminderDays ?? data.nextServiceReminderDays ?? data.NextOdometerReminder ?? data.nextOdometerReminder ?? f.nextServiceReminderDays,
          customerPO: data.CustomerPO ?? data.customerPO ?? f.customerPO,
          summary: data.Summary ?? data.summary ?? f.summary,
          laborDiscount: data.LaborDiscount ?? data.laborDiscount ?? f.laborDiscount,
          productDiscount: data.ProductDiscount ?? data.productDiscount ?? f.productDiscount,
          additionalDiscount: data.AdditionalDiscount ?? data.additionalDiscount ?? f.additionalDiscount,
          amountPaid: Number(data.AmountPaid ?? data.amountPaid ?? data.PaidAmount ?? data.paidAmount ?? 0) || Number(f.amountPaid || 0)
        }))

        const svcArr = data.invoiceServices ?? data.InvoiceServices ?? data.services ?? data.Services ?? []
        const prodArr = data.invoiceProducts ?? data.InvoiceProducts ?? data.products ?? data.Products ?? []
        const techArr = data.invoiceTechnicians ?? data.InvoiceTechnicians ?? data.technicians ?? data.Technicians ?? []
        let parsedDetails: any = null
        const detailsRaw = data.invoiceDetails ?? data.InvoiceDetails ?? data.details ?? data.Details
        if (!Array.isArray(svcArr) && typeof detailsRaw === 'string' && detailsRaw.trim()) {
          try { parsedDetails = JSON.parse(detailsRaw) } catch { parsedDetails = null }
        } else if (detailsRaw && typeof detailsRaw === 'object') parsedDetails = detailsRaw

        const servicesSource = Array.isArray(svcArr) && svcArr.length ? svcArr : (parsedDetails?.services ?? parsedDetails?.Services ?? [])
        const productsSource = Array.isArray(prodArr) && prodArr.length ? prodArr : (parsedDetails?.products ?? parsedDetails?.Products ?? [])
        const techsSource = Array.isArray(techArr) && techArr.length ? techArr : (parsedDetails?.technicians ?? parsedDetails?.Technicians ?? [])

        setServiceRows(() => (Array.isArray(servicesSource) ? servicesSource : []).map((s: any) => {
            const sid = s.serviceId ?? s.ServiceId ?? s.Service?.id ?? s.Service?.Id ?? s.id ?? ''
            const sname = s.serviceName ?? s.name ?? s.Service?.name ?? s.Service?.Name ?? ''
            const rate = Number(s.rate ?? s.standardRate ?? s.price ?? 0) || 0
            const hours = Number(s.hours ?? s.quantity ?? s.qty ?? 1) || 1
            const amount = Number(s.amount ?? s.total ?? (rate * hours)) || (rate * hours)
            const pkgId = s.packageId ?? s.PackageId ?? s.package_id ?? null
            const packageKey = pkgId != null ? String(pkgId) : undefined
            return { key: String(++_rowKey), serviceId: sid, serviceName: sname, rate, hours, amount, isPackage: !!(s.isPackage ?? s.IsPackage), isRequired: !!(s.isRequired ?? s.IsRequired), packageKey, search: sname, suggestions: [], showDrop: false }
          }))

        setProductRows(() => (Array.isArray(productsSource) ? productsSource : []).map((p: any) => {
            const pid = p.productId ?? p.ProductId ?? p.Product?.id ?? p.Product?.Id ?? p.id ?? ''
            const pname = p.productName ?? p.name ?? p.Product?.name ?? p.Product?.Name ?? ''
            const price = Number(p.price ?? p.sellingPrice ?? p.unitPrice ?? 0) || 0
            const qty = Number(p.qty ?? p.quantity ?? 1) || 1
            const amount = Number(p.amount ?? p.total ?? (price * qty)) || (price * qty)
            const pkgId = p.packageId ?? p.PackageId ?? p.package_id ?? null
            const packageKey = pkgId != null ? String(pkgId) : undefined
            return { key: String(++_rowKey), productId: pid, productName: pname, price, qty, amount, isPackage: !!(p.isPackage ?? p.IsPackage), isRequired: !!(p.isRequired ?? p.IsRequired), packageKey, search: pname, suggestions: [], showDrop: false }
          }))

        setTechRows(() => (Array.isArray(techsSource) ? techsSource : []).map((t: any) => {
            const uid = t.userId ?? t.UserId ?? t.technicianUserId ?? t.TechnicianUserId ?? t.TechnicianUser?.id ?? t.technicianUser?.id ?? t.id ?? ''
            const uname = (t.userName ?? t.name ?? (t.TechnicianUser ? `${(t.TechnicianUser.firstName ?? t.TechnicianUser.FirstName ?? '')} ${(t.TechnicianUser.lastName ?? t.TechnicianUser.LastName ?? '')}`.trim() : '')) ?? ''
            return { key: String(++_rowKey), userId: uid, userName: uname, search: uname, suggestions: [], showDrop: false }
          }))

        const pkgs = data.Packages ?? data.packages ?? parsedDetails?.packages ?? parsedDetails?.Packages ?? []
        setSelectedPackages(
          Array.isArray(pkgs)
            ? pkgs.map((p: any) => ({ id: p.id ?? p.packageId ?? p.code ?? p.Id ?? p.PackageId ?? p.Code ?? p.name ?? p.Name ?? '', name: p.name ?? p.Name ?? p.title ?? p.Title ?? '' }))
            : []
        )

      } catch (err: any) {
        showToast(err instanceof Error ? err.message : 'Failed to load invoice', 'error')
      }
    })()
    return () => { mounted = false }
  }, [id, isAdd, showToast])

  useEffect(() => {
    let mounted = true

    async function loadLinkedPayment() {
      if (isAdd || !id) {
        setLinkedPayment(null)
        return
      }
      try {
        const payments: any = await getPaymentsSummary()
        if (!mounted) return
        setLinkedPayment(findPaymentLinkedToInvoice(Array.isArray(payments) ? payments : [], id))
      } catch {
        if (mounted) setLinkedPayment(null)
      }
    }

    loadLinkedPayment()
    return () => { mounted = false }
  }, [id, isAdd])

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
    updateProdRow(key, { search: q, productName: q, suggestions, showDrop: true })
  }
  function selectProd(key: string, prod: any) {
    setProductRows(rows => rows.map(r => {
      if (r.key !== key) return r
      const price = Number(prod.sellingPrice ?? prod.price ?? 0)
      return { ...r, productId: prod.id, productName: prod.name, search: prod.name, price, qty: r.qty || 1, amount: price * (r.qty || 1), suggestions: [], showDrop: false }
    }))
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
  const balanceDue = useMemo(() => totalAmount - Number(form.amountPaid || 0), [totalAmount, form.amountPaid])
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
      : [{ value: 'OPEN', label: 'OPEN' }, { value: 'PENDING', label: 'PENDING' }, { value: 'PAID', label: 'PAID' }, { value: 'CLOSED', label: 'CLOSED' }, { value: 'VOID', label: 'VOID' }]),
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

    if (pkgServices.length) {
      setServiceRows(rows => {
        const base = rows.filter(r => r.serviceId || r.serviceName)
        const added = pkgServices.map((s: any) => {
          const svc = s.service ?? s
          const rate = Number(s.rate ?? svc.standardRate ?? 0)
          const hours = Number(s.hours ?? svc.standardHours ?? 1)
          return { key: String(++_rowKey), serviceId: svc.id ?? s.serviceId ?? '', serviceName: svc.name ?? s.serviceName ?? '', rate, hours, amount: rate * hours, isPackage: true, isRequired: !!(s.isRequired ?? s.IsRequired), packageKey: pkgKey, search: svc.name ?? s.serviceName ?? '', suggestions: [], showDrop: false }
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
          return { key: String(++_rowKey), productId: prod.id ?? p.productId ?? '', productName: prod.name ?? p.productName ?? '', price, qty, amount: price * qty, isPackage: true, isRequired: !!(p.isRequired ?? p.IsRequired), packageKey: pkgKey, search: prod.name ?? p.productName ?? '', suggestions: [], showDrop: false }
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
      const pkgKey = getPkgKey(pkg)
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
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    setSaving(true)
    try {
      const resolvedJobStatus = jobStatusList.find(s => String(s.code).toUpperCase() === String(form.status).toUpperCase())
      const payload: Record<string, unknown> = {
        ...form,
        invoiceNo: form.referenceNo,
        invoiceDate: form.transactionDate,
        isPackage: hasPackageContent,
        advisorUserId: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        jobStatusId: resolvedJobStatus?.id ? Number(resolvedJobStatus.id) : (form.jobStatusId ? Number(form.jobStatusId) : undefined),
        customerId: form.customerId ? Number(form.customerId) : undefined,
        jobOrderId: form.jobOrderId ? Number(form.jobOrderId) : undefined,
        createdById: isAdd && form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : undefined,
        subTotal,
        vat12: vat,
        totalDiscount,
        totalAmount,
        balanceDue,
        services: serviceRows.filter(r => r.serviceId || r.serviceName).map(r => ({ serviceId: r.serviceId, name: r.serviceName, rate: r.rate, hours: r.hours, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        products: productRows.filter(r => r.productId || r.productName).map(r => ({ productId: r.productId, name: r.productName, price: r.price, qty: r.qty, amount: r.amount, isPackage: r.isPackage, isRequired: r.isRequired, packageId: r.packageKey ? Number(r.packageKey) : undefined })),
        technicians: techRows.filter(r => r.userId).map(r => ({ userId: r.userId, name: r.userName })),
        packages: selectedPackages.map(p => ({ id: p.id ?? p.code, packageId: p.id ?? p.code, name: p.name ?? p.title }))
      }
      if (isAdd) await saveInvoice(payload)
      else await updateInvoice(id as string, payload)
      showToast(isAdd ? 'Invoice added' : 'Invoice updated', 'success')
      navigate('/operations/invoice')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handlePrintInvoice() {
    if (isAdd || printing || !id) return
    setPrinting(true)
    try {
      await openInvoiceReportPdf(id)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to print invoice report', 'error')
    } finally {
      setPrinting(false)
    }
  }

  const currentStatus = String(form.status || 'OPEN')
  const StatusIcon = STATUS_ICONS[currentStatus] || ShieldCheck
  const statusClass = STATUS_STYLES[currentStatus] || 'bg-slate-400 text-white'
  const isReadOnly = true
  const linkedPaymentId = pickWorkflowId(linkedPayment)
  const linkedPaymentReference = pickWorkflowReference(linkedPayment)
  const canProceedToPayment = !isAdd && canConvertFromStatus(currentStatus) && !linkedPaymentId

  async function handleProceedToPayment() {
    if (linkedPaymentId) {
      navigate(`/operations/payment/${linkedPaymentId}`, {
        state: {
          sourceInvoiceId: String(id),
        },
      })
      return
    }
    if (!id || !canProceedToPayment || proceedingToPayment) return
    if (typeof currentUserId !== 'number' || currentUserId <= 0) {
      showToast('Unable to identify the current user', 'error')
      return
    }

    setProceedingToPayment(true)
    try {
      const payments: any = await getPaymentsSummary()
      const existingPayment = findPaymentLinkedToInvoice(Array.isArray(payments) ? payments : [], id)
      const existingPaymentId = pickWorkflowId(existingPayment)
      if (existingPaymentId) {
        setLinkedPayment(existingPayment)
        showToast('This invoice already has a linked payment.', 'info')
        navigate(`/operations/payment/${existingPaymentId}`, {
          state: {
            sourceInvoiceId: String(id),
          },
        })
        return
      }

      const result: any = await proceedInvoiceToPayment(id, {
        createdById: currentUserId,
        updatedById: currentUserId,
        paymentDate: new Date().toISOString(),
      })
      const paymentId = result?.paymentId ?? result?.PaymentId ?? result?.id ?? result?.Id
      if (!paymentId) throw new Error('Payment record was created, but no payment id was returned.')
      setLinkedPayment({ id: paymentId, referenceNo: result?.referenceNo ?? result?.ReferenceNo ?? '' })

      setForm((f: any) => ({ ...f, status: 'CONVERTED' }))
      showToast('Payment record created successfully', 'success')
      navigate(`/operations/payment/${paymentId}`, {
        state: {
          sourceInvoiceId: String(id),
        },
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to proceed to payment', 'error')
    } finally {
      setProceedingToPayment(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{isAdd ? 'Add Invoice' : 'Manage Invoice'}</h2>
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
              <span className="font-medium">New Invoice</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {linkedPaymentId && (
          <LinkedTransactionNotice
            label="Linked Payment"
            referenceNo={linkedPaymentReference}
            hint="This invoice already has a payment record, so proceeding again is blocked."
            onOpen={() => navigate(`/operations/payment/${linkedPaymentId}`, {
              state: {
                sourceInvoiceId: String(id),
              },
            })}
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
                  <Toggle checked={!!form.isChangan} onChange={v => updateField('isChangan', v)} disabled />
                  <span className="text-sm font-medium text-slate-600">Changan Client?</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleProceedToPayment}
                  disabled={(!canProceedToPayment && !linkedPaymentId) || proceedingToPayment}
                  title={linkedPaymentId ? 'Open the linked payment' : 'Proceed to payment'}
                  className={`px-4 py-2 rounded bg-emerald-600 text-white text-sm flex items-center gap-2 ${(canProceedToPayment || linkedPaymentId) && !proceedingToPayment ? 'hover:opacity-90' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <CreditCard size={14} /> {proceedingToPayment ? 'Creating Payment...' : linkedPaymentId ? 'Open Payment' : 'Proceed to Payment'}
                </button>
                <button
                  onClick={handlePrintInvoice}
                  disabled={isAdd || printing}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${isAdd || printing ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  <Printer size={14} /> {printing ? 'Printing...' : 'Print Invoice'}
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
            { label: 'Invoice Total', value: fmt(totalAmount), tone: 'bg-amber-50 text-amber-700 border-amber-100', icon: DollarSign }
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

        <fieldset disabled={isReadOnly} className="contents">
        {/* Invoice Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Invoice Information</div>
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
                  <label className="block text-sm font-medium text-slate-700">Invoice No. <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="INV-0001491" value={form.referenceNo} onChange={e => updateField('referenceNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.referenceNo && <div className="text-rose-600 text-sm mt-1">{errors.referenceNo}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Invoice Date</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e => updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Due Date</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.dueDate} onChange={e => updateField('dueDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
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

              {selectedPackages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {selectedPackages.map((sp, i) => (
                    <div key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-white text-sm">
                      <Box className="w-4 h-4" />
                      <span className="font-medium truncate max-w-[220px]">{sp.name ?? sp.title ?? sp.code ?? sp.id}</span>
                      <button onClick={() => removeSelectedPackage(i)} className="ml-1 w-5 h-5 rounded-full bg-white text-amber-500 flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services / Labor */}
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
                      <td className="py-2 pr-3">
                        <div className="relative">
                          <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white">
                            <Search className="text-slate-400 shrink-0" size={14} />
                            <input
                              value={row.search}
                              onChange={e => searchSvc(row.key, e.target.value)}
                              onFocus={() => { const s = row.search.trim() ? allServices.filter(x => (x.name ?? '').toLowerCase().includes(row.search.toLowerCase())).slice(0, 10) : allServices.slice(0, 10); updateSvcRow(row.key, { suggestions: s, showDrop: true }) }}
                              onBlur={() => setTimeout(() => updateSvcRow(row.key, { showDrop: false }), 150)}
                              placeholder="Search service..."
                              className="w-full bg-transparent outline-none text-sm"
                            />
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
                        <div className="border rounded px-3 py-2 bg-white">
                          <CurrencyInput value={row.rate} onChange={v => updateSvcRow(row.key, { rate: v })} className="w-full bg-transparent outline-none text-sm" />
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
                        <button
                          onClick={() => { setServiceRows(r => r.filter(x => x.key !== row.key)); setSvcPage(0) }}
                          disabled={isReadOnly}
                          className={`p-1.5 rounded text-white ${isReadOnly ? 'bg-rose-500 opacity-50 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'}`}
                        >
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
                <button
                  onClick={() => setServiceRows(r => [...r, newSvcRow()])}
                  disabled={isReadOnly}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded text-sm font-medium ${isReadOnly ? 'bg-emerald-600 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
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
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-600 text-left">
                    <th className="pb-2 font-medium pr-3 w-1/2">Product Name</th>
                    <th className="pb-2 font-medium pr-3">Price</th>
                    <th className="pb-2 font-medium pr-3">Qty</th>
                    <th className="pb-2 font-medium pr-3">Amount</th>
                    <th className="pb-2 font-medium pr-3 text-center w-16">Pkg</th>
                    <th className="pb-2 font-medium pr-3 text-center w-24">Required</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProdRows.map(row => (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">
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
                              {row.suggestions.map((p: any) => (
                                <div key={p.id} onClick={() => selectProd(row.key, p)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                  {p.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="border rounded px-3 py-2 bg-white">
                          <CurrencyInput value={row.price} onChange={v => updateProdRow(row.key, { price: v })} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="border rounded px-3 py-2 bg-white">
                          <input type="number" step="1" min="1" value={row.qty} onChange={e => updateProdRow(row.key, { qty: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="border rounded px-3 py-2 bg-gray-50">
                          <input value={fmt(row.amount)} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <Toggle checked={row.isPackage} onChange={v => updateProdRow(row.key, { isPackage: v })} />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <Toggle checked={row.isRequired} onChange={v => updateProdRow(row.key, { isRequired: v })} />
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => { setProductRows(r => r.filter(x => x.key !== row.key)); setProdPage(0) }}
                          disabled={isReadOnly}
                          className={`p-1.5 rounded text-white ${isReadOnly ? 'bg-rose-500 opacity-50 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'}`}
                        >
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
                <button
                  onClick={() => setProductRows(r => [...r, newProdRow()])}
                  disabled={isReadOnly}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded text-sm font-medium ${isReadOnly ? 'bg-emerald-600 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  <Plus size={14} /> Add Product
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Service Personnel */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Service Personnel</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {([
                    { key: 'serviceAdvisorId', label: 'Service Advisor', options: serviceAdvisorOptions },
                    { key: 'estimatorId', label: 'Estimator', options: estimatorOptions },
                    { key: 'approvedById', label: 'Approved By', options: approverOptions }
                  ] as const).map(({ key, label, options }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700">{label}</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <User className="text-slate-400 shrink-0" size={16} />
                        <PersonnelSelect
                          options={options}
                          value={String(form[key] ?? '')}
                          onChange={value => updateField(key, value)}
                          placeholder={`Search ${label.toLowerCase()}...`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-700">Technicians <span className="text-xs text-slate-500 font-normal">(Max {MAX_TECHNICIANS})</span></div>
                  <div className="text-xs text-slate-500">{techRows.filter(r => r.userId).length} / {MAX_TECHNICIANS} selected</div>
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
                                  const query = row.search.toLowerCase()
                                  const s = row.search.trim()
                                    ? pool.filter(x => String(x.name ?? '').toLowerCase().includes(query) || userBadge(x).toLowerCase().includes(query)).slice(0, 10)
                                    : pool.slice(0, 10)
                                  updateTechRow(row.key, { suggestions: s, showDrop: true })
                                }}
                                onBlur={() => setTimeout(() => updateTechRow(row.key, { showDrop: false }), 150)}
                                placeholder="Search technician..."
                                className="w-full bg-transparent outline-none text-sm"
                              />
                            </div>
                            {row.showDrop && row.suggestions.length > 0 && (
                              <div className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                                {row.suggestions.map((u: any) => (
                                  <div key={u.id} onClick={() => selectTech(row.key, u)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                    <div className="text-sm text-slate-800">{userDisplayName(u) || u.name}</div>
                                    {userBadge(u) && <div className="text-xs text-slate-400 mt-0.5">{userBadge(u)}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => setTechRows(r => r.filter(x => x.key !== row.key))}
                            disabled={isReadOnly}
                            className={`p-1.5 rounded text-white ${isReadOnly ? 'bg-rose-500 opacity-50 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'}`}
                          >
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
                    disabled={isReadOnly || techRows.length >= MAX_TECHNICIANS}
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium ${(isReadOnly || techRows.length >= MAX_TECHNICIANS) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                  >
                    <Plus size={14} /> Add Technician
                  </button>
                </div>
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
                    { key: 'subTotal', label: 'Sub Total', req: true, editable: false, value: subTotal },
                    ...(showIsChanganOption ? [{ key: 'vat', label: 'VAT (12%)', req: true, editable: false, value: vat }] : []),
                    { key: 'laborDiscount', label: 'Labor Discount', req: true, editable: true, value: Number(form.laborDiscount) || 0 },
                    { key: 'productDiscount', label: 'Product Discount', req: true, editable: true, value: Number(form.productDiscount) || 0 },
                    { key: 'additionalDiscount', label: 'Additional Discount', req: true, editable: true, value: Number(form.additionalDiscount) || 0 },
                    { key: 'totalAmount', label: 'Total Amount', req: true, editable: false, value: totalAmount }
                  ] as const).map(({ key, label, req, editable, value }) => (
                    <div key={key} className="flex items-center gap-4">
                      <span className="text-sm font-medium text-slate-700 w-36 shrink-0">{label} {req && <span className="text-rose-600">*</span>}</span>
                      <div className="flex-1 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <DollarSign className="text-slate-400 shrink-0" size={16} />
                        {editable ? (
                          <CurrencyInput
                            value={value}
                            onChange={v => updateField(key, v)}
                            className="w-full bg-transparent outline-none text-sm"
                          />
                        ) : (
                          <input
                            value={fmt(value)}
                            readOnly
                            className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled className="px-4 py-2 bg-bosch-blue text-white rounded text-sm opacity-70 cursor-not-allowed">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        </fieldset>

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
                        const pkgKey = getPkgKey(p)
                        const applied = !!pkgKey && selectedPackages.some(sp => getPkgKey(sp) === pkgKey)
                        const applying = applyingPkgId === (p.id ?? p.Id)
                        return (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="py-2 pr-3 text-slate-700">{p.code ?? p.id}</td>
                            <td className="py-2 pr-3 text-slate-700">{p.name ?? p.title}</td>
                            <td className="py-2 pr-3 text-right text-slate-700">{fmt(getPackageAmount(p))}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => !applied && handleApplyPackage(p)}
                                disabled={applying || applied}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded ${applied ? 'bg-slate-300 text-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'} text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                <Check size={12} /> {applying ? 'Loading...' : applied ? 'Applied' : 'Apply'}
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
