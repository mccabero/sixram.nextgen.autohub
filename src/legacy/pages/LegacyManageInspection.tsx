// @ts-nocheck
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Tag,
  Hash,
  Calendar,
  Trash2,
  Plus,
  Check,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  ShieldCheck,
  Edit2,
  Printer,
  RefreshCw,
  User,
  Wrench,
  FileText,
  Maximize2
} from 'lucide-react'
import { useToast } from '../contexts/toast'
import { formatInteger } from '../utils/format'
import { saveInspection, updateInspection, getInspectionById, fetchInspectionPhotos, uploadInspectionPhoto, deleteInspectionPhoto, saveEstimate, getNextEstimateReferenceNo, openInspectionFormPdf, getEstimatesSummary, getInspectionChecklistTemplate } from '../services/operationService'
import ConfirmModal from '../components/ui/ConfirmModal'
import LinkedTransactionNotice from '../components/operations/LinkedTransactionNotice'
import { fetchCustomerById, fetchCustomers } from '../services/customerService'
import { fetchVehicleById, fetchVehiclesByCustomer } from '../services/vehicleService'
import { getServiceGroups, getJobStatuses } from '../services/configService'
import { getUsers } from '../services/adminService'
import { findLinkedWorkflowRecord, pickWorkflowId, pickWorkflowReference } from '../utils/workflowLinks'
import { canConvertFromStatus } from '../utils/statusRules'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'
import { useCanDeletePermission } from '../hooks/useCanDeletePermission'
import {
  DEFAULT_INSPECTION_CHECKLIST_GROUPS,
  cloneInspectionChecklistGroups,
  normalizeInspectionChecklistGroups,
  type InspectionChecklistGroup,
  type InspectionChecklistTemplateReference,
} from '../utils/inspectionChecklist'

type InspectionForm = {
  status: 'OPEN' | 'CLOSED' | 'PENDING'
  referenceNo: string
  transactionDate: string
  expirationDate: string
  customer: string
  customerId?: string | number
  vehicle: string
  vehicleId?: string | number
  serviceGroup: string
  serviceGroupId?: string | number
  serviceAdvisor: string
  serviceAdvisorId?: string | number
  inspector: string
  inspectorId?: string | number
  odometer: string
  concern: string
  summaryRemarks: string
  isChangan: boolean
}

type TechnicianRow = { id?: string | number; name: string; fullRow?: boolean; search?: string; suggestions?: Array<{ id: string | number; name: string; firstName?: string; lastName?: string; position?: string }>; showDrop?: boolean }
type ImageItem = { id: string; name: string; src: string }

const INITIAL_GROUPS: InspectionChecklistGroup[] = cloneInspectionChecklistGroups(DEFAULT_INSPECTION_CHECKLIST_GROUPS)

const MAX_TECHNICIANS = 5

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

interface SearchableSelectOption { value: string; label: string }
interface PersonnelOption extends SearchableSelectOption { badge?: string }

function userMatchesKeywords(u: any, keywords: string[]): boolean {
  if (!u || u.isActive === false) return false
  const haystacks = [
    u.role,
    u.position,
    u.roleName,
    ...(Array.isArray(u.assignedRoles) ? u.assignedRoles : []),
    ...(Array.isArray(u.roles) ? u.roles.map((r: any) => typeof r === 'object' && r !== null ? (r.name ?? r.Name ?? '') : String(r ?? '')) : [])
  ].map(v => String(v ?? '').toUpperCase()).filter(Boolean)
  return keywords.some(kw => haystacks.some(h => h.includes(kw.toUpperCase())))
}

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
        className="w-full bg-transparent outline-none text-sm"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow z-50 max-h-72 overflow-y-auto">
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

export default function ManageInspection() {
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const routeId = params.id
  const isAdd = !routeId || routeId === 'add'
  const selectedVehicleId = searchParams.get('vehicleId')
  const showIsChanganOption = useShowIsChanganOption()
  const canDelete = useCanDeletePermission()

  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [linkedEstimate, setLinkedEstimate] = useState<Record<string, any> | null>(null)
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)

  const [form, setForm] = useState<InspectionForm>({
    status: 'OPEN',
    referenceNo: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    expirationDate: new Date().toISOString().slice(0, 10),
    customer: '',
    vehicle: '',
    serviceGroup: '',
    serviceAdvisor: 'MARXIS CABERO',
    inspector: '',
    odometer: '',
    concern: '',
    summaryRemarks: '',
    isChangan: false
  })

  const [technicians, setTechnicians] = useState<TechnicianRow[]>([{ name: '', search: '', suggestions: [], showDrop: false }])

  const [customersList, setCustomersList] = useState<Array<{ id: string; name: string }>>([])
  const [vehiclesList, setVehiclesList] = useState<Array<{ id: string | number; label: string }>>([])
  const [serviceGroupList, setServiceGroupList] = useState<Array<{ id: string | number; name: string }>>([])
  const [userList, setUserList] = useState<Array<{ id: string | number; name: string; firstName?: string; lastName?: string; isActive?: boolean; role?: string; position?: string; assignedRoles?: string[] }>>([])
  const [jobStatusList, setJobStatusList] = useState<Array<{ id?: string | number; name: string; code: string }>>([])
  const [rawStatusCandidates, setRawStatusCandidates] = useState<{ id?: string | number | null; code?: string | null } | null>(null)
  const [listsLoading, setListsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [groups, setGroups] = useState<InspectionChecklistGroup[]>(() =>
    cloneInspectionChecklistGroups(INITIAL_GROUPS)
  )
  const [templateMeta, setTemplateMeta] = useState<InspectionChecklistTemplateReference | null>(null)

  // Auto-fill next reference number for new records
  useEffect(() => {
    if (!isAdd) return
    let mounted = true
    ;(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/operations/inspections/summary', { headers })
        if (!res.ok || !mounted) return
        const list: any[] = await res.json().catch(() => [])
        if (!mounted || !Array.isArray(list) || list.length === 0) {
          if (mounted) setForm(f => ({ ...f, referenceNo: 'V10000001' }))
          return
        }
        const sorted = [...list].sort((a, b) => (b.id ?? b.Id ?? 0) - (a.id ?? a.Id ?? 0))
        const lastRef = String(sorted[0]?.referenceNo ?? sorted[0]?.ReferenceNo ?? '')
        const match = lastRef.match(/^([A-Za-z]*)(\d+)$/)
        if (!match) {
          if (mounted) setForm(f => ({ ...f, referenceNo: 'V10000001' }))
          return
        }
        const prefix = match[1]
        const numStr = match[2]
        const next = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0')
        if (mounted) setForm(f => ({ ...f, referenceNo: prefix + next }))
      } catch {
        if (mounted) setForm(f => ({ ...f, referenceNo: 'V10000001' }))
      }
    })()
    return () => { mounted = false }
  }, [isAdd])

  useEffect(() => {
    if (!isAdd) return
    let mounted = true
    ;(async () => {
      try {
        const data: any = await getInspectionChecklistTemplate()
        if (!mounted || !data) return
        const nextGroups = normalizeInspectionChecklistGroups(data.groups ?? data.Groups)
        if (nextGroups.length > 0) {
          setGroups(cloneInspectionChecklistGroups(nextGroups))
        }
        setTemplateMeta({
          id: data.id ?? data.Id,
          name: data.name ?? data.Name,
          revision: Number(data.revision ?? data.Revision ?? 1),
        })
      } catch {
        if (!mounted) return
        setGroups(cloneInspectionChecklistGroups(INITIAL_GROUPS))
        setTemplateMeta(null)
      }
    })()
    return () => { mounted = false }
  }, [isAdd])

  useEffect(() => {
    if (!isAdd || !selectedVehicleId || form.vehicleId) return

    const ctl = new AbortController()
    ;(async () => {
      try {
        const data: any = await fetchVehicleById(selectedVehicleId, ctl.signal)
        const src = data?.data ?? data?.vehicle ?? data
        const vehicleObj = src?.vehicle ?? src
        const customerObj = src?.customer ?? src?.owner ?? null
        const first = String(customerObj?.firstName ?? customerObj?.FirstName ?? '')
        const last = String(customerObj?.lastName ?? customerObj?.LastName ?? '')
        const customerName = `${first} ${last}`.trim()
          || String(customerObj?.name ?? src?.customerName ?? src?.ownerName ?? '')
        const customerId = customerObj?.id ?? customerObj?.Id ?? src?.customerId ?? src?.customer_id ?? src?.ownerId ?? src?.owner_id ?? ''
        const plateNo = String(vehicleObj?.plateNo ?? vehicleObj?.plateNumber ?? vehicleObj?.plate ?? '').trim()
        const makeName = String(vehicleObj?.vehicleModel?.vehicleMake?.name ?? vehicleObj?.vehicleModel?.vehicleMake?.Name ?? vehicleObj?.vehicleMake?.name ?? vehicleObj?.make ?? '').trim()
        const modelName = String(vehicleObj?.vehicleModel?.name ?? vehicleObj?.vehicleModel?.Name ?? vehicleObj?.model ?? '').trim()
        const makeModel = [makeName, modelName].filter(Boolean).join(' ').trim()
        const vehicleLabel = plateNo ? (makeModel ? `${makeModel} (${plateNo})` : plateNo) : makeModel
        const isChangan = (
          src?.isChangan === true ||
          src?.is_changan === true ||
          Number(src?.isChangan) === 1 ||
          Number(src?.is_changan) === 1 ||
          String(src?.clientType ?? '').toUpperCase() === 'CHANGAN'
        )

        setForm(f => ({
          ...f,
          customer: customerName || f.customer,
          customerId: customerId || f.customerId,
          vehicle: vehicleLabel || f.vehicle,
          vehicleId: src?.id ?? src?.vehicleId ?? src?.vehicle_id ?? selectedVehicleId,
          isChangan,
        }))
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          showToast('Failed to load selected vehicle', 'error')
        }
      }
    })()

    return () => ctl.abort()
  }, [form.vehicleId, isAdd, selectedVehicleId, showToast])

  // Load master lists (customers, service groups, users) on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setListsLoading(true)
      try {
        const [custResp, sgs, users, jobStatuses] = await Promise.all([
          fetchCustomers().catch(() => ({ customers: [], total: 0 })),
          getServiceGroups().catch(() => []),
          getUsers().catch(() => []),
          getJobStatuses().catch(() => [])
        ])

        if (!mounted) return

        const mappedCustomers = (custResp && Array.isArray((custResp as any).customers) ? (custResp as any).customers : []).map((c: any) => ({
          id: String(c.id ?? c.customerId ?? c.uid ?? ''),
          name: String(c.name ?? c.customerName ?? `${c.firstName||''} ${c.lastName||''}`.trim() ?? '')
        }))
        setCustomersList(mappedCustomers)

        const mappedServiceGroups = (Array.isArray(sgs) ? sgs : []).map((g: any) => ({ id: g.id ?? g.ServiceGroupId ?? g.serviceGroupId ?? g.Id ?? '', name: g.name ?? g.group ?? g.title ?? String(g) }))
        setServiceGroupList(mappedServiceGroups)

        const mappedUsers = (Array.isArray(users) ? users : []).map((u: any) => {
          const id = u.id ?? u.userId ?? u.Id ?? ''
          const firstName = u.firstName ?? u.FirstName ?? u.firstname ?? ''
          const lastName = u.lastName ?? u.LastName ?? u.lastname ?? ''
          const name = `${firstName} ${lastName}`.trim() || u.name || u.fullName || ''
          const isActive = (u.isActive ?? u.IsActive ?? (typeof u.status === 'string' ? (String(u.status).toLowerCase() === 'active') : undefined)) ?? true
          const role = typeof u.role === 'object' && u.role !== null
            ? (u.role.name ?? u.role.Name ?? u.primaryRole ?? u.roleName ?? '')
            : (u.role ?? u.primaryRole ?? u.roleName ?? '')
          const assignedRoles = Array.isArray(u.roles)
            ? u.roles.map((r: any) => typeof r === 'object' && r !== null ? (r.name ?? r.Name ?? '') : String(r ?? '')).filter(Boolean)
            : []
          const position = String(u.position ?? u.Position ?? u.jobTitle ?? u.JobTitle ?? u.designation ?? u.Designation ?? u.title ?? role).trim()
          return { id, name, firstName, lastName, isActive, role: String(role ?? '').trim(), position, assignedRoles }
        })
        setUserList(mappedUsers)
        const mappedJobStatuses = (Array.isArray(jobStatuses) ? jobStatuses : []).map((j: any) => {
          const code = String(j.code ?? j.Code ?? j.name ?? j.Name ?? j.status ?? j.Status ?? '').toUpperCase()
          const name = j.name ?? j.Name ?? j.display ?? j.Status ?? j.status ?? code
          return { id: j.id ?? j.Id ?? '', name: String(name), code }
        })
        setJobStatusList(mappedJobStatuses)
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setListsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // technician users: only active users whose role indicates technician (senior/junior)
  const techUserList = useMemo(() => {
    return (userList || []).filter(u => userMatchesKeywords(u, ['TECH', 'TECHNICIAN']))
  }, [userList])
  const advisorUserList = useMemo(() => {
    return (userList || []).filter(u => userMatchesKeywords(u, ['ADVISOR', 'SERVICE ADVISOR', 'SA']))
  }, [userList])
  const inspectorUserList = useMemo(() => {
    return (userList || []).filter(u => userMatchesKeywords(u, ['INSPECTOR', 'ESTIMATOR', 'ESTIMATE']))
  }, [userList])

  // supervisor user for quality check: first active user with supervisor role
  const supervisorUser = useMemo(() => {
    const supervisor = (userList || []).find(u => userMatchesKeywords(u, ['SUPER', 'SUPERVISOR']))
    return supervisor ?? (userList || []).find(u => u && u.isActive !== false) ?? null
  }, [userList])

  // Reconcile display names once master lists are available (editing mode)
  useEffect(() => {
    setForm(f => {
      const updates: Partial<InspectionForm> = {}
      if (f.customerId && !f.customer && customersList.length) {
        const found = customersList.find(c => String(c.id) === String(f.customerId))
        if (found) updates.customer = found.name
      }
      if (f.serviceGroupId && !f.serviceGroup && serviceGroupList.length) {
        const found = serviceGroupList.find(s => String(s.id) === String(f.serviceGroupId))
        if (found) updates.serviceGroup = found.name
      }
      if (f.serviceAdvisorId && !f.serviceAdvisor && userList.length) {
        const found = userList.find(u => String(u.id) === String(f.serviceAdvisorId))
        if (found) updates.serviceAdvisor = found.name
      }
      if (f.inspectorId && !f.inspector && userList.length) {
        const found = userList.find(u => String(u.id) === String(f.inspectorId))
        if (found) updates.inspector = found.name
      }
      return Object.keys(updates).length ? { ...f, ...updates } : f
    })
  }, [customersList, serviceGroupList, userList, form.customerId, form.serviceGroupId, form.serviceAdvisorId, form.inspectorId])

  useEffect(() => {
    if (!rawStatusCandidates || !Array.isArray(jobStatusList) || !jobStatusList.length) return
    const { id, code } = rawStatusCandidates
    let resolved: any = null
    if (id != null) resolved = jobStatusList.find(s => String(s.id) === String(id))
    if (!resolved && code) {
      const cs = String(code).toUpperCase()
      resolved = jobStatusList.find(s => String(s.code).toUpperCase() === cs) || jobStatusList.find(s => String(s.name).toUpperCase() === cs)
    }
    if (resolved) {
      setForm(f => {
        const newStatus = String(resolved.code).toUpperCase() as InspectionForm['status']
        if (String(f.status) === String(newStatus)) return f
        return { ...f, status: newStatus }
      })
      setRawStatusCandidates(null)
    }
  }, [jobStatusList, rawStatusCandidates])

  // Reconcile technician names once the user list is available
  useEffect(() => {
    if (!userList.length) return
    setTechnicians(ts => {
      let changed = false
      const next = ts.map(t => {
        if (t.id && !t.name) {
          const found = userList.find(u => String(u.id) === String(t.id))
          if (found) { changed = true; return { ...t, name: found.name } }
        }
        return t
      })
      return changed ? next : ts
    })
  }, [userList])

  // Fetch vehicles whenever customer selection changes
  useEffect(() => {
    let mounted = true
    if (!form.customerId) {
      setVehiclesList([])
      return
    }
    ;(async () => {
      setListsLoading(true)
      try {
        const res = await fetchVehiclesByCustomer(form.customerId as any)
        if (!mounted) return
        const mapped = (res && Array.isArray(res.vehicles) ? res.vehicles : []).map((v: any) => {
          const plate = String(v.plate || v.plateNo || v.plateNumber || '').trim()
          const make = String(v.make || v.vehicleMake || '').trim()
          const model = String(v.model || v.vehicleModel || '').trim()
          const vehicleName = [make, model].filter(Boolean).join(' ').trim() || (v.customerName ?? '') || ''
          const label = plate ? `${vehicleName} (${plate})` : vehicleName || plate || ''
          return { id: v.id ?? v.vehicleId ?? v.VehicleId ?? '', label }
        })
        setVehiclesList(mapped)
        if (mounted && mapped.length && form.vehicle && !form.vehicleId) {
          const found = mapped.find(m => String(m.label) === String(form.vehicle) || String(m.id) === String(form.vehicle))
          if (found) setForm(f => ({ ...f, vehicleId: found.id }))
        }
      } catch (e) {
        setVehiclesList([])
      } finally {
        if (mounted) setListsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [form.customerId])

  const [images, setImages] = useState<ImageItem[]>([])
  const [currentImage, setCurrentImage] = useState(0)

  useEffect(() => {
    if (isAdd || !routeId) return
    let mounted = true
    ;(async () => {
      try {
        const data: any = await getInspectionById(routeId!)
        if (!mounted || !data) return

        const candId = data.jobStatus?.id ?? data.JobStatus?.Id ?? data.jobStatusId ?? data.JobStatusId ?? null
        const candCodeOrName = String(
          data.jobStatus?.code ?? data.jobStatus?.name ?? data.JobStatus?.Code ?? data.JobStatus?.Name ?? data.status ?? data.Status ?? ''
        ).trim()
        setRawStatusCandidates({ id: candId ?? undefined, code: candCodeOrName || undefined })

        let resolvedCode: string | undefined
        if (Array.isArray(jobStatusList) && jobStatusList.length) {
          if (candId != null) {
            const byId = jobStatusList.find(s => String(s.id) === String(candId))
            if (byId) resolvedCode = String(byId.code ?? byId.name ?? '')
          }
          if (!resolvedCode && candCodeOrName) {
            const cs = candCodeOrName.toUpperCase()
            const byCode = jobStatusList.find(s => String(s.code).toUpperCase() === cs)
            if (byCode) resolvedCode = String(byCode.code)
            else {
              const byName = jobStatusList.find(s => String(s.name).toUpperCase() === cs)
              if (byName) resolvedCode = String(byName.code)
            }
          }
        }

        const rawStatus = String(candCodeOrName || '').toUpperCase()
        const validStatus: InspectionForm['status'] =
          rawStatus === 'OPEN' || rawStatus === 'CLOSED' || rawStatus === 'PENDING' ? (rawStatus as InspectionForm['status']) : 'OPEN'

        const customerObj = data.customer ?? data.Customer
        const customerId = data.customerId ?? data.CustomerId ?? customerObj?.id ?? customerObj?.Id
        const customerName = customerObj && typeof customerObj === 'object'
          ? [customerObj.firstName ?? customerObj.FirstName ?? '', customerObj.lastName ?? customerObj.LastName ?? '']
              .filter(Boolean).join(' ').trim()
          : String(data.customerName ?? '')

        const vehicleObj = data.vehicle ?? data.Vehicle
        const vehicleId = data.vehicleId ?? data.VehicleId ?? vehicleObj?.id ?? vehicleObj?.Id
        const vehicleModel = vehicleObj?.vehicleModel ?? vehicleObj?.VehicleModel
        const vehicleMake = vehicleModel?.vehicleMake ?? vehicleModel?.VehicleMake
        const makeName = String(vehicleMake?.name ?? vehicleMake?.Name ?? '').trim()
        const modelName = String(vehicleModel?.name ?? vehicleModel?.Name ?? '').trim()
        const plateNo = String(vehicleObj?.plateNo ?? vehicleObj?.PlateNo ?? '').trim()
        const makeModel = [makeName, modelName].filter(Boolean).join(' ').trim()
        const vehicleLabel = plateNo ? (makeModel ? `${makeModel} (${plateNo})` : plateNo) : makeModel

        setForm(f => ({
          ...f,
          status: (resolvedCode ? (String(resolvedCode).toUpperCase() as InspectionForm['status']) : validStatus),
          referenceNo: String(data.referenceNo ?? data.ReferenceNo ?? ''),
          transactionDate: String(data.transactionDate ?? data.TransactionDate ?? f.transactionDate ?? '').slice(0, 10),
          expirationDate: String(data.expirationDate ?? data.ExpirationDate ?? f.expirationDate ?? new Date().toISOString().slice(0,10)).slice(0, 10),
          customer: customerName || f.customer,
          customerId: customerId ?? f.customerId,
          vehicle: vehicleLabel || f.vehicle,
          vehicleId: vehicleId ?? f.vehicleId,
          serviceGroup: f.serviceGroup,
          serviceGroupId: data.serviceGroupId ?? data.ServiceGroupId ?? f.serviceGroupId,
          serviceAdvisor: f.serviceAdvisor,
          serviceAdvisorId: data.advisorUserId ?? data.AdvisorUserId ?? f.serviceAdvisorId,
          inspector: f.inspector,
          inspectorId: data.inspectorUserId ?? data.InspectorUserId ?? f.inspectorId,
          odometer: data.odometer != null ? String(data.odometer) : (data.Odometer != null ? String(data.Odometer) : ''),
          concern: String(data.vehicleFindings ?? data.VehicleFindings ?? ''),
          summaryRemarks: String(data.remarks ?? data.Remarks ?? ''),
          isChangan: !!(data.isChangan ?? data.IsChangan ?? false)
        }))

        // Technicians
        let parsedDetails: any = null
        const detailsRaw = data.inspectionDetails ?? data.InspectionDetails
        if (typeof detailsRaw === 'string' && detailsRaw.trim()) {
          try { parsedDetails = JSON.parse(detailsRaw) } catch { /* ignore */ }
        } else if (detailsRaw && typeof detailsRaw === 'object') {
          parsedDetails = detailsRaw
        }

        const detailsTemplate = parsedDetails?.template ?? parsedDetails?.Template
        if (detailsTemplate && typeof detailsTemplate === 'object') {
          setTemplateMeta({
            id: (detailsTemplate as any).id ?? (detailsTemplate as any).Id,
            name: (detailsTemplate as any).name ?? (detailsTemplate as any).Name,
            revision: Number((detailsTemplate as any).revision ?? (detailsTemplate as any).Revision ?? 1),
          })
        }

        const techsRaw =
          data.inspectionTechnicians ?? data.InspectionTechnicians ??
          parsedDetails?.technicians ?? parsedDetails?.Technicians ??
          data.technicians ?? data.Technicians
        if (Array.isArray(techsRaw) && techsRaw.length) {
          setTechnicians(techsRaw.map((t: any): TechnicianRow => {
            if (typeof t === 'string') return { name: t }
            const user = t.technicianUser ?? t.TechnicianUser ?? null
            const id = t.technicianUserId ?? t.TechnicianUserId ?? t.userId ?? t.UserId ?? t.id ?? t.Id ?? user?.id ?? user?.Id
            const userName = user
              ? [user.firstName ?? user.FirstName ?? '', user.lastName ?? user.LastName ?? ''].filter(Boolean).join(' ').trim()
              : ''
            const name = userName || String(t.name ?? t.Name ?? t.userName ?? t.UserName ?? '')
            return { id, name }
          }))
        }

        // RAG items
        const nextGroups = normalizeInspectionChecklistGroups(
          Array.isArray(parsedDetails)
            ? parsedDetails
            : (parsedDetails?.groups ?? parsedDetails?.Groups ?? data.groups ?? data.Groups)
        )
        if (nextGroups.length > 0) {
          setGroups(cloneInspectionChecklistGroups(nextGroups))
        } else {
          setGroups(cloneInspectionChecklistGroups(INITIAL_GROUPS))
        }
      } catch (err) {
        if (mounted) showToast(err instanceof Error ? err.message : 'Error loading inspection', 'error')
      }
    })()
    return () => { mounted = false }
  }, [routeId, isAdd])

  // Load photos from server (edit mode only)
  useEffect(() => {
    if (isAdd || !routeId) return
    let mounted = true
    setPhotosLoading(true)
    fetchInspectionPhotos(routeId)
      .then(photos => {
        if (!mounted) return
        setImages(photos.map(p => ({ id: p.filename, name: p.filename, src: p.url })))
        setCurrentImage(0)
      })
      .catch(() => {})
      .finally(() => { if (mounted) setPhotosLoading(false) })
    return () => { mounted = false }
  }, [routeId, isAdd])

  useEffect(() => {
    let mounted = true

    async function loadLinkedEstimate() {
      if (isAdd || !routeId) {
        setLinkedEstimate(null)
        return
      }
      try {
        const estimates: any = await getEstimatesSummary()
        if (!mounted) return
        setLinkedEstimate(findLinkedWorkflowRecord(
          Array.isArray(estimates) ? estimates : [],
          routeId,
          ['inspectionId', 'InspectionId'],
        ))
      } catch {
        if (mounted) setLinkedEstimate(null)
      }
    }

    loadLinkedEstimate()
    return () => { mounted = false }
  }, [routeId, isAdd])

  function updateField<K extends keyof InspectionForm>(k: K, v: InspectionForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const addTechnician = useCallback(() => {
    setErrors(prev => ({ ...prev, technicians: '' }))
    setTechnicians(t => {
      if (t.length >= MAX_TECHNICIANS) return t
      return [...t, { name: '', fullRow: true }]
    })
  }, [])

  const removeTechnician = useCallback((idx: number) => {
    setErrors(prev => ({ ...prev, technicians: '' }))
    setTechnicians(t => t.filter((_, i) => i !== idx))
  }, [])

  const updateTechnician = useCallback((idx: number, val: string) => {
    setTechnicians(prev => {
      const valStr = String(val ?? '')
      if (!valStr) {
        return prev.map((v, i) => i === idx ? { ...v, id: undefined, name: '' } : v)
      }
      const found = techUserList.find(u => String(u.id) === valStr || ((u.firstName || '').toString().trim() + ' ' + (u.lastName || '').toString().trim()).trim() === valStr || (u.name === valStr))
      if (found) {
        const duplicate = prev.some((v, i) => i !== idx && String(v.id) === String(found.id))
        if (duplicate) { showToast('Technician already selected', 'error'); return prev }
        return prev.map((v, i) => i === idx ? { ...v, id: found.id, name: found.name } : v)
      }
      const duplicateByName = prev.some((v, i) => i !== idx && String(v.name || '').toLowerCase() === valStr.toLowerCase())
      if (duplicateByName) { showToast('Technician already selected', 'error'); return prev }
      return prev.map((v, i) => i === idx ? { ...v, id: undefined, name: val } : v)
    })
  }, [techUserList, showToast])

  const searchTechnician = useCallback((idx: number, q: string) => {
    setErrors(prev => ({ ...prev, technicians: '' }))
    const ql = String(q ?? '').trim()
    setTechnicians(prev => {
      const selectedIds = new Set(prev.filter((_, i) => i !== idx && prev[i].id).map(x => String(x.id)))
      const pool = (techUserList || []).filter(u => !selectedIds.has(String(u.id)))
      const suggestions = (ql ? pool.filter(u => {
        const full = ((u.firstName ?? u.name ?? '') + ' ' + (u.lastName ?? '')).trim().toLowerCase()
        return full.includes(ql.toLowerCase()) || (String(u.name || '').toLowerCase().includes(ql.toLowerCase()))
      }) : pool).slice(0, 10).map(u => ({ ...u, position: u.position ?? '' }))
      return prev.map((r, i) => i === idx ? { ...r, search: q, suggestions, showDrop: true } : r)
    })
  }, [techUserList])

  const selectTechnician = useCallback((idx: number, u: any) => {
    setErrors(prev => ({ ...prev, technicians: '' }))
    setTechnicians(prev => {
      const duplicate = prev.some((v, i) => i !== idx && String(v.id) === String(u.id))
      if (duplicate) { showToast('Technician already selected', 'error'); return prev }
      const display = `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim()
      return prev.map((r, i) => i === idx ? { ...r, id: u.id, name: display, search: display, suggestions: [], showDrop: false } : r)
    })
  }, [showToast])

  function setStatus(groupIdx: number, itemIdx: number, status: 'isGreen' | 'isAmber' | 'isRed') {
    setGroups(g => g.map((grp, gi) => {
      if (gi !== groupIdx) return grp
      return {
        ...grp,
        detailsModelList: grp.detailsModelList.map((it, ii) => {
          if (ii !== itemIdx) return it
          const already = Boolean(it[status])
          return { ...it, isGreen: false, isAmber: false, isRed: false, [status]: !already }
        })
      }
    }))
  }

  function setRemarks(groupIdx: number, itemIdx: number, text: string) {
    setGroups(g => g.map((grp, gi) => {
      if (gi !== groupIdx) return grp
      return {
        ...grp,
        detailsModelList: grp.detailsModelList.map((it, ii) =>
          ii === itemIdx ? { ...it, remarks: text } : it
        )
      }
    }))
  }

  function buildInspectionDetailsPayload() {
    return JSON.stringify({
      template: templateMeta && (templateMeta.id || templateMeta.name || templateMeta.revision)
        ? templateMeta
        : undefined,
      groups,
      technicians: technicians
        .filter(t => t.id || t.name.trim())
        .map(t => ({ id: t.id, name: t.name }))
    })
  }

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    if (isAdd) {
      showToast('Save the inspection first before uploading photos', 'error')
      e.currentTarget.value = ''
      return
    }
    const arr = Array.from(files)
    e.currentTarget.value = ''
    for (const file of arr) {
      if (!file.type.startsWith('image/')) { showToast(`"${file.name}" is not an image`, 'error'); continue }
      if (file.size > 10 * 1024 * 1024) { showToast(`"${file.name}" exceeds the 10 MB limit`, 'error'); continue }
      try {
        const result = await uploadInspectionPhoto(routeId!, file)
        setImages(prev => [...prev, { id: result.filename, name: file.name, src: result.url }])
      } catch (err) {
        showToast(err instanceof Error ? err.message : `Failed to upload "${file.name}"`, 'error')
      }
    }
  }

  function prevImage() { setCurrentImage(i => Math.max(0, i - 1)) }
  function nextImage() { setCurrentImage(i => Math.min(images.length - 1, i + 1)) }

  async function removeImage(idx: number) {
    const img = images[idx]
    if (!img) return
    if (!canDelete) {
      showToast('You are not allowed to delete records.', 'error')
      return
    }
    try {
      if (!isAdd && routeId && img.id) await deleteInspectionPhoto(routeId, img.id)
      setImages(prev => prev.filter((_, i) => i !== idx))
      setCurrentImage(c => Math.min(c, Math.max(0, images.length - 2)))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete photo', 'error')
    }
  }

  async function handleConvertToEstimate() {
    const linkedEstimateId = pickWorkflowId(linkedEstimate)
    if (linkedEstimateId) {
      showToast('This inspection already has a linked estimate.', 'info')
      navigate(`/operations/estimate/${linkedEstimateId}`)
      return
    }

    setConverting(true)
    try {
      const openStatus = jobStatusList.find(s =>
        String(s.code).toUpperCase() === 'OPEN' || String(s.name).toUpperCase() === 'OPEN'
      )
      const nextEstimateRefResp: any = await getNextEstimateReferenceNo()
      const nextEstimateRef = String(nextEstimateRefResp?.referenceNo ?? nextEstimateRefResp?.ReferenceNo ?? '').trim()

      const estimatePayload: Record<string, unknown> = {
        isChangan: form.isChangan,
        isPackage: false,
        isCustomerApproved: false,
        inspectionId: routeId ? Number(routeId) : undefined,
        referenceNo: nextEstimateRef,
        transactionDate: form.transactionDate || null,
        expirationDate: form.expirationDate || null,
        estimatedDays: 0,
        jobStatusId: openStatus?.id ? Number(openStatus.id) : undefined,
        customerId: form.customerId ? Number(form.customerId) : 0,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : 0,
        advisorUserId: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : 0,
        estimatorUserId: form.inspectorId ? Number(form.inspectorId) : 0,
        approverUserId: supervisorUser?.id ? Number(supervisorUser.id) : 0,
        serviceGroupId: form.serviceGroupId ? Number(form.serviceGroupId) : 0,
        odometer: form.odometer ? Number(form.odometer) : null,
        nextOdometerReminder: null,
        customerPO: null,
        summary: [form.concern, form.summaryRemarks].filter(Boolean).join('\n') || null,
        subTotal: 0,
        vat12: 0,
        laborDiscount: 0,
        productDiscount: 0,
        additionalDiscount: 0,
        totalAmount: 0,
        createdById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : 0,
        updatedById: form.serviceAdvisorId ? Number(form.serviceAdvisorId) : 0,
        packages: [],
        services: [],
        products: [],
        technicians: technicians
          .filter(t => t.id)
          .map(t => ({ technicianUserId: Number(t.id) })),
      }

      const result: any = await saveEstimate(estimatePayload)
      const newEstimateId = result?.id ?? result?.Id ?? result?.estimateId ?? result?.EstimateId
      if (!newEstimateId) throw new Error('Estimate was created, but no estimate id was returned.')
      setLinkedEstimate({ id: newEstimateId, referenceNo: nextEstimateRef })

      const convertedStatus = jobStatusList.find(s =>
        String(s.code).toUpperCase() === 'CONVERTED' ||
        String(s.name).toUpperCase() === 'CONVERTED'
      )
      await updateInspection(routeId!, {
        ...form,
        odometer: form.odometer ? Number(String(form.odometer).replace(/[^0-9.-]+/g, '')) : undefined,
        vehicleFindings: form.concern,
        inspectionDetails: buildInspectionDetailsPayload(),
        remarks: form.summaryRemarks,
        technicians: technicians.map(t => t.name).filter(Boolean),
        technicianUserIds: technicians.map(t => t.id).filter(Boolean),
        groups,
        jobStatusId: convertedStatus?.id ? Number(convertedStatus.id) : undefined,
        status: 'CONVERTED',
      } as Record<string, unknown>)

      showToast('Inspection converted to estimate successfully', 'success')
      navigate(`/operations/estimate/${newEstimateId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to convert to estimate', 'error')
    } finally {
      setConverting(false)
      setConvertConfirmOpen(false)
    }
  }

  async function handlePrintInspection() {
    if (isAdd || !routeId || printing) return
    setPrinting(true)
    try {
      await openInspectionFormPdf(routeId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to print inspection form', 'error')
    } finally {
      setPrinting(false)
    }
  }

  async function handleSave() {
    if (saving) return
    const nextErrors: Record<string, string> = {}
    if (!form.status || !String(form.status).trim()) {
      nextErrors.status = 'Status is required'
    }
    if (!form.referenceNo || !String(form.referenceNo).trim()) {
      nextErrors.referenceNo = 'Reference No. is required'
    }
    if (!form.transactionDate || !String(form.transactionDate).trim()) {
      nextErrors.transactionDate = 'Transaction Date is required'
    }
    if (!form.expirationDate || !String(form.expirationDate).trim()) {
      nextErrors.expirationDate = 'Expiration date is required'
    }
    if (!form.customerId || !String(form.customerId).trim()) {
      nextErrors.customerId = 'Customer is required'
    }
    if (!form.vehicleId || !String(form.vehicleId).trim()) {
      nextErrors.vehicleId = 'Vehicle is required'
    }
    if (!form.serviceGroupId || !String(form.serviceGroupId).trim()) {
      nextErrors.serviceGroupId = 'Service Group is required'
    }
    if (!form.serviceAdvisorId || !String(form.serviceAdvisorId).trim()) {
      nextErrors.serviceAdvisorId = 'Service Advisor is required'
    }
    if (!form.inspectorId || !String(form.inspectorId).trim()) {
      nextErrors.inspectorId = 'Inspector / Estimator is required'
    }
    if (!form.concern || !String(form.concern).trim()) {
      nextErrors.concern = "Customer's Concern is required"
    }
    if (!form.summaryRemarks || !String(form.summaryRemarks).trim()) {
      nextErrors.summaryRemarks = 'Summary is required'
    }
    if (!technicians.some(t => (t.id && String(t.id).trim()) || String(t.name ?? '').trim())) {
      nextErrors.technicians = 'At least one technician is required'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      showToast(
        nextErrors.status
          ?? nextErrors.referenceNo
          ?? nextErrors.transactionDate
          ?? nextErrors.expirationDate
          ?? nextErrors.customerId
          ?? nextErrors.vehicleId
          ?? nextErrors.serviceGroupId
          ?? nextErrors.serviceAdvisorId
          ?? nextErrors.inspectorId
          ?? nextErrors.concern
          ?? nextErrors.summaryRemarks
          ?? nextErrors.technicians
          ?? 'Please fill required fields',
        'error'
      )
      return
    }
    setSaving(true)
    try {
      const resolvedJobStatus = jobStatusList.find(s => String(s.code).toUpperCase() === String(form.status).toUpperCase())
      const payload = {
        ...form,
        odometer: form.odometer ? Number(String(form.odometer).replace(/[^0-9.-]+/g, '')) : undefined,
        isChangan: form.isChangan,
        customerId: form.customerId ?? (typeof form.customer === 'string' && form.customer.match(/^\d+$/) ? Number(form.customer) : undefined),
        vehicleId: form.vehicleId ?? (typeof form.vehicle === 'string' && form.vehicle.match(/^\d+$/) ? Number(form.vehicle) : undefined),
        serviceGroupId: form.serviceGroupId ?? undefined,
        jobStatusId: resolvedJobStatus?.id ?? undefined,
        advisorUserId: form.serviceAdvisorId ?? undefined,
        inspectorUserId: form.inspectorId ?? undefined,
        estimatorUserId: form.inspectorId ?? undefined,
        vehicleFindings: form.concern,
        inspectionDetails: buildInspectionDetailsPayload(),
        remarks: form.summaryRemarks,
        technicians: technicians.map(t => t.name).filter(Boolean),
        technicianUserIds: technicians.map(t => t.id).filter(Boolean),
        groups
      }
      if (isAdd) {
        await saveInspection(payload as Record<string, unknown>)
      } else {
        await updateInspection(routeId!, payload as Record<string, unknown>)
      }
      showToast(isAdd ? 'Inspection added' : 'Inspection updated', 'success')
      navigate('/operations/inspection')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save inspection', 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentStatus = String(form.status || 'OPEN')
  const StatusIcon = STATUS_ICONS[currentStatus] || ShieldCheck
  const statusClass = STATUS_STYLES[currentStatus] || 'bg-slate-400 text-white'
  const isLocked = !canConvertFromStatus(form.status || 'OPEN')
  const linkedEstimateId = pickWorkflowId(linkedEstimate)
  const linkedEstimateReference = pickWorkflowReference(linkedEstimate)

  const statusOptions: SearchableSelectOption[] = jobStatusList.length
    ? jobStatusList.map(s => ({ value: s.code, label: String(s.name) }))
    : [{ value: 'OPEN', label: 'OPEN' }, { value: 'PENDING', label: 'PENDING' }, { value: 'CLOSED', label: 'CLOSED' }]

  const customerOptions: SearchableSelectOption[] = customersList.map(c => ({ value: c.id, label: c.name }))

  const vehicleOptions: SearchableSelectOption[] = vehiclesList.map(v => ({ value: String(v.id), label: v.label }))

  const serviceGroupOptions: SearchableSelectOption[] = serviceGroupList.map(g => ({ value: String(g.id), label: g.name }))

  const advisorOptions: PersonnelOption[] = advisorUserList.map(u => ({
    value: String(u.id),
    label: `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim(),
    badge: (u.position || u.role || '').trim()
  }))

  const inspectorOptions: PersonnelOption[] = inspectorUserList.map(u => ({
    value: String(u.id),
    label: `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim(),
    badge: (u.position || u.role || '').trim()
  }))

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{isAdd ? 'Add Inspection' : 'Manage Inspection'}</h2>
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
              <span className="font-medium">New Inspection</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {linkedEstimateId && (
          <LinkedTransactionNotice
            label="Converted Estimate"
            referenceNo={linkedEstimateReference}
            hint="This inspection already produced an estimate, so converting again is blocked."
            onOpen={() => navigate(`/operations/estimate/${linkedEstimateId}`)}
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
                  <span className="text-sm font-medium text-slate-700">Changan Client?</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isChangan: !f.isChangan }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.isChangan ? 'bg-sky-600' : 'bg-slate-300'}`}
                    aria-pressed={form.isChangan}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isChangan ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
              {/* Right: Convert to Estimate | Print */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={isLocked || isAdd}
                  title={isLocked ? 'Inspection must be OPEN to convert to estimate' : isAdd ? 'Save the inspection first' : undefined}
                  onClick={() => setConvertConfirmOpen(true)}
                  className={`px-4 py-2 rounded text-sm flex items-center gap-2 ${(isLocked || isAdd) ? 'bg-emerald-200 text-emerald-700 opacity-60 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                >
                  <FileText size={14} /> Convert to Estimate
                </button>
                <button
                  disabled={isAdd || printing}
                  title={isAdd ? 'Save the inspection first' : undefined}
                  onClick={handlePrintInspection}
                  className={`px-4 py-2 rounded bg-slate-200 text-slate-600 text-sm flex items-center gap-2 ${(isAdd || printing) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-300'}`}
                >
                  <Printer size={14} /> {printing ? 'Printing...' : 'Print Inspection Form'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inspection Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t border-b">
              <div className="text-sm font-medium text-slate-700">Inspection Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status <span className="text-rose-500">*</span></label>
                    <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.status ? 'border-rose-500' : ''}`}>
                      <ShieldCheck className="text-slate-400 shrink-0" size={16} />
                      <SearchableSelect
                        options={statusOptions}
                        value={form.status}
                        onChange={v => { updateField('status', v as InspectionForm['status']); setErrors(prev => ({ ...prev, status: '' })) }}
                        disabled={true}
                        placeholder="Select status"
                      />
                    </div>
                    {errors.status && <div className="mt-1 text-sm text-rose-600">{errors.status}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Reference No. <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.referenceNo ? 'border-rose-500' : ''}`}>
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="V10000717" value={form.referenceNo} onChange={e => { updateField('referenceNo', e.target.value); setErrors(prev => ({ ...prev, referenceNo: '' })) }} disabled={isLocked || isAdd} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.referenceNo && <div className="mt-1 text-sm text-rose-600">{errors.referenceNo}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Date <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.transactionDate ? 'border-rose-500' : ''}`}>
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e => { updateField('transactionDate', e.target.value); setErrors(prev => ({ ...prev, transactionDate: '' })) }} disabled={isLocked} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.transactionDate && <div className="mt-1 text-sm text-rose-600">{errors.transactionDate}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Expiration Date <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.expirationDate ? 'border-rose-500' : ''}`}>
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.expirationDate} onChange={e => { updateField('expirationDate', e.target.value); setErrors(prev => ({ ...prev, expirationDate: '' })) }} disabled={isLocked} required aria-required="true" className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.expirationDate && <div className="mt-1 text-sm text-rose-600">{errors.expirationDate}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Customer <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.customerId ? 'border-rose-500' : ''}`}>
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={customerOptions}
                      value={String(form.customerId ?? '')}
                      onChange={id => {
                        const sel = customersList.find(c => String(c.id) === id)
                        updateField('customerId', sel ? sel.id : id as any)
                        updateField('customer', sel ? sel.name : '')
                        updateField('vehicle', '' as any)
                        updateField('vehicleId', undefined as any)
                        setErrors(prev => ({ ...prev, customerId: '', vehicleId: '' }))
                      }}
                      disabled={isLocked}
                      placeholder="Select customer"
                    />
                  </div>
                  {errors.customerId && <div className="mt-1 text-sm text-rose-600">{errors.customerId}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.vehicleId ? 'border-rose-500' : ''}`}>
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={vehicleOptions}
                      value={String(form.vehicleId ?? '')}
                      onChange={id => {
                        const sel = vehiclesList.find(v => String(v.id) === id)
                        updateField('vehicleId', sel ? sel.id : id as any)
                        updateField('vehicle', sel ? sel.label : '')
                        setErrors(prev => ({ ...prev, vehicleId: '' }))
                      }}
                      disabled={isLocked || !form.customerId}
                      placeholder={form.customerId ? 'Select vehicle' : 'Select customer first'}
                    />
                    {(form.vehicle || form.vehicleId) && (
                      <button disabled={isLocked} className={`ml-1 shrink-0 ${isLocked ? 'text-slate-300' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => { updateField('vehicle', ''); updateField('vehicleId', undefined as any) }} aria-label="Clear vehicle">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {errors.vehicleId && <div className="mt-1 text-sm text-rose-600">{errors.vehicleId}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Service Group <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.serviceGroupId ? 'border-rose-500' : ''}`}>
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={serviceGroupOptions}
                      value={String(form.serviceGroupId ?? '')}
                      onChange={id => {
                        const sel = serviceGroupList.find(s => String(s.id) === id)
                        updateField('serviceGroupId', sel ? sel.id : id as any)
                        updateField('serviceGroup', sel ? sel.name : '')
                        setErrors(prev => ({ ...prev, serviceGroupId: '' }))
                      }}
                      disabled={isLocked}
                      placeholder="Select service group"
                    />
                  </div>
                  {errors.serviceGroupId && <div className="mt-1 text-sm text-rose-600">{errors.serviceGroupId}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Odometer</label>
                  <div className="flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input
                      placeholder="# 0"
                      value={formatInteger(form.odometer)}
                      onChange={e => {
                        const raw = String(e.target.value || '').replace(/[^0-9]/g, '')
                        updateField('odometer', raw as any)
                      }}
                      disabled={isLocked}
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Service Advisor <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.serviceAdvisorId ? 'border-rose-500' : ''}`}>
                    <User className="text-slate-400 shrink-0" size={16} />
                    <PersonnelSelect
                      options={advisorOptions}
                      value={String(form.serviceAdvisorId ?? '')}
                      onChange={id => {
                        const sel = advisorUserList.find(u => String(u.id) === id)
                        updateField('serviceAdvisorId', sel ? sel.id : id as any)
                        updateField('serviceAdvisor', sel ? sel.name : '')
                        setErrors(prev => ({ ...prev, serviceAdvisorId: '' }))
                      }}
                      disabled={isLocked}
                      placeholder="Select advisor"
                    />
                  </div>
                  {errors.serviceAdvisorId && <div className="mt-1 text-sm text-rose-600">{errors.serviceAdvisorId}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Inspector / Estimator <span className="text-rose-500">*</span></label>
                  <div className={`flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.inspectorId ? 'border-rose-500' : ''}`}>
                    <User className="text-slate-400 shrink-0" size={16} />
                    <PersonnelSelect
                      options={inspectorOptions}
                      value={String(form.inspectorId ?? '')}
                      onChange={id => {
                        const sel = inspectorUserList.find(u => String(u.id) === id)
                        updateField('inspectorId', sel ? sel.id : id as any)
                        updateField('inspector', sel ? sel.name : '')
                        setErrors(prev => ({ ...prev, inspectorId: '' }))
                      }}
                      disabled={isLocked}
                      placeholder="Select inspector"
                    />
                  </div>
                  {errors.inspectorId && <div className="mt-1 text-sm text-rose-600">{errors.inspectorId}</div>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer's Concern <span className="text-rose-500">*</span></label>
                <div className={`bg-white border rounded ${errors.concern ? 'border-rose-500' : ''}`}>
                  <textarea disabled={isLocked} value={form.concern} onChange={e => { updateField('concern', e.target.value); setErrors(prev => ({ ...prev, concern: '' })) }} placeholder="Describe the customer's concern" className="w-full p-3 bg-transparent outline-none text-sm resize-none h-24" />
                </div>
                {errors.concern && <div className="mt-1 text-sm text-rose-600">{errors.concern}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Technicians */}
        <div className="bg-white rounded shadow-sm">
          <div className={`rounded border overflow-visible ${errors.technicians ? 'border-rose-500' : ''}`}>
            <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">Technicians <span className="text-rose-500">*</span> <span className="text-xs text-slate-500 font-normal">(Max {MAX_TECHNICIANS})</span></div>
              <div className="text-xs text-slate-500">{technicians.filter(t => t.name.trim()).length} / {MAX_TECHNICIANS} assigned</div>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-3 w-full">
                {technicians.map((t, idx) => (
                  <div key={idx} className="w-full flex items-center gap-2 bg-white border rounded px-3 py-2 relative">
                    <Wrench className="text-slate-400 shrink-0" size={14} />
                    <div className="flex-1 w-full relative">
                      <input
                        value={(t.search ?? t.name) || ''}
                        onChange={e => searchTechnician(idx, e.target.value)}
                        onFocus={() => searchTechnician(idx, (t.search ?? t.name ?? ''))}
                        onBlur={() => setTimeout(() => setTechnicians(prev => prev.map((r, i) => i === idx ? { ...r, showDrop: false } : r)), 150)}
                        placeholder="Select technician"
                        disabled={isLocked}
                        className="w-full bg-transparent outline-none text-sm"
                      />
                      {t.showDrop && t.suggestions && t.suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow z-50 max-h-48 overflow-y-auto">
                          {t.suggestions.map(u => {
                            const displayName = `${(u.firstName ?? u.name ?? '').trim()}${u.lastName ? ' ' + u.lastName : ''}`.trim()
                            const badge = (u.position || u.role || '').trim()
                            return (
                              <div key={String(u.id)} onMouseDown={(e) => { e.preventDefault(); selectTechnician(idx, u) }} className="px-3 py-2 hover:bg-slate-50 cursor-pointer">
                                <div className="text-sm text-slate-800">{displayName}</div>
                                {badge && <div className="text-xs text-slate-400 mt-0.5">{badge}</div>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeTechnician(idx)} disabled={isLocked} className={`p-1.5 rounded bg-rose-500 text-white ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-rose-600'}`} aria-label="Remove technician">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={addTechnician}
                  disabled={isLocked || technicians.length >= MAX_TECHNICIANS}
                  title={technicians.length >= MAX_TECHNICIANS ? `Maximum ${MAX_TECHNICIANS} technicians allowed` : undefined}
                  className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'} text-sm font-medium ${technicians.length >= MAX_TECHNICIANS ? 'opacity-50 cursor-not-allowed hover:bg-emerald-600' : ''}`}
                >
                  <Plus size={14} /> Add Technician
                </button>
              </div>
              {errors.technicians && <div className="mt-3 text-sm text-rose-600">{errors.technicians}</div>}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Status Legend</div>
            </div>
            <div className="p-4 flex flex-wrap items-center gap-6 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
                <span>OK</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                <span>May require attention</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-rose-600" />
                <span>Requires immediate attention</span>
              </div>
            </div>
          </div>
        </div>

        {/* Checklist Groups */}
        {groups.map((grp, gi) => (
          <div key={grp.group} className="bg-white rounded shadow-sm">
            <div className="rounded border overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center">
                <div className="text-sm font-medium text-slate-700">{grp.group}</div>
              </div>
              <div className="p-4 space-y-3">
                {grp.detailsModelList.map((it, idx) => (
                  <div key={it.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-start">
                    <div className="text-sm text-slate-600 bg-slate-50 border rounded px-3 py-2 text-center min-w-[40px]">{it.id}</div>

                    <div className="bg-gray-50 border rounded px-3 py-2 text-sm text-slate-700 flex items-center">{it.name}</div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setStatus(gi, idx, 'isGreen')}
                        disabled={isLocked}
                        className={`w-9 h-9 rounded-full shadow flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 transition ${it.isGreen ? 'ring-2 ring-emerald-300 ring-offset-1' : ''} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label={`${it.name}: OK`}
                        aria-pressed={it.isGreen}
                      >
                        {it.isGreen && <Check size={16} className="text-white" />}
                      </button>
                      <button
                        onClick={() => setStatus(gi, idx, 'isAmber')}
                        disabled={isLocked}
                        className={`w-9 h-9 rounded-full shadow flex items-center justify-center bg-amber-500 hover:bg-amber-600 transition ${it.isAmber ? 'ring-2 ring-amber-300 ring-offset-1' : ''} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label={`${it.name}: May require attention`}
                        aria-pressed={it.isAmber}
                      >
                        {it.isAmber && <Check size={16} className="text-white" />}
                      </button>
                      <button
                        onClick={() => setStatus(gi, idx, 'isRed')}
                        disabled={isLocked}
                        className={`w-9 h-9 rounded-full shadow flex items-center justify-center bg-rose-500 hover:bg-rose-600 transition ${it.isRed ? 'ring-2 ring-rose-300 ring-offset-1' : ''} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label={`${it.name}: Requires immediate attention`}
                        aria-pressed={it.isRed}
                      >
                        {it.isRed && <Check size={16} className="text-white" />}
                      </button>
                    </div>

                    {(it.isAmber || it.isRed) && (
                      <div className="col-start-2 col-span-1">
                        <textarea
                          value={it.remarks || ''}
                          onChange={e => setRemarks(gi, idx, e.target.value)}
                          disabled={isLocked}
                          className="w-full border rounded p-2 text-sm resize-none"
                          rows={2}
                          placeholder="Remarks"
                          aria-label={`Remarks for ${it.name}`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Summary</div>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">Summary <span className="text-rose-500">*</span></label>
                  <div className={`mt-2 bg-white border rounded flex flex-col ${errors.summaryRemarks ? 'border-rose-500' : ''}`}>
                    <textarea
                      value={form.summaryRemarks}
                      onChange={e => { updateField('summaryRemarks', e.target.value); setErrors(prev => ({ ...prev, summaryRemarks: '' })) }}
                      placeholder="Optional remarks"
                      className="w-full p-3 bg-transparent outline-none text-sm resize-none min-h-[10rem]"
                    />
                  </div>
                  {errors.summaryRemarks && <div className="mt-1 text-sm text-rose-600">{errors.summaryRemarks}</div>}
                </div>

                {/* Vehicle Photos */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-700">Vehicle Photos</label>
                      {!isAdd && images.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-medium border border-violet-100">
                          {images.length} photo{images.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div>
                      <input
                        id="inspection-photos-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onFilesSelected}
                        disabled={isLocked || isAdd}
                        className="hidden"
                      />
                      <label
                        htmlFor="inspection-photos-input"
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold shadow-sm tracking-wide ${(isLocked || isAdd) ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:bg-violet-700 transition-colors'}`}
                        title={isAdd ? 'Save the inspection first to upload photos' : undefined}
                      >
                        <UploadCloud size={13} /> Upload Photos
                      </label>
                    </div>
                  </div>

                  {isAdd ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 h-52 flex flex-col items-center justify-center gap-2">
                      <UploadCloud size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400 font-medium">Save the inspection first</p>
                      <p className="text-xs text-slate-400">Photos can be uploaded after the record is saved</p>
                    </div>
                  ) : photosLoading ? (
                    <div className="border rounded-xl bg-slate-50 h-52 flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw size={16} className="animate-spin" />
                      <span className="text-sm">Loading photos…</span>
                    </div>
                  ) : images.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 h-52 flex flex-col items-center justify-center gap-2">
                      <UploadCloud size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400 font-medium">No photos yet</p>
                      <p className="text-xs text-slate-400">Click <span className="font-semibold">Upload Photos</span> to attach vehicle images</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {/* Main viewer */}
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 shadow-lg" style={{ aspectRatio: '16/9' }}>
                        <img
                          key={images[currentImage].id}
                          src={images[currentImage].src}
                          alt={images[currentImage].name}
                          className="w-full h-full object-contain"
                        />

                        {/* Prev / Next */}
                        {images.length > 1 && (
                          <>
                            <button
                              onClick={prevImage}
                              disabled={currentImage === 0}
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition disabled:opacity-20 disabled:pointer-events-none z-10"
                              aria-label="Previous photo"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <button
                              onClick={nextImage}
                              disabled={currentImage >= images.length - 1}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition disabled:opacity-20 disabled:pointer-events-none z-10"
                              aria-label="Next photo"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </>
                        )}

                        {/* Top-right: counter + fullscreen */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                          <span className="text-white text-xs bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full font-medium tabular-nums">
                            {currentImage + 1} / {images.length}
                          </span>
                          <button
                            onClick={() => { setLightboxIdx(currentImage); setLightboxOpen(true) }}
                            className="w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white flex items-center justify-center transition"
                            aria-label="View fullscreen"
                          >
                            <Maximize2 size={13} />
                          </button>
                        </div>

                        {/* Bottom gradient + filename */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
                          <p className="text-white text-xs truncate opacity-80 font-medium">{images[currentImage].name}</p>
                        </div>
                      </div>

                      {/* Thumbnail strip */}
                      <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
                        {images.map((img, i) => (
                          <div
                            key={img.id}
                            className={`group relative shrink-0 w-20 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-150 ${
                              i === currentImage
                                ? 'border-violet-500 shadow-md shadow-violet-200/60'
                                : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-300'
                            }`}
                            onClick={() => setCurrentImage(i)}
                          >
                            <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
                            {canDelete && (
                              <button
                                onClick={e => { e.stopPropagation(); removeImage(i) }}
                                disabled={isLocked}
                                className={`absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity ${isLocked ? 'cursor-not-allowed' : 'hover:bg-rose-600'}`}
                                aria-label={`Delete photo ${i + 1}`}
                              >
                                <X size={9} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate(-1)} disabled={isLocked} className={`px-4 py-2 border rounded bg-white text-slate-700 text-sm ${isLocked ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-50'}`}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className={`px-4 py-2 bg-bosch-blue text-white rounded text-sm ${saving ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>

      {/* Convert to Estimate confirmation */}
      <ConfirmModal
        isOpen={convertConfirmOpen}
        title="Convert to Estimate"
        message="This will create a new estimate based on this inspection and mark the inspection as Converted. Do you want to proceed?"
        confirmLabel="Yes, Convert"
        cancelLabel="Cancel"
        loading={converting}
        onConfirm={handleConvertToEstimate}
        onCancel={() => setConvertConfirmOpen(false)}
      />

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20"
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.max(0, i - 1)) }}
            disabled={lightboxIdx === 0}
            aria-label="Previous"
          >
            <ChevronLeft size={28} />
          </button>

          <img
            src={images[lightboxIdx]?.src}
            alt={images[lightboxIdx]?.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20"
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.min(images.length - 1, i + 1)) }}
            disabled={lightboxIdx >= images.length - 1}
            aria-label="Next"
          >
            <ChevronRight size={28} />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
            {lightboxIdx + 1} / {images.length}
          </div>

          {/* Lightbox thumbnail strip */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-2 pb-1">
            {images.map((img, i) => (
              <div
                key={img.id}
                onClick={e => { e.stopPropagation(); setLightboxIdx(i) }}
                className={`shrink-0 w-12 h-12 rounded cursor-pointer overflow-hidden border-2 ${i === lightboxIdx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-90'}`}
              >
                <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
