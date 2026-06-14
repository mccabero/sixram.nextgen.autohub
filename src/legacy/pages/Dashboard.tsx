// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { currency, formatShortDate, formatPHMobile } from '../utils/format'
import StatCard from '../components/cards/StatCard'
import DateRangePicker from '../components/ui/DateRangePicker'
import SalesChart from '../components/charts/SalesChart'
import { Users, Truck, FileText, Wrench, DollarSign, CreditCard, Percent, Activity, ChevronDown, ChevronUp, Clock3, ArrowRight, CheckCircle2 } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { fetchVehicles } from '../services/vehicleService'
import { getEffectivePermissions, getUsers } from '../services/adminService'
import {
  CAN_FILTER_DASHBOARD_PERMISSION_KEY,
  hasPermissionKey,
} from '../utils/effectivePermissions'
import {
  ClientTypeBadge,
  ClientTypeFilter,
  EmptyState,
  ListPagination,
  ListPageHeader,
  ListSearchInput,
  ListToolbar,
  RowActions,
  StatusBadge,
} from '../components/lists'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'

type OngoingJobOrderRow = {
  id: string | number
  clientType: string
  referenceNo: string
  joDate: string
  customerName: string
  vehicle: string
  plateNo: string
  jobOrderType: string
  status: string
  ageDays: number | null
}

type OngoingJobFilter = 'ALL' | 'AGED' | 'TODAY' | 'OLDEST'
type InactiveServiceFilter = 'ALL' | 'CHANGE_OIL' | 'PMS'

const DASHBOARD_FINANCIAL_PERMISSION = 'page.dashboard.financial_data.view'

function getValue(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function toDisplayString(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toLocaleDateString()
  if (typeof value === 'object') {
    if (value.name) return String(value.name)
    if (value.Name) return String(value.Name)
    if (value.model) return String(value.model)
    if (value.Model) return String(value.Model)
    if (value.plateNo) return String(value.plateNo)
    if (value.PlateNo) return String(value.PlateNo)
    if (value.vehicle) return String(value.vehicle)
    if (value.Vehicle) return String(value.Vehicle)
    if (value.vehicleModel && (value.vehicleModel.name || value.vehicleModel.model)) return String(value.vehicleModel.name ?? value.vehicleModel.model)
    if (value.VehicleModel && (value.VehicleModel.Name || value.VehicleModel.Model)) return String(value.VehicleModel.Name ?? value.VehicleModel.Model)
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

function getNameFromObject(obj: any): string {
  if (!obj || typeof obj !== 'object') return ''
  const first = obj.firstName ?? obj.first_name ?? obj.firstname ?? obj.givenName ?? obj.FirstName ?? obj.Firstname ?? ''
  const last = obj.lastName ?? obj.last_name ?? obj.lastname ?? obj.familyName ?? obj.LastName ?? ''
  const full = [first, last].filter(Boolean).join(' ').trim()
  return full || String(obj.fullName ?? obj.FullName ?? obj.name ?? obj.Name ?? '')
}

function getJobOrderStatusLabel(item: any): string {
  const jobStatus = getValue(item, 'jobStatus', 'JobStatus')
  if (jobStatus && typeof jobStatus === 'object') {
    return String(jobStatus.name ?? jobStatus.Name ?? jobStatus.status ?? jobStatus.Status ?? '')
  }
  return String(jobStatus ?? getValue(item, 'status', 'Status', 'statusName', 'StatusName', 'status_name') ?? '')
}

function toArray(value: any): any[] {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  return [value]
}

function normalizeServiceSearchText(value: any): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isChangeOilServiceText(value: any): boolean {
  const normalized = normalizeServiceSearchText(value)
  return /\bchange\s+oil\b/.test(normalized) || /\boil\s+change\b/.test(normalized)
}

function isPmsServiceOrPackageText(value: any): boolean {
  const normalized = normalizeServiceSearchText(value)
  return /\bpms\b/.test(normalized)
    || /\bpreventive\s+maintenance\b/.test(normalized)
    || /\bperiodic\s+maintenance\b/.test(normalized)
    || /\bpreventative\s+maintenance\b/.test(normalized)
}

function jobOrderHasChangeOilService(item: any): boolean {
  const serviceNameValues = [
    ...toArray(getValue(item, 'serviceNames', 'ServiceNames', 'service_names')),
    ...toArray(getValue(item, 'serviceName', 'ServiceName', 'service_name')),
  ]

  const serviceRows = [
    ...toArray(getValue(item, 'services', 'Services')),
    ...toArray(getValue(item, 'jobOrderServices', 'JobOrderServices', 'job_order_services')),
  ]

  for (const value of serviceNameValues) {
    if (isChangeOilServiceText(value)) return true
  }

  for (const row of serviceRows) {
    if (isChangeOilServiceText(row)) return true
    if (isChangeOilServiceText(getValue(row, 'name', 'Name', 'serviceName', 'ServiceName', 'service_name'))) return true
    const service = getValue(row, 'service', 'Service')
    if (isChangeOilServiceText(getValue(service, 'name', 'Name', 'serviceName', 'ServiceName'))) return true
  }

  return false
}

function jobOrderHasPmsServiceOrPackage(item: any): boolean {
  const directValues = [
    ...toArray(getValue(item, 'serviceNames', 'ServiceNames', 'service_names')),
    ...toArray(getValue(item, 'serviceName', 'ServiceName', 'service_name')),
    ...toArray(getValue(item, 'packageNames', 'PackageNames', 'package_names')),
    ...toArray(getValue(item, 'packageName', 'PackageName', 'package_name')),
    ...toArray(getValue(item, 'packageSearchTexts', 'PackageSearchTexts', 'package_search_texts')),
    ...toArray(getValue(item, 'packageServiceNames', 'PackageServiceNames', 'package_service_names')),
  ]

  const serviceRows = [
    ...toArray(getValue(item, 'services', 'Services')),
    ...toArray(getValue(item, 'jobOrderServices', 'JobOrderServices', 'job_order_services')),
  ]

  const packageRows = [
    ...toArray(getValue(item, 'packages', 'Packages')),
    ...toArray(getValue(item, 'jobOrderPackages', 'JobOrderPackages', 'job_order_packages')),
  ]

  for (const value of directValues) {
    if (isPmsServiceOrPackageText(value)) return true
  }

  for (const row of serviceRows) {
    if (isPmsServiceOrPackageText(row)) return true
    if (isPmsServiceOrPackageText(getValue(row, 'name', 'Name', 'serviceName', 'ServiceName', 'service_name'))) return true
    const service = getValue(row, 'service', 'Service')
    if (isPmsServiceOrPackageText(getValue(service, 'name', 'Name', 'serviceName', 'ServiceName'))) return true
  }

  for (const row of packageRows) {
    if (isPmsServiceOrPackageText(row)) return true
    if (isPmsServiceOrPackageText(getValue(row, 'name', 'Name', 'packageName', 'PackageName', 'package_name', 'summary', 'Summary', 'code', 'Code'))) return true
    const packageValue = getValue(row, 'package', 'Package')
    if (isPmsServiceOrPackageText(getValue(packageValue, 'name', 'Name', 'packageName', 'PackageName', 'summary', 'Summary', 'code', 'Code'))) return true

    const packageServices = [
      ...toArray(getValue(row, 'services', 'Services')),
      ...toArray(getValue(row, 'packageServices', 'PackageServices', 'package_services')),
    ]
    for (const serviceRow of packageServices) {
      if (isPmsServiceOrPackageText(serviceRow)) return true
      if (isPmsServiceOrPackageText(getValue(serviceRow, 'name', 'Name', 'serviceName', 'ServiceName', 'service_name'))) return true
      const service = getValue(serviceRow, 'service', 'Service')
      if (isPmsServiceOrPackageText(getValue(service, 'name', 'Name', 'serviceName', 'ServiceName'))) return true
    }
  }

  return false
}

export function isOngoingJobOrderStatus(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[-_]+/g, ' ')
  if (!normalized) return false

  const terminalPatterns = [
    /CANCEL/,
    /VOID/,
    /DELETE/,
    /COMPLETE/,
    /FOR\s+PAYMENT/,
    /\bPAID\b/,
    /CLOSE/,
    /DONE/,
    /DELIVER/,
    /RELEASE/,
    /INVOIC/,
    /CONVERT/,
  ]

  return !terminalPatterns.some(pattern => pattern.test(normalized))
}

function formatAgeLabel(ageDays: number | null) {
  if (ageDays === null) return 'No date'
  if (ageDays <= 0) return 'Today'
  if (ageDays === 1) return '1 day'
  return `${ageDays} days`
}

export default function Dashboard(){
  const showClientType = useShowIsChanganOption()
  const [monthlyOpen, setMonthlyOpen] = useState(true)
  const [canViewFinancialData, setCanViewFinancialData] = useState(false)
  const [canFilterDashboard, setCanFilterDashboard] = useState(false)
  const [financialPermissionResolved, setFinancialPermissionResolved] = useState(false)
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const defaultDateRange = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return { start: `${y}-${m}-01`, end: `${y}-${m}-${dd}` }
  }, [])
  const [dateRange, setDateRange] = useState<{ start?: string, end?: string } | null>(defaultDateRange)
  const [pendingDateRange, setPendingDateRange] = useState<{ start?: string, end?: string } | null>(defaultDateRange)
  const [inactiveOpen, setInactiveOpen] = useState(true)
  const [ongoingOpen, setOngoingOpen] = useState(true)
  const [ongoingFilter, setOngoingFilter] = useState<OngoingJobFilter>('TODAY')
  const [selectedClientType, setSelectedClientType] = useState<'ALL' | 'BOSCH' | 'CHANGAN'>('ALL')
  const [inactiveServiceFilter, setInactiveServiceFilter] = useState<InactiveServiceFilter>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [monthlySales, setMonthlySales] = useState<{ month: string, sales: number, expenses?: number, quickSales?: number, discounts?: number }[]>([])
  const [chartVisible, setChartVisible] = useState<{ customers: boolean, vehicles: boolean, estimates: boolean, jobOrders: boolean }>({ customers: true, vehicles: true, estimates: true, jobOrders: true })
  const [totalSales, setTotalSales] = useState<number>(0)
  const [quickSales, setQuickSales] = useState<number>(0)
  const [totalDiscount, setTotalDiscount] = useState<number>(0)
  const [expensesTotal, setExpensesTotal] = useState<number>(0)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [birthdayOpen, setBirthdayOpen] = useState(true)
  const dashboardDateRange = canFilterDashboard ? dateRange : defaultDateRange
  const dashboardSelectedYear = canFilterDashboard ? selectedYear : currentYear
  const effectiveOngoingFilter = canFilterDashboard ? ongoingFilter : 'ALL'
  const effectiveSelectedClientType = canFilterDashboard ? selectedClientType : 'ALL'
  const effectiveInactiveServiceFilter = canFilterDashboard ? inactiveServiceFilter : 'ALL'
  const effectiveSearchTerm = canFilterDashboard ? searchTerm : ''

  // Raw structural data — loaded once on mount via a single parallel fetch
  const [rawCustomers, setRawCustomers] = useState<any[]>([])
  const [rawVehicles, setRawVehicles] = useState<any[]>([])
  const [rawEstimates, setRawEstimates] = useState<any[]>([])
  const [rawJobOrders, setRawJobOrders] = useState<any[]>([])
  const [rawUsers, setRawUsers] = useState<any[]>([])
  const [rawDataLoading, setRawDataLoading] = useState(true)

  // Parse various date string formats to a local Date (avoids UTC timezone shifts)
  const parseToLocalDate = (val: any): Date | null => {
    if (!val && val !== 0) return null
    if (val instanceof Date) return isNaN(val.getTime()) ? null : new Date(val.getFullYear(), val.getMonth(), val.getDate())
    const s = String(val)
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
      if (!Number.isNaN(y) && !Number.isNaN(mo) && !Number.isNaN(d)) return new Date(y, mo-1, d)
    }
    const parsed = new Date(s)
    if (isNaN(parsed.getTime())) return null
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  }

  const toArr = (d: any, ...keys: string[]): any[] => {
    if (Array.isArray(d)) return d
    for (const k of keys) if (d && Array.isArray(d[k])) return d[k]
    return []
  }

  // Effect 1: load all structural data in one parallel batch — runs once on mount
  useEffect(() => {
    const ctl = new AbortController()
    setRawDataLoading(true)
    ;(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
        const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const [rCust, rVeh, rEst, rJO, rUsers] = await Promise.allSettled([
          fetch('/api/customers', { signal: ctl.signal, headers: authHeaders }).then(r => r.ok ? r.json() : null),
          fetchVehicles(ctl.signal),
          fetch('/api/operations/estimates/summary', { signal: ctl.signal }).then(r => r.ok ? r.json() : null),
          fetch('/api/operations/joborders/summary', { signal: ctl.signal }).then(r => r.ok ? r.json() : null),
          getUsers()
        ])
        if (ctl.signal.aborted) return
        const vehData = rVeh.status === 'fulfilled' ? rVeh.value : null
        setRawCustomers(toArr(rCust.status === 'fulfilled' ? rCust.value : null, 'customers', 'items', 'data'))
        setRawVehicles(vehData?.vehicles ?? [])
        setRawEstimates(toArr(rEst.status === 'fulfilled' ? rEst.value : null, 'estimates', 'items'))
        setRawJobOrders(toArr(rJO.status === 'fulfilled' ? rJO.value : null, 'jobOrders', 'items'))
        const u = rUsers.status === 'fulfilled' ? rUsers.value : []
        setRawUsers(Array.isArray(u) ? u : [])
      } catch {
        // silent — states remain as empty arrays
      } finally {
        setRawDataLoading(false)
      }
    })()
    return () => ctl.abort()
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const permissionKeys = await getEffectivePermissions()
        if (!mounted) return
        setCanViewFinancialData(hasPermissionKey(permissionKeys, DASHBOARD_FINANCIAL_PERMISSION))
        setCanFilterDashboard(hasPermissionKey(permissionKeys, CAN_FILTER_DASHBOARD_PERMISSION_KEY))
      } catch {
        if (mounted) {
          setCanViewFinancialData(false)
          setCanFilterDashboard(false)
        }
      } finally {
        if (mounted) setFinancialPermissionResolved(true)
      }
    })()

    return () => { mounted = false }
  }, [])

  // Helpers for date-range filtering (used inside useMemos)
  const dateRangeStart = useMemo(() => {
    if (!dashboardDateRange?.start) return null
    const [y, m, d] = dashboardDateRange.start.split('-').map(Number)
    return (!isNaN(y) && !isNaN(m) && !isNaN(d)) ? new Date(y, m-1, d) : null
  }, [dashboardDateRange])
  const dateRangeEnd = useMemo(() => {
    if (!dashboardDateRange?.end) return null
    const [y, m, d] = dashboardDateRange.end.split('-').map(Number)
    return (!isNaN(y) && !isNaN(m) && !isNaN(d)) ? new Date(y, m-1, d) : null
  }, [dashboardDateRange])

  const inRange = (dateVal: any) => {
    const d = parseToLocalDate(dateVal)
    if (!d) return false
    if (dateRangeStart && dateRangeEnd) return d.getTime() >= dateRangeStart.getTime() && d.getTime() <= dateRangeEnd.getTime()
    return true
  }

  // KPI counts — derived from raw data + dateRange, zero additional API calls
  const customersCount = useMemo(() => {
    if (rawDataLoading) return null
    if (!dateRangeStart || !dateRangeEnd) return rawCustomers.length
    const hasAnyDates = rawCustomers.some(c => parseToLocalDate(c.createdDateTime ?? c.createdAt ?? c.created_at ?? c.createdOn ?? c.dateCreated ?? c.createdDate ?? c.created_on ?? c.created ?? c.registeredAt ?? null) !== null)
    if (!hasAnyDates) return rawCustomers.length
    return rawCustomers.filter(c => inRange(c.createdDateTime ?? c.createdAt ?? c.created_at ?? c.createdOn ?? c.dateCreated ?? c.createdDate ?? c.created_on ?? c.created ?? c.registeredAt ?? null)).length
  }, [rawCustomers, dateRangeStart, dateRangeEnd, rawDataLoading])

  const vehiclesCount = useMemo(() => {
    if (rawDataLoading) return null
    if (!dateRangeStart || !dateRangeEnd) return rawVehicles.length
    const hasAnyDates = rawVehicles.some(v => parseToLocalDate(v.createdDate ?? v.createdAt ?? v.created_at ?? v.dateCreated ?? null) !== null)
    if (!hasAnyDates) return rawVehicles.length
    return rawVehicles.filter(v => inRange(v.createdDate ?? v.createdAt ?? v.created_at ?? v.dateCreated ?? null)).length
  }, [rawVehicles, dateRangeStart, dateRangeEnd, rawDataLoading])

  const estimatesCount = useMemo(() => {
    if (rawDataLoading) return null
    if (!dateRangeStart || !dateRangeEnd) return rawEstimates.length
    const hasAnyDates = rawEstimates.some(it => parseToLocalDate(it.createdAt ?? it.created_at ?? it.createdOn ?? it.created_on ?? it.createdDate ?? it.dateCreated ?? it.registeredAt ?? it.date ?? null) !== null)
    if (!hasAnyDates) return rawEstimates.length
    return rawEstimates.filter(it => inRange(it.createdAt ?? it.created_at ?? it.createdOn ?? it.created_on ?? it.createdDate ?? it.dateCreated ?? it.registeredAt ?? it.date ?? null)).length
  }, [rawEstimates, dateRangeStart, dateRangeEnd, rawDataLoading])

  const jobOrdersCount = useMemo(() => {
    if (rawDataLoading) return null
    if (!dateRangeStart || !dateRangeEnd) return rawJobOrders.length
    const hasAnyDates = rawJobOrders.some(it => parseToLocalDate(it.createdAt ?? it.created_at ?? it.createdOn ?? it.created_on ?? it.createdDate ?? it.dateCreated ?? it.registeredAt ?? it.date ?? null) !== null)
    if (!hasAnyDates) return rawJobOrders.length
    return rawJobOrders.filter(it => inRange(it.createdAt ?? it.created_at ?? it.createdOn ?? it.created_on ?? it.createdDate ?? it.dateCreated ?? it.registeredAt ?? it.date ?? null)).length
  }, [rawJobOrders, dateRangeStart, dateRangeEnd, rawDataLoading])

  // Inactive customers — derived from raw job orders, no API calls
  const inactiveRows = useMemo(() => {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 6)
    const latestByCustomer = new Map<string, any>()
    const changeOilByCustomer = new Map<string, boolean>()
    const pmsByCustomer = new Map<string, boolean>()
    for (const it of rawJobOrders) {
      const customerObj = it.customerId ?? it.CustomerId ?? it.customer_id ?? it.customer ?? it.customerName ?? it.client ?? null
      const custId = (customerObj && typeof customerObj === 'object') ? (customerObj.id ?? customerObj.customerId ?? customerObj.customerCode ?? JSON.stringify(customerObj)) : (customerObj ?? '')
      const custKey = String(custId || (it.customerName ?? it.customer ?? ''))
      if (jobOrderHasChangeOilService(it)) changeOilByCustomer.set(custKey, true)
      if (jobOrderHasPmsServiceOrPackage(it)) pmsByCustomer.set(custKey, true)
      const dateVal = it.transactionDate ?? it.joDate ?? it.jo_date ?? it.transaction_date ?? it.jobDate ?? it.jobOrderDate ?? it.transactionDateTime ?? it.createdAt ?? it.date ?? null
      const d = dateVal ? new Date(dateVal) : null
      if (!d || isNaN(d.getTime())) continue
      const existing = latestByCustomer.get(custKey)
      if (!existing || d.getTime() > existing.date.getTime()) latestByCustomer.set(custKey, { item: it, date: d })
    }
    const rows: any[] = []
    for (const [custKey, v] of latestByCustomer.entries()) {
      if (v.date.getTime() < cutoff.getTime()) {
        const it = v.item
        rows.push({
          id: it.id ?? it.Id,
          customerId: getValue(it, 'customerId', 'CustomerId', 'customer_id') ?? (it.customer && typeof it.customer === 'object' ? getValue(it.customer, 'id', 'Id', 'customerId', 'CustomerId') : undefined),
          vehicleId: getValue(it, 'vehicleId', 'VehicleId', 'vehicle_id') ?? (it.vehicle && typeof it.vehicle === 'object' ? getValue(it.vehicle, 'id', 'Id', 'vehicleId', 'VehicleId') : undefined),
          clientType: (typeof it.isChangan !== 'undefined') ? (it.isChangan ? 'CHANGAN' : 'BOSCH') : (typeof it.is_changan !== 'undefined' ? (it.is_changan ? 'CHANGAN' : 'BOSCH') : (it.clientType ?? it.client ?? '')),
          joNumber: it.referenceNo ?? it.jobOrderNo ?? it.joNo ?? it.refNo ?? it.reference ?? '',
          joDate: it.transactionDate ?? it.joDate ?? it.jobOrderDate ?? it.transaction_date ?? it.date ?? '',
          customerName: (() => {
            const c = it.customer
            if (c && typeof c === 'object') {
              const first = c.firstName ?? c.first_name ?? c.firstname ?? c.givenName ?? c.givenname ?? c.first ?? ''
              const last = c.lastName ?? c.last_name ?? c.lastname ?? c.familyName ?? c.familyname ?? c.last ?? ''
              const full = [first, last].filter(Boolean).join(' ').trim()
              if (full) return full
              if (c.name) return c.name
              if (c.fullName) return c.fullName
            }
            if (it.firstName || it.lastName) return `${it.firstName ?? ''} ${it.lastName ?? ''}`.trim()
            if (it.customerName) return it.customerName
            if (typeof it.customer === 'string') return it.customer
            return ''
          })(),
          plateNo: (it.vehicle && (it.vehicle.plateNo ?? it.vehicle.plate_number ?? it.vehicle.plate)) ?? it.plateNo ?? it.plate_no ?? it.plate ?? '',
          vehicle: it.vehicle ?? it.vehicleName ?? it.model ?? '',
          jobOrderType: (typeof it.isPackage !== 'undefined') ? (it.isPackage ? 'PACKAGE' : 'REGULAR') : (it.jobOrderType ?? it.type ?? ''),
          status: it.status ?? it.statusName ?? (it.jobStatus && (it.jobStatus.name || it.jobStatus.status || it.jobStatus.Name)) ?? '',
          hasChangeOilService: changeOilByCustomer.get(custKey) === true,
          hasPmsServiceOrPackage: pmsByCustomer.get(custKey) === true
        })
      }
    }
    rows.sort((a, b) => {
      const da = a.joDate ? new Date(a.joDate).getTime() : 0
      const db = b.joDate ? new Date(b.joDate).getTime() : 0
      return db - da
    })
    return rows
  }, [rawJobOrders])

  const inactiveCounts = useMemo(() => {
    let bosch = 0, changan = 0, changeOil = 0, pms = 0
    for (const r of inactiveRows) {
      const ct = String(r.clientType || '').toUpperCase()
      if (ct === 'CHANGAN') changan++
      else bosch++
      if (r.hasChangeOilService) changeOil++
      if (r.hasPmsServiceOrPackage) pms++
    }
    return { all: inactiveRows.length, bosch, changan, changeOil, pms }
  }, [inactiveRows])

  // Ongoing jobs are non-terminal job orders, sorted oldest first so aged work surfaces first.
  const ongoingJobOrders = useMemo<OngoingJobOrderRow[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const rows = rawJobOrders.map((it: any) => {
      const status = getJobOrderStatusLabel(it)
      if (!isOngoingJobOrderStatus(status)) return null

      const rawDate = getValue(
        it,
        'transactionDate',
        'TransactionDate',
        'transactionDateTime',
        'TransactionDateTime',
        'joDate',
        'jobOrderDate',
        'createdDate',
        'CreatedDate',
        'createdDateTime',
        'CreatedDateTime',
        'date'
      )
      const parsedDate = parseToLocalDate(rawDate)
      const ageDays = parsedDate
        ? Math.max(0, Math.floor((today.getTime() - parsedDate.getTime()) / 86400000))
        : null

      const customerObject = getValue(it, 'customer', 'Customer')
      const customerName = getNameFromObject(customerObject)
        || String(getValue(it, 'customerName', 'CustomerName') ?? '')
        || `${getValue(it, 'firstName', 'FirstName') ?? ''} ${getValue(it, 'lastName', 'LastName') ?? ''}`.trim()

      const vehicleValue = getValue(it, 'vehicle', 'Vehicle', 'vehicleName', 'VehicleName', 'model', 'Model')
      const plateValue = getValue(it, 'plateNo', 'PlateNo', 'plateNumber', 'PlateNumber', 'plate', 'Plate')
      const id = getValue(it, 'id', 'Id') ?? ''
      const isPackage = getValue(it, 'isPackage', 'IsPackage', 'is_package')
      const isChangan = getValue(it, 'isChangan', 'IsChangan', 'is_changan')

      return {
        id,
        clientType: typeof isChangan !== 'undefined' ? (isChangan ? 'CHANGAN' : 'BOSCH') : String(getValue(it, 'clientType', 'ClientType', 'client', 'Client') ?? ''),
        referenceNo: String(getValue(it, 'referenceNo', 'ReferenceNo', 'jobOrderNo', 'JobOrderNo', 'joNo', 'refNo', 'reference') ?? ''),
        joDate: rawDate ? String(rawDate) : '',
        customerName,
        vehicle: toDisplayString(vehicleValue),
        plateNo: toDisplayString(plateValue || (vehicleValue && typeof vehicleValue === 'object' ? getValue(vehicleValue, 'plateNo', 'PlateNo', 'plateNumber', 'PlateNumber') : '')),
        jobOrderType: typeof isPackage !== 'undefined' ? (isPackage ? 'PACKAGE' : 'REGULAR') : String(getValue(it, 'jobOrderType', 'JobOrderType', 'type', 'Type') ?? ''),
        status,
        ageDays,
      }
    }).filter((row): row is OngoingJobOrderRow => row !== null)

    rows.sort((a, b) => {
      const ageDiff = (b.ageDays ?? -1) - (a.ageDays ?? -1)
      if (ageDiff !== 0) return ageDiff
      return String(a.referenceNo || a.id).localeCompare(String(b.referenceNo || b.id))
    })

    return rows
  }, [rawJobOrders])

  const agedOngoingCount = useMemo(() => ongoingJobOrders.filter(row => (row.ageDays ?? 0) >= 7).length, [ongoingJobOrders])
  const todayOngoingCount = useMemo(() => ongoingJobOrders.filter(row => row.ageDays === 0).length, [ongoingJobOrders])
  const oldestOngoingAge = ongoingJobOrders[0]?.ageDays ?? null
  const filteredOngoingJobOrders = useMemo(() => {
    if (effectiveOngoingFilter === 'AGED') return ongoingJobOrders.filter(row => (row.ageDays ?? 0) >= 7)
    if (effectiveOngoingFilter === 'TODAY') return ongoingJobOrders.filter(row => row.ageDays === 0)
    if (effectiveOngoingFilter === 'OLDEST') return ongoingJobOrders.filter(row => row.ageDays !== null && row.ageDays === oldestOngoingAge)
    return ongoingJobOrders
  }, [ongoingJobOrders, effectiveOngoingFilter, oldestOngoingAge])
  const ongoingPreview = useMemo(() => filteredOngoingJobOrders.slice(0, 6), [filteredOngoingJobOrders])

  // Transaction chart data — derived from raw arrays + selectedYear, no API calls
  const chartData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
    const keys = new Array(12).fill(0).map((_, i) => formatter.format(new Date(dashboardSelectedYear, i, 1)))
    const pickCreated = (it: any) => it.createdDateTime ?? it.createdDate ?? it.createdAt ?? it.created_on ?? it.created_at ?? it.createdOn ?? it.dateCreated ?? it.date_created ?? it.created_date ?? it.date ?? it.registeredAt ?? null

    const countByMonth = (items: any[], filterStatus?: string) => {
      const totals = new Map<string, number>()
      for (const it of items) {
        if (filterStatus) {
          const statuses: string[] = []
          const push = (v: any) => {
            if (!v) return
            if (typeof v === 'string') statuses.push(v)
            else if (typeof v === 'object') { if (v.name) statuses.push(String(v.name)); if (v.status) statuses.push(String(typeof v.status === 'object' ? v.status.name ?? '' : v.status)) }
          }
          push(it.status); push(it.statusName); push(it.jobStatus); push(it.estimateStatus)
          if (!statuses.some(s => s.toUpperCase() === filterStatus)) continue
        }
        const raw = pickCreated(it)
        if (!raw) continue
        const d = parseToLocalDate(raw) ?? new Date(raw)
        if (!d || isNaN(d.getTime()) || d.getFullYear() !== dashboardSelectedYear) continue
        const key = formatter.format(d)
        totals.set(key, (totals.get(key) || 0) + 1)
      }
      return totals
    }

    const cMap = countByMonth(rawCustomers)
    const vMap = countByMonth(rawVehicles)
    const eMap = countByMonth(rawEstimates)
    const jMap = countByMonth(rawJobOrders)
    return keys.map(k => ({ month: k, customers: cMap.get(k) || 0, vehicles: vMap.get(k) || 0, estimates: eMap.get(k) || 0, jobOrders: jMap.get(k) || 0 }))
  }, [rawCustomers, rawVehicles, rawEstimates, rawJobOrders, dashboardSelectedYear])

  // Birthday celebrant helpers
  const extractDob = (obj: any) => obj ? (obj.birthDate ?? obj.birth_date ?? obj.dob ?? obj.dateOfBirth ?? obj.date_of_birth ?? obj.birthday ?? obj.birthdayDate ?? obj.birthday_date ?? null) : null
  const extractNameParts = (obj: any) => ({
    first: String(obj?.firstName ?? obj?.first_name ?? obj?.firstname ?? obj?.givenName ?? obj?.given_name ?? obj?.fname ?? '').trim(),
    last: String(obj?.lastName ?? obj?.last_name ?? obj?.lastname ?? obj?.familyName ?? obj?.family_name ?? obj?.lname ?? '').trim()
  })
  const extractMobile = (obj: any) => !obj ? '' : String(obj.mobile ?? obj.mobileNumber ?? obj.mobile_number ?? obj.phone ?? obj.phoneNumber ?? obj.phone_number ?? obj.contact ?? obj.contactNumber ?? obj.contact_number ?? obj.msisdn ?? obj.telephone ?? obj.cell ?? obj.phone1 ?? obj.mobile_no ?? obj.mobileNo ?? '')

  const formatMonthDay = (dateStr: any) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d)
  }

  // Birthday data — derived from raw arrays, no API calls
  const { customersBDToday, customersBDUpcoming, usersBDToday, usersBDUpcoming } = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const todayDay = now.getDate()
    const build = (items: any[], idKey = 'id') => {
      const today: any[] = [], upcoming: any[] = []
      for (const it of items) {
        const dob = extractDob(it)
        if (!dob) continue
        const d = new Date(dob)
        if (isNaN(d.getTime()) || d.getMonth() !== currentMonth) continue
        const day = d.getDate()
        const parts = extractNameParts(it)
        const mobile = extractMobile(it)
        const fullname = [parts.first, parts.last].filter(Boolean).join(' ').trim() || (it.fullName ?? it.name ?? it.customerName ?? it.email ?? '')
        const item = { id: it.id ?? it[idKey] ?? it.uid ?? it.Id ?? JSON.stringify(it), first: parts.first, last: parts.last, mobile, name: fullname, dob }
        if (day === todayDay) today.push(item)
        else if (day > todayDay) upcoming.push(item)
      }
      upcoming.sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate())
      return { today, upcoming }
    }
    const cBD = build(rawCustomers, 'customerId')
    const uBD = build(rawUsers, 'userId')
    return { customersBDToday: cBD.today, customersBDUpcoming: cBD.upcoming, usersBDToday: uBD.today, usersBDUpcoming: uBD.upcoming }
  }, [rawCustomers, rawUsers])

  // Filtering and pagination for inactive customers table
  const filtered = useMemo(() => {
    try {
      const q = effectiveSearchTerm.trim().toLowerCase()
      return inactiveRows.filter((r: any) => {
        if (effectiveSelectedClientType !== 'ALL' && String(r.clientType || '').toUpperCase() !== effectiveSelectedClientType) return false
        if (effectiveInactiveServiceFilter === 'CHANGE_OIL' && !r.hasChangeOilService) return false
        if (effectiveInactiveServiceFilter === 'PMS' && !r.hasPmsServiceOrPackage) return false
        if (!q) return true
        return (
          String(r.clientType || '').toLowerCase().includes(q) ||
          String(r.customerName || '').toLowerCase().includes(q) ||
          String(r.vehicle || '').toLowerCase().includes(q) ||
          String(r.plateNo || '').toLowerCase().includes(q) ||
          String(r.joNumber || '').toLowerCase().includes(q)
        )
      })
    } catch { return [] }
  }, [inactiveRows, effectiveInactiveServiceFilter, effectiveSelectedClientType, effectiveSearchTerm])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => {
    try { const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) }
    catch { return [] }
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [pageCount])

  // Effect 2: financial data — payments, expenses, quicksales, invoices fetched once in parallel.
  // Computes both KPI totals AND monthly chart data from the same response payload.
  useEffect(() => {
    if (!financialPermissionResolved) return
    if (!canViewFinancialData) {
      setPaymentsLoading(false)
      setTotalSales(0)
      setQuickSales(0)
      setTotalDiscount(0)
      setExpensesTotal(0)
      setMonthlySales([])
      return
    }

    const ctl = new AbortController()
    setPaymentsLoading(true)
    ;(async () => {
      try {
        const [rPay, rExp, rQS, rInv] = await Promise.allSettled([
          fetch('/api/operations/payments', { signal: ctl.signal }).then(r => r.ok ? r.json() : null),
          fetch('/api/operations/expenses', { signal: ctl.signal }).then(r => r.ok ? r.json() : null),
          fetch('/api/operations/quicksales', { signal: ctl.signal }).then(r => r.ok ? r.json() : null),
          fetch('/api/operations/invoices', { signal: ctl.signal }).then(r => r.ok ? r.json() : null)
        ])
        if (ctl.signal.aborted) return

        const payments  = toArr(rPay.status === 'fulfilled' ? rPay.value : null, 'payments', 'items')
        const expenses  = toArr(rExp.status === 'fulfilled' ? rExp.value : null, 'expenses', 'items')
        const quicksales = toArr(rQS.status === 'fulfilled' ? rQS.value : null, 'quickSales', 'quicksales', 'items')
        const invoices  = toArr(rInv.status === 'fulfilled' ? rInv.value : null, 'invoices', 'items')

        const payDate = (it: any) => it.transactionDate ?? it.paymentDate ?? it.transaction_date ?? it.payment_date ?? it.date ?? it.transactionDateTime ?? it.createdAt ?? null
        const expDate = (it: any) => it.expenseDateTime ?? it.expense_date_time ?? it.expenseDate ?? it.expense_date ?? it.transactionDate ?? it.transaction_date ?? it.date ?? it.createdAt ?? null
        const qsDate  = (it: any) => it.transactionDate ?? it.transaction_date ?? it.transactionDateTime ?? it.transaction_date_time ?? it.date ?? it.createdAt ?? null
        const invDate = (it: any) => it.invoiceDate ?? it.invoice_date ?? it.invoiceDateTime ?? it.invoice_date_time ?? it.date ?? it.createdAt ?? null

        const withinFilter = (it: any, getDt: (x: any) => any) => {
          const d = parseToLocalDate(getDt(it))
          if (!d) return false
          if (dateRangeStart && dateRangeEnd) return d.getTime() >= dateRangeStart.getTime() && d.getTime() <= dateRangeEnd.getTime()
          return d.getFullYear() === dashboardSelectedYear
        }

        // KPI totals (single pass per dataset)
        let tSales = 0, tQuick = 0, tDiscount = 0, tExpenses = 0
        for (const it of payments) {
          if (!withinFilter(it, payDate)) continue
          tSales += Number(it.totalPaidAmount ?? it.total_paid_amount ?? it.totalPaid ?? it.total_paid ?? it.totalAmount ?? it.total ?? it.amount ?? it.paid ?? 0) || 0
        }
        for (const it of quicksales) {
          if (!withinFilter(it, qsDate)) continue
          tQuick += Number(it.totalAmount ?? it.total ?? it.amount ?? it.paid ?? 0) || 0
        }
        for (const it of invoices) {
          if (!withinFilter(it, invDate)) continue
          tDiscount += (Number(it.laborDiscount ?? it.labor_discount ?? it.laborDiscountAmount ?? it.labor_discount_amount ?? 0) || 0)
                     + (Number(it.productDiscount ?? it.product_discount ?? it.productDiscountAmount ?? it.product_discount_amount ?? 0) || 0)
                     + (Number(it.additionalDiscount ?? it.additional_discount ?? it.additionalDiscountAmount ?? it.additional_discount_amount ?? 0) || 0)
        }
        for (const it of expenses) {
          if (!withinFilter(it, expDate)) continue
          tExpenses += Number(it.amount ?? it.total ?? it.expenseAmount ?? it.expense_amount ?? 0) || 0
        }
        setTotalSales(tSales)
        setQuickSales(tQuick)
        setTotalDiscount(tDiscount)
        setExpensesTotal(tExpenses)

        // Monthly chart data (same datasets, different grouping)
        const year = dashboardSelectedYear
        const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

        if (!dashboardDateRange?.start || !dashboardDateRange?.end) {
          const months = new Array(12).fill(0).map((_, i) => ({ label: formatter.format(new Date(year, i, 1)), sales: 0, expenses: 0, quickSales: 0, discounts: 0 }))
          const addToMonth = (items: any[], getDt: (x: any) => any, field: 'sales' | 'expenses' | 'quickSales' | 'discounts', getAmt: (x: any) => number) => {
            for (const it of items) {
              const d = parseToLocalDate(getDt(it)) ?? new Date(getDt(it) ?? '')
              if (!d || isNaN(d.getTime()) || d.getFullYear() !== year) continue
              months[d.getMonth()][field] += getAmt(it)
            }
          }
          addToMonth(payments, payDate, 'sales', it => Number(it.totalAmount ?? it.total ?? it.amount ?? it.paid ?? it.totalPaidAmount ?? 0) || 0)
          addToMonth(expenses, expDate, 'expenses', it => Number(it.amount ?? 0) || 0)
          addToMonth(quicksales, qsDate, 'quickSales', it => Number(it.totalAmount ?? it.total ?? it.amount ?? it.paid ?? 0) || 0)
          addToMonth(invoices, invDate, 'discounts', it =>
            (Number(it.laborDiscount ?? it.labor_discount ?? it.laborDiscountAmount ?? it.labor_discount_amount ?? 0) || 0) +
            (Number(it.productDiscount ?? it.product_discount ?? it.productDiscountAmount ?? it.product_discount_amount ?? 0) || 0) +
            (Number(it.additionalDiscount ?? it.additional_discount ?? it.additionalDiscountAmount ?? it.additional_discount_amount ?? 0) || 0)
          )
          setMonthlySales(months.map(m => ({ month: m.label, sales: m.sales, expenses: m.expenses, quickSales: m.quickSales, discounts: m.discounts })))
        } else {
          const salesMap = new Map<string, number>(), expMap = new Map<string, number>(), qsMap = new Map<string, number>(), discMap = new Map<string, number>()
          const accum = (map: Map<string, number>, items: any[], getDt: (x: any) => any, getAmt: (x: any) => number) => {
            for (const it of items) {
              const d = parseToLocalDate(getDt(it)) ?? new Date(getDt(it) ?? '')
              if (!d || isNaN(d.getTime())) continue
              const key = formatter.format(d)
              map.set(key, (map.get(key) || 0) + getAmt(it))
            }
          }
          accum(salesMap, payments, payDate, it => Number(it.totalAmount ?? it.total ?? it.amount ?? it.paid ?? it.totalPaidAmount ?? 0) || 0)
          accum(expMap, expenses, expDate, it => Number(it.amount ?? 0) || 0)
          accum(qsMap, quicksales, qsDate, it => Number(it.totalAmount ?? it.total ?? it.amount ?? it.paid ?? 0) || 0)
          accum(discMap, invoices, invDate, it =>
            (Number(it.laborDiscount ?? it.labor_discount ?? it.laborDiscountAmount ?? it.labor_discount_amount ?? 0) || 0) +
            (Number(it.productDiscount ?? it.product_discount ?? it.productDiscountAmount ?? it.product_discount_amount ?? 0) || 0) +
            (Number(it.additionalDiscount ?? it.additional_discount ?? it.additionalDiscountAmount ?? it.additional_discount_amount ?? 0) || 0)
          )
          const keys = new Set([...salesMap.keys(), ...expMap.keys()])
          const result = Array.from(keys).map(month => ({ month, sales: salesMap.get(month) || 0, expenses: expMap.get(month) || 0, quickSales: qsMap.get(month) || 0, discounts: discMap.get(month) || 0 }))
          result.sort((a, b) => new Date('1 ' + a.month).getTime() - new Date('1 ' + b.month).getTime())
          setMonthlySales(result)
        }
      } catch {
        setTotalSales(0); setQuickSales(0); setTotalDiscount(0); setExpensesTotal(0); setMonthlySales([])
      } finally {
        setPaymentsLoading(false)
      }
    })()
    return () => ctl.abort()
  }, [canViewFinancialData, dashboardDateRange, dashboardSelectedYear, financialPermissionResolved])

  const customersDisplay = customersCount === null ? '—' : customersCount.toLocaleString()
  const vehiclesDisplay  = vehiclesCount  === null ? '—' : vehiclesCount.toLocaleString()
  const estimatesDisplay = estimatesCount === null ? '—' : estimatesCount.toLocaleString()
  const jobOrdersDisplay = jobOrdersCount === null ? '—' : jobOrdersCount.toLocaleString()

  const grossRevenue = totalSales + quickSales
  const netRevenue = grossRevenue - totalDiscount - expensesTotal
  const estimateConversion = estimatesCount && estimatesCount > 0 && jobOrdersCount !== null
    ? (jobOrdersCount / estimatesCount) * 100
    : null
  const averageRevenuePerJob = jobOrdersCount && jobOrdersCount > 0
    ? grossRevenue / jobOrdersCount
    : null
  const inactiveCustomerRate = rawCustomers.length > 0
    ? (inactiveRows.length / rawCustomers.length) * 100
    : null

  const formatPercent = (value: number | null) => value === null ? 'N/A' : `${value.toFixed(1)}%`

  const healthMetrics = [
    ...(canViewFinancialData ? [{
      label: 'Net Revenue',
      value: paymentsLoading ? '...' : `PHP ${currency(netRevenue)}`,
      detail: 'sales + quick sales - discounts - expenses',
      icon: <DollarSign size={16} />,
      tone: netRevenue >= 0
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200'
        : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200'
    }] : []),
    {
      label: 'Estimate Conversion',
      value: rawDataLoading ? '...' : formatPercent(estimateConversion),
      detail: 'job orders compared with estimates',
      icon: <Percent size={16} />,
      tone: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-200'
    },
    ...(canViewFinancialData ? [{
      label: 'Avg. Revenue / Job',
      value: paymentsLoading || rawDataLoading ? '...' : (averageRevenuePerJob === null ? 'N/A' : `PHP ${currency(averageRevenuePerJob)}`),
      detail: 'gross revenue across job orders',
      icon: <Activity size={16} />,
      tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200'
    }] : []),
    {
      label: 'Inactive Customer Risk',
      value: rawDataLoading ? '...' : formatPercent(inactiveCustomerRate),
      detail: `${inactiveRows.length.toLocaleString()} inactive customer${inactiveRows.length === 1 ? '' : 's'}`,
      icon: <Users size={16} />,
      tone: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200'
    }
  ]

  const navigate = useNavigate()

  const displayVal = (v: any) => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
    if (v instanceof Date) return v.toLocaleDateString()
    if (typeof v === 'object') {
      if (v.name) return String(v.name)
      if (v.model) return String(v.model)
      if (v.plateNo) return String(v.plateNo)
      if (v.vehicle) return String(v.vehicle)
      if (v.vehicleModel && (v.vehicleModel.name || v.vehicleModel.model)) return String(v.vehicleModel.name ?? v.vehicleModel.model)
      try { return JSON.stringify(v) } catch { return String(v) }
    }
    return String(v)
  }

  function JobOrderTypePill({ type }: { type?: string }) {
    const t = (type || '').toUpperCase()
    if (t === 'PACKAGE') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">PACKAGE</span>
    if (t === 'REGULAR') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600">REGULAR</span>
    return <span className="text-slate-400 text-xs">—</span>
  }

  const toggleOngoingFilter = (filter: OngoingJobFilter) => {
    if (!canFilterDashboard) return
    setOngoingFilter(current => current === filter ? 'ALL' : filter)
  }

  const ongoingFilterLabel = effectiveOngoingFilter === 'AGED'
    ? 'Aged 7+ days'
    : effectiveOngoingFilter === 'TODAY'
      ? 'Opened today'
      : effectiveOngoingFilter === 'OLDEST'
        ? 'Oldest active'
        : 'All ongoing'

  const ongoingTileClass = (filter: OngoingJobFilter, activeClass: string) =>
    `rounded border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 ${
      effectiveOngoingFilter === filter
        ? activeClass
        : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white dark:border-slate-700 dark:bg-slate-900/20 dark:hover:bg-slate-800'
    }`

  return (
    <div className="space-y-4">
      <ListPageHeader
        icon={Activity}
        title="Dashboard"
        subtitle="Current period overview"
      />

      <div className="rounded border border-border-DEFAULT dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-700">
          <div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{canFilterDashboard ? 'Actions / Filters' : 'Actions'}</div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{canFilterDashboard ? 'Choose the reporting period or create a new customer, vehicle, or inspection' : 'Create a new customer, vehicle, or inspection'}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          {canFilterDashboard && (
            <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-[minmax(260px,1fr)_120px_auto]">
              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Date Range</div>
                <DateRangePicker value={pendingDateRange ?? dateRange} onChange={setPendingDateRange} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Year</div>
                <select value={String(selectedYear)} onChange={(e)=>setSelectedYear(Number(e.target.value))} className="h-[42px] w-full rounded border bg-white px-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                  {Array.from({ length: 6 }).map((_,i)=>{
                    const y = currentYear - i
                    return <option key={y} value={y}>{y}</option>
                  })}
                </select>
              </div>
              <button
                type="button"
                onClick={()=>setDateRange(pendingDateRange)}
                className="h-[42px] self-end rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
              >Apply</button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <button type="button" onClick={()=>navigate('/customers/add')} className="inline-flex h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Users size={16} />
              <span>Add Customer</span>
            </button>
            <button type="button" onClick={()=>navigate('/vehicles/add')} className="inline-flex h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Truck size={16} />
              <span>Add Vehicle</span>
            </button>
            <button type="button" onClick={()=>navigate('/operations/inspection/add')} className="inline-flex h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <FileText size={16} />
              <span>New Inspection</span>
            </button>
          </div>
        </div>
      </div>

      <section aria-label="Dashboard overview">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          <StatCard title="Customers" value={customersDisplay} icon={<Users />} tone="fjord" variant="activity" loading={rawDataLoading} onClick={() => navigate('/customers')} />
          <StatCard title="Vehicles" value={vehiclesDisplay} icon={<Truck />} tone="lagoon" variant="activity" loading={rawDataLoading} onClick={() => navigate('/vehicles')} />
          <StatCard title="Estimates" value={estimatesDisplay} icon={<FileText />} tone="olive" variant="activity" loading={rawDataLoading} onClick={() => navigate('/operations/estimate')} />
          <StatCard title="Job Orders" value={jobOrdersDisplay} icon={<Wrench />} tone="copper" variant="activity" loading={rawDataLoading} onClick={() => navigate('/operations/job-order')} />

          {canViewFinancialData && (
            <>
              <StatCard title="Total Sales" value={currency(totalSales)} icon={<DollarSign />} tone="pine" variant="financial" loading={paymentsLoading} />
              <StatCard title="Quick Sales" value={currency(quickSales)} icon={<CreditCard />} tone="aqua" variant="financial" />
              <StatCard title="Total Discount" value={currency(totalDiscount)} icon={<Percent />} tone="gold" variant="financial" />
              <StatCard title="Expenses" value={currency(expensesTotal)} icon={<Activity />} tone="cranberry" variant="financial" loading={paymentsLoading} />
            </>
          )}
        </div>
      </section>

      {canViewFinancialData && (
        <>
          <div className="rounded border border-border-DEFAULT bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 border-b border-slate-100 pb-3 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Business Health</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Key performance signals based on the current filters</div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-700 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              {healthMetrics.map(metric => (
                <div key={metric.label} className="px-1 py-1 sm:px-3 sm:py-2">
                  <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                    <div className={`rounded-md p-2 ${metric.tone}`}>{metric.icon}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.label}</div>
                      <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-slate-100">{metric.value}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{metric.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded border border-border-DEFAULT dark:border-slate-700">
            <div className="flex items-center justify-between gap-2 bg-gray-100 px-4 py-2.5 dark:bg-slate-800">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Graphs &amp; Charts</div>
              <button onClick={()=>setMonthlyOpen(s=>!s)} className="flex-shrink-0 rounded p-1 text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700">{monthlyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
            </div>
            {monthlyOpen && (
              <div className="p-3">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                  <SalesChart data={monthlySales} />
                  <div className="card rounded-xl border border-border-DEFAULT p-3 shadow-card dark:border-slate-700 dark:shadow-none sm:p-4">
                    <div className="mb-3">
                      <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">Annual Transaction Report</div>
                      {canFilterDashboard && (
                        <div className="flex flex-wrap gap-x-1 gap-y-1">
                          <button type="button" onClick={()=>setChartVisible({ customers: true, vehicles: true, estimates: true, jobOrders: true })} className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                            <span style={{ width: 8, height: 8, background: '#94a3b8', display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
                            <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">All</span>
                          </button>
                          <button type="button" onClick={()=>setChartVisible(v=>({ ...v, customers: !v.customers }))} className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                            <span style={{ width: 8, height: 8, background: '#3b82f6', display: 'inline-block', borderRadius: 2, flexShrink: 0, opacity: chartVisible.customers ? 1 : 0.35 }} />
                            <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">Customers</span>
                          </button>
                          <button type="button" onClick={()=>setChartVisible(v=>({ ...v, vehicles: !v.vehicles }))} className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                            <span style={{ width: 8, height: 8, background: '#10b981', display: 'inline-block', borderRadius: 2, flexShrink: 0, opacity: chartVisible.vehicles ? 1 : 0.35 }} />
                            <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">Vehicles</span>
                          </button>
                          <button type="button" onClick={()=>setChartVisible(v=>({ ...v, estimates: !v.estimates }))} className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                            <span style={{ width: 8, height: 8, background: '#f59e0b', display: 'inline-block', borderRadius: 2, flexShrink: 0, opacity: chartVisible.estimates ? 1 : 0.35 }} />
                            <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">Estimates</span>
                          </button>
                          <button type="button" onClick={()=>setChartVisible(v=>({ ...v, jobOrders: !v.jobOrders }))} className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
                            <span style={{ width: 8, height: 8, background: '#ef4444', display: 'inline-block', borderRadius: 2, flexShrink: 0, opacity: chartVisible.jobOrders ? 1 : 0.35 }} />
                            <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">Job Orders</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} width={30} />
                          <ReTooltip formatter={(value:any) => (Number(value) || 0).toLocaleString()} />
                          {chartVisible.customers && <Line type="monotone" dataKey="customers" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Customers" />}
                          {chartVisible.vehicles && <Line type="monotone" dataKey="vehicles" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Vehicles" />}
                          {chartVisible.estimates && <Line type="monotone" dataKey="estimates" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Estimates" />}
                          {chartVisible.jobOrders && <Line type="monotone" dataKey="jobOrders" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Job Orders" />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="rounded border border-border-DEFAULT dark:border-slate-700 overflow-hidden">
        <div className="bg-gray-100 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Ongoing Job Orders</div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                {effectiveOngoingFilter === 'ALL'
                  ? ongoingJobOrders.length.toLocaleString()
                  : `${filteredOngoingJobOrders.length.toLocaleString()} / ${ongoingJobOrders.length.toLocaleString()}`}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Open and non-terminal jobs, oldest first - {ongoingFilterLabel}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/operations/job-order')}
              className="hidden items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700 sm:inline-flex"
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </button>
            <button onClick={()=>setOngoingOpen(s=>!s)} className="p-1 flex-shrink-0 rounded text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700">{ongoingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          </div>
        </div>
        {ongoingOpen && (
          <div className="bg-white p-3 dark:bg-slate-800">
            {canFilterDashboard && (
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  aria-pressed={effectiveOngoingFilter === 'TODAY'}
                  onClick={() => toggleOngoingFilter('TODAY')}
                  className={ongoingTileClass('TODAY', 'border-sky-200 bg-sky-50 ring-1 ring-sky-200 dark:border-sky-800 dark:bg-sky-900/20 dark:ring-sky-800')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Opened Today</div>
                    {effectiveOngoingFilter === 'TODAY' && <CheckCircle2 size={15} className="shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-sky-600 dark:text-sky-300">{todayOngoingCount.toLocaleString()}</div>
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveOngoingFilter === 'AGED'}
                  onClick={() => toggleOngoingFilter('AGED')}
                  className={ongoingTileClass('AGED', 'border-rose-200 bg-rose-50 ring-1 ring-rose-200 dark:border-rose-800 dark:bg-rose-900/20 dark:ring-rose-800')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Aged 7+ Days</div>
                    {effectiveOngoingFilter === 'AGED' && <CheckCircle2 size={15} className="shrink-0 text-rose-600 dark:text-rose-300" aria-hidden="true" />}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-rose-600 dark:text-rose-300">{agedOngoingCount.toLocaleString()}</div>
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveOngoingFilter === 'OLDEST'}
                  onClick={() => toggleOngoingFilter('OLDEST')}
                  className={ongoingTileClass('OLDEST', 'border-slate-300 bg-slate-100 ring-1 ring-slate-300 dark:border-slate-600 dark:bg-slate-700/60 dark:ring-slate-600')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Oldest Active</div>
                    {effectiveOngoingFilter === 'OLDEST' && <CheckCircle2 size={15} className="shrink-0 text-slate-700 dark:text-slate-100" aria-hidden="true" />}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100">{formatAgeLabel(oldestOngoingAge)}</div>
                </button>
              </div>
            )}

            {ongoingPreview.length === 0 ? (
              <EmptyState title={rawDataLoading ? 'Loading ongoing job orders' : 'No ongoing job orders'} hint={rawDataLoading ? 'Please wait while dashboard data is loaded' : effectiveOngoingFilter === 'ALL' ? 'Completed, paid, cancelled, and closed jobs are hidden here' : 'Click the selected summary tile again to show all ongoing jobs'} />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {ongoingPreview.map(row => {
                  const ageTone = row.ageDays !== null && row.ageDays >= 7
                    ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:ring-rose-800'
                    : row.ageDays !== null && row.ageDays >= 3
                      ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800'
                      : 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-800'
                  const key = row.id || row.referenceNo || `${row.customerName}-${row.joDate}`
                  const canOpen = row.id !== ''

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!canOpen}
                      onClick={() => canOpen && navigate(`/operations/job-order/${row.id}`)}
                      className="min-w-0 rounded border border-slate-200 bg-white p-3 text-left transition hover:border-sky-200 hover:bg-sky-50/40 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-800 dark:hover:bg-sky-900/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">#{row.referenceNo || row.id}</div>
                          <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayVal(row.customerName) || 'Unnamed customer'}</div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${ageTone}`}>
                          <Clock3 size={11} />
                          {formatAgeLabel(row.ageDays)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={row.status} />
                        <JobOrderTypePill type={row.jobOrderType} />
                        {showClientType && row.clientType && <ClientTypeBadge type={row.clientType} />}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                        <div className="min-w-0 truncate">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Vehicle:</span> {displayVal(row.vehicle) || '-'}
                        </div>
                        <div className="min-w-0 truncate sm:text-right">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Plate:</span> <span className="uppercase">{displayVal(row.plateNo) || '-'}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">Opened {row.joDate ? formatShortDate(row.joDate) : '-'}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {filteredOngoingJobOrders.length > ongoingPreview.length && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/operations/job-order')}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-900/20"
                >
                  <span>View {filteredOngoingJobOrders.length - ongoingPreview.length} more</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded border border-border-DEFAULT dark:border-slate-700 overflow-hidden">
        <div className="bg-gray-100 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Inactive Customers</div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{filteredTotal.toLocaleString()}</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">No job orders in the last 6 months</div>
          </div>
          <button onClick={()=>setInactiveOpen(s=>!s)} className="p-1 flex-shrink-0 rounded text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700">{inactiveOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        </div>
        {inactiveOpen && (
          <div className="bg-white dark:bg-slate-800">
            {canFilterDashboard && (
              <ListToolbar
                left={
                  <div className="flex flex-wrap items-center gap-2">
                    {showClientType && (
                      <ClientTypeFilter
                        value={selectedClientType}
                        onChange={(type)=>{ setSelectedClientType(type as any); setPage(0) }}
                        options={[
                          { key: 'ALL', label: 'All', count: inactiveCounts.all },
                          { key: 'BOSCH', label: 'BOSCH', count: inactiveCounts.bosch, activeClass: 'bg-amber-500 text-white' },
                          { key: 'CHANGAN', label: 'CHANGAN', count: inactiveCounts.changan, activeClass: 'bg-sky-500 text-white' },
                        ]}
                      />
                    )}
                    <ClientTypeFilter<InactiveServiceFilter>
                      label="Service"
                      value={inactiveServiceFilter}
                      onChange={(filter)=>{ setInactiveServiceFilter(filter); setPage(0) }}
                      options={[
                        { key: 'ALL', label: 'All', count: inactiveCounts.all },
                        { key: 'CHANGE_OIL', label: 'Change Oil', count: inactiveCounts.changeOil, activeClass: 'bg-emerald-500 text-white' },
                        { key: 'PMS', label: 'PMS', count: inactiveCounts.pms, activeClass: 'bg-indigo-500 text-white' },
                      ]}
                    />
                  </div>
                }
                right={
                  <ListSearchInput
                    value={searchTerm}
                    onChange={(value)=>{ setSearchTerm(value); setPage(0) }}
                    placeholder="Search JO, customer, vehicle..."
                  />
                }
              />
            )}

            <div className="overflow-x-auto w-full">
              <table className="min-w-full w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-5 py-3 w-16">ID</th>
                    {showClientType && <th className="px-5 py-3">Client Type</th>}
                    <th className="px-5 py-3">JO #</th>
                    <th className="px-5 py-3">JO Date</th>
                    <th className="px-5 py-3">Customer Name</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Plate No.</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <EmptyState colSpan={showClientType ? 10 : 9} title="No inactive customers found" hint={showClientType ? 'Try changing the client type, service filter, or search term' : 'Try changing the service filter or search term'} />
                  )}
                  {paged.map((r:any)=> (
                    <tr key={r.id ?? `${r.customerName}-${r.joNumber}`} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{displayVal(r.id)}</td>
                      {showClientType && <td className="px-5 py-4 align-middle"><ClientTypeBadge type={r.clientType} /></td>}
                      <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {r.id ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/operations/job-order/${r.id}`)}
                            className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            {displayVal(r.joNumber)}
                          </button>
                        ) : displayVal(r.joNumber)}
                      </td>
                      <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatShortDate(r.joDate)}</td>
                      <td className="px-5 py-4 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {r.customerId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/customer/${r.customerId}`)}
                            className="font-semibold text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            {displayVal(r.customerName)}
                          </button>
                        ) : displayVal(r.customerName)}
                      </td>
                      <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">
                        {r.vehicleId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/vehicles/${r.vehicleId}`)}
                            className="text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            {displayVal(r.vehicle)}
                          </button>
                        ) : displayVal(r.vehicle)}
                      </td>
                      <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 uppercase">{displayVal(r.plateNo)}</td>
                      <td className="px-5 py-4 align-middle"><JobOrderTypePill type={r.jobOrderType} /></td>
                      <td className="px-5 py-4 align-middle"><StatusBadge status={r.status} /></td>
                      <td className="px-5 py-4 align-middle text-right">
                        <RowActions actions={[
                          { kind: 'edit', onClick: ()=>navigate(`/operations/job-order/${r.id}`), label: `edit-${r.id}` },
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
              onRowsPerPageChange={(n)=>{ setRowsPerPage(n); setPage(0) }}
            />

          </div>
        )}
      </div>

      <div className="rounded border border-border-DEFAULT dark:border-slate-700 overflow-hidden">
        <div className="bg-gray-100 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Birthday Celebrants</div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {(customersBDToday.length + customersBDUpcoming.length + usersBDToday.length + usersBDUpcoming.length).toLocaleString()}
            </span>
          </div>
          <button onClick={()=>setBirthdayOpen(s=>!s)} className="p-1 flex-shrink-0 rounded text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700">{birthdayOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        </div>
        {birthdayOpen && (
          <div className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              {/* Customers */}
              <div className="border rounded p-3">
                <div className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">Customers</div>
                {customersBDToday.length === 0 && customersBDUpcoming.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No upcoming birthdays this month</div>
                ) : (
                  <div className="space-y-3">
                    {customersBDToday.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Today</div>
                        <div className="rounded overflow-hidden border border-slate-100 dark:border-slate-700">
                          {customersBDToday.map((c, idx) => (
                            <div key={c.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {(c.first || c.last) ? `${c.first} ${c.last}`.trim() : c.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {c.mobile ? formatPHMobile(c.mobile).replace(/-/g,' ') : '—'}
                                </div>
                              </div>
                              <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-bosch-blue text-white text-xs font-semibold whitespace-nowrap">
                                {formatMonthDay(c.dob)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {customersBDUpcoming.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Upcoming</div>
                        <div className="rounded overflow-hidden border border-slate-100 dark:border-slate-700">
                          {customersBDUpcoming.map((c, idx) => (
                            <div key={c.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {(c.first || c.last) ? `${c.first} ${c.last}`.trim() : c.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {c.mobile ? formatPHMobile(c.mobile).replace(/-/g,' ') : '—'}
                                </div>
                              </div>
                              <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold whitespace-nowrap">
                                {formatMonthDay(c.dob)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Users */}
              <div className="border rounded p-3">
                <div className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">Users</div>
                {usersBDToday.length === 0 && usersBDUpcoming.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No upcoming birthdays this month</div>
                ) : (
                  <div className="space-y-3">
                    {usersBDToday.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Today</div>
                        <div className="rounded overflow-hidden border border-slate-100 dark:border-slate-700">
                          {usersBDToday.map((u, idx) => (
                            <div key={u.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {(u.first || u.last) ? `${u.first} ${u.last}`.trim() : u.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {u.mobile ? formatPHMobile(u.mobile).replace(/-/g,' ') : '—'}
                                </div>
                              </div>
                              <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold whitespace-nowrap">
                                {formatMonthDay(u.dob)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {usersBDUpcoming.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Upcoming</div>
                        <div className="rounded overflow-hidden border border-slate-100 dark:border-slate-700">
                          {usersBDUpcoming.map((u, idx) => (
                            <div key={u.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {(u.first || u.last) ? `${u.first} ${u.last}`.trim() : u.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {u.mobile ? formatPHMobile(u.mobile).replace(/-/g,' ') : '—'}
                                </div>
                              </div>
                              <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold whitespace-nowrap">
                                {formatMonthDay(u.dob)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
