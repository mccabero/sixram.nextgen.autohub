// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Vehicle } from '../components/tables/VehicleListTable'
import { useAuth } from '../auth/useAuth'
import { useToast } from '../contexts/toast'
import { createVehicle, updateVehicle, fetchVehicleById } from '../services/vehicleService'
import { fetchCustomerById } from '../services/customerService'
import { Hash, Truck, Calendar, Key, Wrench, Layers, Settings, Cpu, Activity, Gauge, Building, Search } from 'lucide-react'
import VehicleInspectionTable from '../components/tables/VehicleInspectionTable'
import VehicleJobOrderTable from '../components/tables/VehicleJobOrderTable'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'

const TABS = ['General Information', 'Inspections', 'Service History']

type ParamOption = { id: number; name: string }
type SearchableSelectOption = { value: string; label: string; subtitle?: string }

function SearchableSelect({ options, value, displayValue, onChange, onSearch, onOpen, disabled, placeholder, loading, noResultsText }: {
  options: SearchableSelectOption[]
  value: string
  displayValue?: string
  onChange: (val: string) => void
  onSearch?: (val: string) => void
  onOpen?: () => void
  disabled?: boolean
  placeholder?: string
  loading?: boolean
  noResultsText?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  const filteredOptions = onSearch
    ? options
    : query.trim()
      ? options.filter(o =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          String(o.subtitle ?? '').toLowerCase().includes(query.toLowerCase())
        )
      : options

  return (
    <div className="flex-1 relative">
      <input
        type="text"
        value={open ? query : (selected?.label ?? displayValue ?? query)}
        onChange={e => {
          const next = e.target.value
          setQuery(next)
          onSearch?.(next)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery(onSearch ? (selected?.label ?? displayValue ?? query) : '')
          onOpen?.()
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm disabled:text-slate-400"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded shadow z-50 max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 && !loading ? (
            <div className="px-3 py-2 text-sm text-slate-500">{noResultsText ?? 'No results found'}</div>
          ) : filteredOptions.map(o => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setQuery(''); setOpen(false) }}
              className={`px-3 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-0 ${o.value === value ? 'bg-blue-50' : ''}`}
            >
              <div className="text-sm text-slate-800 font-medium">{o.label}</div>
              {o.subtitle && <div className="text-xs text-slate-400 mt-0.5">{o.subtitle}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type VehicleForm = Partial<Vehicle> & {
  make?: string
  vehicleModelId?: number
  yearModel?: number | string
  vin?: string
  engineNo?: string
  chasisNo?: string
  transmissionParameterId?: number
  engineTypeParameterId?: number
  engineSizeParameterId?: number
  odometerParameterId?: number
  customerRegistrationTypeParameterId?: number
  customerSearch?: string
  isChangan?: boolean
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

export default function ManageVehicle(){
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = params.id
  const isAdd = id === 'add' || !id
  const selectedCustomerId = searchParams.get('customerId')

  const { showToast } = useToast()
  const { user: authUser } = useAuth()
  const visibleTabs = isAdd ? [TABS[0]] : TABS
  const showIsChanganOption = useShowIsChanganOption()

  const [form, setForm] = useState<VehicleForm>({ plate: '', model: '', customerName: '', mobile: '', clientType: 'BOSCH', isChangan: false })
  const [active, setActive] = useState<number>(0)
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; mobile: string }[]>([])
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const allCustomersCache = useRef<{ id: string; name: string; mobile: string }[] | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [vehicleModelResults, setVehicleModelResults] = useState<{ id: number; name: string }[]>([])
  const [showModelDrop, setShowModelDrop] = useState(false)
  const [modelSearchLoading, setModelSearchLoading] = useState(false)
  const allModelsCache = useRef<{ id: number; name: string }[] | null>(null)
  const modelDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [transmissionOptions, setTransmissionOptions] = useState<ParamOption[]>([])
  const [engineTypeOptions, setEngineTypeOptions] = useState<ParamOption[]>([])
  const [engineSizeOptions, setEngineSizeOptions] = useState<ParamOption[]>([])
  const [odometerOptions, setOdometerOptions] = useState<ParamOption[]>([])
  const [registrationTypeOptions, setRegistrationTypeOptions] = useState<ParamOption[]>([])
  const transmissionSelectOptions = transmissionOptions.map(o => ({ value: String(o.id), label: o.name }))
  const engineTypeSelectOptions = engineTypeOptions.map(o => ({ value: String(o.id), label: o.name }))
  const engineSizeSelectOptions = engineSizeOptions.map(o => ({ value: String(o.id), label: o.name }))
  const odometerSelectOptions = odometerOptions.map(o => ({ value: String(o.id), label: o.name }))
  const registrationTypeSelectOptions = registrationTypeOptions.map(o => ({ value: String(o.id), label: o.name }))

  function toId(v: any): number | undefined {
    if (v == null) return undefined
    if (typeof v === 'number') return v
    const n = Number(v)
    return Number.isNaN(n) ? undefined : n
  }

  useEffect(()=>{
    if (isAdd) return
    const ctl = new AbortController()
    fetchVehicleById(id!, ctl.signal)
      .then((d: any) => {
        const src = d?.data ?? d?.vehicle ?? d
        const isChangan = src?.isChangan === true || src?.is_changan === true || Number(src?.isChangan) === 1 || Number(src?.is_changan) === 1 || String(src?.clientType ?? '').toUpperCase() === 'CHANGAN'
        const extractName = (x: any): string => {
          if (!x) return ''
          const first = x?.firstName ?? x?.given_name ?? x?.givenName ?? ''
          const last = x?.lastName ?? x?.family_name ?? x?.familyName ?? ''
          if (first || last) return `${first} ${last}`.trim()
          return x?.name ?? ''
        }
        const customerName = extractName(src?.owner) || extractName(src?.customer) || src?.ownerName || src?.customerName || ''
        const mobile = src?.mobileNumber ?? src?.customer?.mobileNumber ?? src?.customer?.mobile ?? src?.owner?.mobileNumber ?? src?.owner?.mobile ?? src?.mobile ?? src?.phone ?? ''
        setForm(f => ({
          ...f,
          plate: src?.plateNo ?? src?.plateNumber ?? src?.plate ?? src?.reg_no ?? '',
          model: src?.vehicleModel?.name ?? src?.modelName ?? src?.model ?? '',
          vehicleModelId: src?.vehicleModel?.id ?? src?.vehicleModelId ?? src?.vehicle_model_id ?? src?.VehicleModelId ?? undefined,
          make: src?.vehicleMake?.name ?? src?.makeName ?? src?.make ?? '',
          yearModel: src?.yearModel ?? src?.year ?? src?.modelYear ?? '',
          vin: src?.vin ?? src?.VIN ?? src?.vinNumber ?? src?.chassisVin ?? '',
          engineNo: src?.engineNo ?? src?.engineNumber ?? src?.engine_number ?? src?.engine_no ?? src?.EngineNo ?? '',
          chasisNo: src?.chasisNo ?? src?.chasis_number ?? src?.chasis ?? src?.chassis ?? src?.chassis_number ?? src?.ChasisNo ?? '',
          transmissionType: src?.transmissionType ?? src?.transmission ?? src?.transmission_type ?? '',
          transmissionParameterId: toId(src?.transmissionParameterId ?? src?.transmission_parameter_id ?? src?.transmissionId ?? src?.transmission?.id ?? src?.transmission?.parameterId ?? src?.transmission?.parameter_id ?? src?.transmissionTypeParameterId ?? src?.TransmissionParameterId ?? src?.transmission_type_parameter_id),
          engineType: src?.engineType ?? src?.engine_type ?? src?.fuelType ?? src?.fuel_type ?? '',
          engineTypeParameterId: toId(src?.engineTypeParameterId ?? src?.engine_type_parameter_id ?? src?.engineTypeId ?? src?.engineType?.id ?? src?.EngineTypeParameterId ?? src?.engine_type_id),
          engineSize: src?.engineSize ?? src?.engine_size ?? src?.displacement ?? '',
          engineSizeParameterId: toId(src?.engineSizeParameterId ?? src?.engine_size_parameter_id ?? src?.engineSizeId ?? src?.engineSize?.id ?? src?.EngineSizeParameterId ?? src?.engine_size_id),
          odometerType: src?.odometerType ?? src?.odometer_type ?? src?.odometer ?? '',
          odometerParameterId: toId(src?.odometerParameterId ?? src?.odometer_parameter_id ?? src?.odometerId ?? src?.odometer?.id ?? src?.OdometerParameterId ?? src?.odometer_type_parameter_id ?? src?.odometer_type_id),
          customerRegistrationType: src?.customerRegistrationType ?? src?.registrationType ?? src?.registration_type ?? '',
          customerRegistrationTypeParameterId: toId(src?.customerRegistrationTypeParameterId ?? src?.customer_registration_type_parameter_id ?? src?.registrationTypeParameterId ?? src?.registration_type_parameter_id ?? src?.registrationTypeId ?? src?.registrationType?.id ?? src?.CustomerRegistrationTypeParameterId),
          clientType: isChangan ? 'CHANGAN' : 'BOSCH',
          isChangan,
          customerName,
          mobile,
          customerSearch: customerName,
          customerId: src?.customer?.id ?? src?.owner?.id ?? src?.customerId ?? src?.customer_id ?? undefined,
        }))
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') showToast('Failed to load vehicle: ' + (e?.message ?? 'Unknown'), 'error')
      })
    return () => ctl.abort()
  }, [id])

  useEffect(() => {
    if (!isAdd || !selectedCustomerId || form.customerId) return

    const ctl = new AbortController()
    fetchCustomerById(selectedCustomerId, ctl.signal)
      .then((data: any) => {
        const src = data?.data ?? data?.customer ?? data
        const first = String(src?.firstName ?? src?.first_name ?? src?.givenName ?? src?.given_name ?? '')
        const last = String(src?.lastName ?? src?.last_name ?? src?.familyName ?? src?.family_name ?? '')
        const customerName = `${first} ${last}`.trim() || String(src?.name ?? src?.customerName ?? '')
        const mobile = String(src?.mobile ?? src?.mobileNumber ?? src?.phone ?? src?.contactNumber ?? '')
        const isChangan = (
          src?.isChangan === true ||
          src?.is_changan === true ||
          Number(src?.isChangan) === 1 ||
          Number(src?.is_changan) === 1 ||
          String(src?.clientType ?? '').toUpperCase() === 'CHANGAN'
        )

        setForm(f => ({
          ...f,
          customerId: src?.id ?? src?.customerId ?? src?.customer_id ?? selectedCustomerId,
          customerName,
          customerSearch: customerName,
          mobile,
          clientType: isChangan ? 'CHANGAN' : 'BOSCH',
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

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    fetch('/api/config/parameters', { headers })
      .then(r => r.json())
      .then((data: any[]) => {
        const group = (keyword: string) =>
          data.filter((p: any) => String(p?.parameterGroup?.name ?? p?.parameterGroup?.code ?? '').toLowerCase().includes(keyword))
               .map((p: any) => ({ id: Number(p.id), name: String(p.name) }))
        setTransmissionOptions(group('transmission'))
        setEngineTypeOptions(group('engine type'))
        setEngineSizeOptions(group('engine size'))
        setOdometerOptions(group('odometer'))
        setRegistrationTypeOptions(group('registration'))
      })
      .catch(() => {})
  }, [])

  function updateField<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]){ setForm(f=> ({ ...f, [key]: value })); setErrors(e => ({ ...e, [String(key)]: '' })) }

  function validate(){
    const e: Record<string,string> = {}
    if (!form.customerId) e.customerId = 'Required'
    if (!form.plate || !String(form.plate).trim()) e.plate = 'Required'
    if (!form.model || !String(form.model).trim()) e.model = 'Required'
    if (!form.yearModel || String(form.yearModel).trim() === '') e.yearModel = 'Required'
    if (!form.transmissionParameterId) e.transmissionParameterId = 'Required'
    if (!form.engineTypeParameterId) e.engineTypeParameterId = 'Required'
    if (!form.engineSizeParameterId) e.engineSizeParameterId = 'Required'
    if (!form.odometerParameterId) e.odometerParameterId = 'Required'
    if (!form.customerRegistrationTypeParameterId) e.customerRegistrationTypeParameterId = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function filterCustomers(q: string, all: { id: string; name: string; mobile: string }[]) {
    const lq = q.toLowerCase()
    return all.filter(c => c.name.toLowerCase().includes(lq) || c.mobile.toLowerCase().includes(lq)).slice(0, 10)
  }

  async function loadAndCacheCustomers(): Promise<{ id: string; name: string; mobile: string }[]> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/customers', { headers })
    if (!res.ok) throw new Error('Failed to load customers')
    const data = await res.json()
    let items: any[] = []
    if (Array.isArray(data)) items = data
    else if (Array.isArray(data.customers)) items = data.customers
    else if (Array.isArray(data.items)) items = data.items
    const mapped = items.map((c: any) => {
      const first = String(c.firstName ?? c.first_name ?? c.firstname ?? '')
      const last = String(c.lastName ?? c.last_name ?? c.lastname ?? '')
      return { id: String(c.id ?? c.customerId ?? ''), name: `${first} ${last}`.trim(), mobile: String(c.mobile ?? c.mobileNumber ?? c.phone ?? '') }
    })
    allCustomersCache.current = mapped
    return mapped
  }

  async function openCustomerDropdown() {
    setShowCustomerDrop(true)
    setSearchLoading(true)
    try {
      const all = allCustomersCache.current ?? await loadAndCacheCustomers()
      const q = String(form.customerSearch ?? '').trim()
      setCustomerResults(q ? filterCustomers(q, all) : all.slice(0, 10))
    } catch {
      showToast('Customer search failed', 'error')
    } finally {
      setSearchLoading(false)
    }
  }

  function handleCustomerSearch(value: string) {
    updateField('customerSearch', value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (!value.trim()) { setShowCustomerDrop(false); setCustomerResults([]); return }
    if (allCustomersCache.current) {
      setCustomerResults(filterCustomers(value, allCustomersCache.current))
      setShowCustomerDrop(true)
      return
    }
    setSearchLoading(true)
    debounceTimer.current = setTimeout(async () => {
      try {
        const all = await loadAndCacheCustomers()
        setCustomerResults(filterCustomers(value, all))
        setShowCustomerDrop(true)
      } catch {
        showToast('Customer search failed', 'error')
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  async function loadAndCacheModels(): Promise<{ id: number; name: string }[]> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/config/vehicle-models', { headers })
    if (!res.ok) throw new Error('Failed to load vehicle models')
    const data = await res.json()
    const items: any[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? [])
    const mapped = items
      .map((m: any) => ({ id: Number(m?.id ?? m?.vehicleModelId ?? 0), name: String(m?.name ?? m?.modelName ?? m?.vehicleModel ?? '') }))
      .filter(m => m.name)
    allModelsCache.current = mapped
    return mapped
  }

  function handleModelSearch(value: string) {
    updateField('model', value)
    updateField('vehicleModelId', undefined)
    if (modelDebounceTimer.current) clearTimeout(modelDebounceTimer.current)
    if (!value.trim()) { setShowModelDrop(false); setVehicleModelResults([]); return }
    if (allModelsCache.current) {
      const lq = value.toLowerCase()
      setVehicleModelResults(allModelsCache.current.filter(m => m.name.toLowerCase().includes(lq)).slice(0, 10))
      setShowModelDrop(true)
      return
    }
    setModelSearchLoading(true)
    modelDebounceTimer.current = setTimeout(async () => {
      try {
        const all = await loadAndCacheModels()
        const lq = value.toLowerCase()
        setVehicleModelResults(all.filter(m => m.name.toLowerCase().includes(lq)).slice(0, 10))
        setShowModelDrop(true)
      } catch {
        showToast('Vehicle model search failed', 'error')
      } finally {
        setModelSearchLoading(false)
      }
    }, 300)
  }

  async function openModelDropdown() {
    setShowModelDrop(true)
    setModelSearchLoading(true)
    try {
      const all = allModelsCache.current ?? await loadAndCacheModels()
      const q = String(form.model ?? '').trim().toLowerCase()
      setVehicleModelResults(q ? all.filter(m => m.name.toLowerCase().includes(q)).slice(0, 10) : all.slice(0, 10))
    } catch {
      showToast('Vehicle model search failed', 'error')
    } finally {
      setModelSearchLoading(false)
    }
  }

  function selectModel(m: { id: number; name: string }) {
    updateField('model', m.name)
    updateField('vehicleModelId', m.id)
    setShowModelDrop(false)
    setVehicleModelResults([])
  }

  function selectCustomer(c: { id: string; name: string; mobile: string }) {
    updateField('customerId', c.id)
    updateField('customerName', c.name)
    updateField('mobile', c.mobile)
    updateField('customerSearch', c.name)
    setShowCustomerDrop(false)
  }

  async function handleSave() {
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    setSaving(true)
    try {
      const dto: Record<string, any> = {
        customerId: form.customerId ? Number(form.customerId) : 0,
        isChangan: !!form.isChangan,
        plateNumber: form.plate ?? '',
        vehicleModelId: form.vehicleModelId ? Number(form.vehicleModelId) : 0,
        model: form.model ?? null,
        vin: form.vin ?? null,
        year: form.yearModel ? Number(form.yearModel) : null,
        engineNo: form.engineNo ?? null,
        chasisNo: form.chasisNo ?? null,
        transmissionParameterId: form.transmissionParameterId ? Number(form.transmissionParameterId) : 0,
        odometerParameterId: form.odometerParameterId ? Number(form.odometerParameterId) : 0,
        customerRegistrationTypeParameterId: form.customerRegistrationTypeParameterId ? Number(form.customerRegistrationTypeParameterId) : 0,
        engineSizeParameterId: form.engineSizeParameterId ? Number(form.engineSizeParameterId) : 0,
        engineTypeParameterId: form.engineTypeParameterId ? Number(form.engineTypeParameterId) : 0,
      }

      const resolvedUpdatedById = Number(
        authUser?.id ?? authUser?.userId ?? authUser?.Id ?? authUser?.createdById ?? authUser?.sub ?? 0
      )

      const payload = {
        ...dto,
        VehicleModelId: dto.vehicleModelId ?? 0,
        VIN: dto.vin ?? null,
        EngineNo: dto.engineNo ?? null,
        ChasisNo: dto.chasisNo ?? null,
        TransmissionParameterId: dto.transmissionParameterId ?? 0,
        OdometerParameterId: dto.odometerParameterId ?? 0,
        CustomerRegistrationTypeParameterId: dto.customerRegistrationTypeParameterId ?? 0,
        EngineSizeParameterId: dto.engineSizeParameterId ?? 0,
        EngineTypeParameterId: dto.engineTypeParameterId ?? 0,
        IsChangan: dto.isChangan ?? false,
        updatedById: Number.isFinite(resolvedUpdatedById) ? resolvedUpdatedById : 0,
      }

      if (isAdd) {
        await createVehicle(payload)
        showToast('Vehicle added', 'success')
      } else {
        await updateVehicle(id!, payload)
        showToast('Vehicle updated', 'success')
      }
      navigate('/vehicles')
    } catch (e: any) {
      showToast('Save failed: ' + (e?.message || 'Unknown error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Vehicle' : 'Manage Vehicle'}</h2>
        {!isAdd && form.customerName && <div className="text-sm text-slate-500">{form.customerName}</div>}
      </div>

      <div className="mt-4">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px space-x-2">
            {visibleTabs.map((t, idx) => (
              <button key={t} onClick={() => setActive(idx)} className={`px-4 py-2 ${active === idx ? 'border-b-2 border-bosch-blue text-bosch-blue' : 'text-slate-600 hover:text-bosch-blue'}`}>{t}</button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {active === 0 && (
            <div className="flex flex-col gap-4">

              {/* Customer Information */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-visible">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Customer Information</div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Search Customer <span className="text-rose-600">*</span></label>
                      <div className="relative">
                        <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.customerId ? 'border-rose-500' : ''}`}>
                          <Search className="text-slate-400 shrink-0" size={16} />
                          <SearchableSelect
                            options={(showCustomerDrop ? customerResults : []).map(c => ({ value: c.id, label: c.name, subtitle: c.mobile }))}
                            value={String(form.customerId ?? '')}
                            displayValue={String(form.customerSearch ?? form.customerName ?? '')}
                            onSearch={handleCustomerSearch}
                            onOpen={openCustomerDropdown}
                            onChange={id => {
                              const sel = customerResults.find(c => c.id === id) ?? allCustomersCache.current?.find(c => c.id === id)
                              if (sel) selectCustomer(sel)
                            }}
                            loading={searchLoading}
                            placeholder="Search customer by name or mobile"
                          />
                        </div>
                      </div>
                      {errors.customerId && <div className="text-rose-600 text-sm mt-1">{errors.customerId}</div>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      {showIsChanganOption && (
                        <div>
                          <div className="text-sm font-medium text-slate-700 mb-2">Changan Client?</div>
                          <div className="flex items-center gap-2">
                            <Toggle
                              checked={!!form.isChangan}
                              onChange={v => { updateField('isChangan', v); updateField('clientType', v ? 'CHANGAN' : 'BOSCH') }}
                            />
                            <span className="text-sm text-slate-500">{form.isChangan ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-visible">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Vehicle Information</div>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Plate Number <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Hash className="text-slate-400 shrink-0" size={16} />
                        <input placeholder="ABC-1234" value={form.plate || ''} onChange={e => updateField('plate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                      </div>
                      {errors.plate && <div className="text-rose-600 text-sm mt-1">{errors.plate}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Vehicle Model <span className="text-rose-600">*</span></label>
                      <div className="relative">
                        <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.model ? 'border-rose-500' : ''}`}>
                          <Truck className="text-slate-400 shrink-0" size={16} />
                          <SearchableSelect
                            options={(showModelDrop ? vehicleModelResults : []).map(m => ({ value: String(m.id), label: m.name }))}
                            value={String(form.vehicleModelId ?? '')}
                            displayValue={String(form.model ?? '')}
                            onSearch={handleModelSearch}
                            onOpen={openModelDropdown}
                            onChange={id => {
                              const sel = vehicleModelResults.find(m => String(m.id) === id) ?? allModelsCache.current?.find(m => String(m.id) === id)
                              if (sel) selectModel(sel)
                            }}
                            loading={modelSearchLoading}
                            placeholder="Type to search model"
                            noResultsText="No models found"
                          />
                        </div>
                      </div>
                      {errors.model && <div className="text-rose-600 text-sm mt-1">{errors.model}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Year Model <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Calendar className="text-slate-400 shrink-0" size={16} />
                        <input type="number" placeholder="2024" value={form.yearModel ?? ''} onChange={e => updateField('yearModel', e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent outline-none text-sm" />
                      </div>
                      {errors.yearModel && <div className="text-rose-600 text-sm mt-1">{errors.yearModel}</div>}
                    </div>

                    {showIsChanganOption && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">VIN</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <Key className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="Vehicle Identification Number" value={form.vin || ''} onChange={e => updateField('vin', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Engine Number</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <Wrench className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="Engine No." value={form.engineNo || ''} onChange={e => updateField('engineNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Chasis Number</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <Layers className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="Chasis No." value={form.chasisNo || ''} onChange={e => updateField('chasisNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Transmission Type <span className="text-rose-600">*</span></label>
                      <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.transmissionParameterId ? 'border-rose-500' : ''}`}>
                        <Settings className="text-slate-400 shrink-0" size={16} />
                        <SearchableSelect
                          options={transmissionSelectOptions}
                          value={String(form.transmissionParameterId ?? '')}
                          onChange={id => updateField('transmissionParameterId', id ? Number(id) : undefined)}
                          placeholder="Search transmission type..."
                          noResultsText="No transmission types found"
                        />
                      </div>
                      {errors.transmissionParameterId && <div className="text-rose-600 text-sm mt-1">{errors.transmissionParameterId}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Odometer Type <span className="text-rose-600">*</span></label>
                      <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.odometerParameterId ? 'border-rose-500' : ''}`}>
                        <Activity className="text-slate-400 shrink-0" size={16} />
                        <SearchableSelect
                          options={odometerSelectOptions}
                          value={String(form.odometerParameterId ?? '')}
                          onChange={id => updateField('odometerParameterId', id ? Number(id) : undefined)}
                          placeholder="Search odometer type..."
                          noResultsText="No odometer types found"
                        />
                      </div>
                      {errors.odometerParameterId && <div className="text-rose-600 text-sm mt-1">{errors.odometerParameterId}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Engine Size <span className="text-rose-600">*</span></label>
                      <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.engineSizeParameterId ? 'border-rose-500' : ''}`}>
                        <Gauge className="text-slate-400 shrink-0" size={16} />
                        <SearchableSelect
                          options={engineSizeSelectOptions}
                          value={String(form.engineSizeParameterId ?? '')}
                          onChange={id => updateField('engineSizeParameterId', id ? Number(id) : undefined)}
                          placeholder="Search engine size..."
                          noResultsText="No engine sizes found"
                        />
                      </div>
                      {errors.engineSizeParameterId && <div className="text-rose-600 text-sm mt-1">{errors.engineSizeParameterId}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Engine Type <span className="text-rose-600">*</span></label>
                      <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.engineTypeParameterId ? 'border-rose-500' : ''}`}>
                        <Cpu className="text-slate-400 shrink-0" size={16} />
                        <SearchableSelect
                          options={engineTypeSelectOptions}
                          value={String(form.engineTypeParameterId ?? '')}
                          onChange={id => updateField('engineTypeParameterId', id ? Number(id) : undefined)}
                          placeholder="Search engine type..."
                          noResultsText="No engine types found"
                        />
                      </div>
                      {errors.engineTypeParameterId && <div className="text-rose-600 text-sm mt-1">{errors.engineTypeParameterId}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Customer Registration Type <span className="text-rose-600">*</span></label>
                      <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.customerRegistrationTypeParameterId ? 'border-rose-500' : ''}`}>
                        <Building className="text-slate-400 shrink-0" size={16} />
                        <SearchableSelect
                          options={registrationTypeSelectOptions}
                          value={String(form.customerRegistrationTypeParameterId ?? '')}
                          onChange={id => updateField('customerRegistrationTypeParameterId', id ? Number(id) : undefined)}
                          placeholder="Search registration type..."
                          noResultsText="No registration types found"
                        />
                      </div>
                      {errors.customerRegistrationTypeParameterId && <div className="text-rose-600 text-sm mt-1">{errors.customerRegistrationTypeParameterId}</div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pb-4">
                <button onClick={() => navigate('/vehicles')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                <button onClick={handleSave} disabled={saving} className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + (saving ? ' opacity-70 cursor-not-allowed' : '')}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

            </div>
          )}

          {active === 1 && (
            isAdd ? (
              <div className="p-4 bg-white rounded shadow-sm text-sm text-slate-500">Save the vehicle first to view and add inspections.</div>
            ) : (
              <VehicleInspectionTable vehicleId={id} />
            )
          )}

          {active === 2 && (
            isAdd ? (
              <div className="p-4 bg-white rounded shadow-sm text-sm text-slate-500">Save the vehicle first to view and add service history.</div>
            ) : (
              <VehicleJobOrderTable vehicleId={id} />
            )
          )}

        </div>
      </div>
    </div>
  )
}
