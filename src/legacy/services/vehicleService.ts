// @ts-nocheck
import { APP } from '../config/app'

type ApiVehicle = Record<string, any>

export interface Vehicle {
  id: number
  clientType: 'BOSCH' | 'CHANGAN'
  plate: string
  make: string
  model: string
  vehicleModelId?: number
  vin?: string
  engineNo?: string
  chasisNo?: string
  transmissionParameterId?: number
  engineTypeParameterId?: number
  engineSizeParameterId?: number
  odometerParameterId?: number
  customerRegistrationTypeParameterId?: number
  customerName: string
  customerId?: number | string
  mobile: string
}

function mapToVehicle(a: ApiVehicle): Vehicle {
  const id = a.id ?? a.vehicleId ?? a.vehicle_id ?? a.uid ?? ''
  const clientTypeRaw = (a.clientType ?? a.client_type ?? a.type ?? a.brand ?? '')
  const isChangan = (
    clientTypeRaw === 'CHANGAN' ||
    String(clientTypeRaw).toLowerCase() === 'changan' ||
    a.isChangan === true ||
    a.is_changan === true ||
    Number(a.isChangan) === 1 ||
    Number(a.is_changan) === 1
  )
  const clientType = isChangan ? 'CHANGAN' : 'BOSCH'
  // prefer API-provided `plateNo` when available
  const plate = a.plateNo ?? a.plateNumber ?? a.plate ?? a.reg_no ?? a.registration ?? ''

  // helper to extract a human-friendly name from possible shapes
  const extractName = (x: any) => {
    if (!x && x !== 0) return null
    if (typeof x === 'string') return x
    if (typeof x === 'number') return String(x)
    // common name keys
    const names = [x?.name, x?.Name, x?.displayName, x?.title, x?.label]
    for (const n of names) if (n) return String(n)
    // nested brand/name shape
    if (x?.brand?.name) return String(x.brand.name)
    // fallback to JSON string if object contains useful text
    try {
      const txt = JSON.stringify(x)
      if (txt && txt.length < 100) return txt
    } catch {}
    return null
  }

  // prefer structured vehicleMake/vehicleModel name properties
  // prefer API-provided `vehicle` field for the model when present
  const vehicleField = a.vehicle ?? null
  const nestedMakeFromModel = extractName(a.vehicleModel?.vehicleMake) ?? extractName(a.vehicleModel?.make)
  const modelNameFromVehicleField = vehicleField ? extractName(vehicleField) : null
  const makeName = nestedMakeFromModel ?? extractName(a.vehicleMake) ?? extractName(a.make) ?? a.makeName ?? a.vehicleMake ?? a.make ?? null
  const modelName = modelNameFromVehicleField ?? extractName(a.vehicleModel) ?? extractName(a.model) ?? a.modelName ?? a.vehicleModel ?? a.model ?? null
  const model = [makeName, modelName].filter(Boolean).join(' ').trim() || String(a.model ?? a.modelName ?? '')

  // customer name: prefer first+last from nested objects, fall back to common fields
  const extractCustomerName = (x: any) => {
    if (!x && x !== 0) return null
    if (typeof x === 'string') return x
    if (typeof x === 'number') return String(x)
    const first = x?.firstName ?? x?.given_name ?? x?.givenName ?? x?.ownerFirstName ?? x?.customerFirstName ?? null
    const last = x?.lastName ?? x?.family_name ?? x?.familyName ?? x?.ownerLastName ?? x?.customerLastName ?? null
    if (first || last) return [first, last].filter(Boolean).join(' ')
    if (x?.name) return x.name
    return null
  }

  const customerName =
    extractCustomerName(a.owner) ??
    extractCustomerName(a.customer) ??
    extractCustomerName(a.ownerDetails) ??
    a.ownerName ?? a.customerName ?? a.owner?.name ?? a.customer?.name ?? a.customer ?? ''

  // extract possible customer id fields
  const customerId = a.customer?.id ?? a.owner?.id ?? a.customerId ?? a.customer_id ?? a.ownerId ?? a.owner_id ?? a.ownerIdNumber ?? null

  // mobile: try common owner/customer/contact fields, including nested vehicleModel owner/customer
  const mobile =
    // prefer explicit `mobileNumber` on root or nested objects
    a.mobileNumber ??
    a.customer?.mobileNumber ?? a.customer?.mobile ?? a.customerMobile ?? a.customerPhone ?? a.customer?.phone ?? a.customer?.contact?.mobile ??
    a.owner?.mobileNumber ?? a.owner?.mobile ?? a.ownerMobile ?? a.ownerPhone ?? a.owner?.phone ?? a.owner?.contact?.mobile ??
    // also check nested vehicleModel customer/owner
    a.vehicleModel?.customer?.mobileNumber ?? a.vehicleModel?.customer?.mobile ?? a.vehicleModel?.customerPhone ??
    a.vehicleModel?.owner?.mobileNumber ?? a.vehicleModel?.owner?.mobile ?? a.vehicleModel?.ownerMobile ?? a.vehicleModel?.ownerPhone ??
    a.mobile ?? a.phone ?? a.contact?.mobile ?? a.contact ?? ''

  return {
    id: Number(id),
    clientType: clientType === 'CHANGAN' ? 'CHANGAN' : 'BOSCH',
    plate: String(plate),
    make: String(makeName ?? ''),
    model: String(model),
    vehicleModelId: a?.vehicleModel?.id ?? a?.vehicleModelId ?? a?.vehicle_model_id ?? a?.VehicleModelId ?? undefined,
    vin: a?.vin ?? a?.VIN ?? a?.vinNumber ?? a?.chassisVin ?? '',
    engineNo: a?.engineNo ?? a?.engineNumber ?? a?.engine_number ?? a?.engine ?? a?.EngineNo ?? '',
    chasisNo: a?.chasisNo ?? a?.ChasisNo ?? a?.chasis_number ?? a?.chasis ?? a?.chassis ?? a?.chassis_number ?? '',
    transmissionParameterId: ((): number | undefined => {
      const v = a?.transmissionParameterId ?? a?.transmission_parameter_id ?? a?.transmissionId ?? a?.transmission?.id ?? a?.transmission?.parameterId ?? a?.transmission?.parameter_id ?? a?.transmissionTypeParameterId ?? a?.TransmissionParameterId ?? a?.transmission_type_parameter_id
      if (v == null) return undefined
      const n = Number(v)
      return Number.isNaN(n) ? undefined : n
    })(),
    engineTypeParameterId: ((): number | undefined => {
      const v = a?.engineTypeParameterId ?? a?.engine_type_parameter_id ?? a?.engineTypeId ?? a?.engineType?.id ?? a?.EngineTypeParameterId ?? a?.engine_type_id
      if (v == null) return undefined
      const n = Number(v)
      return Number.isNaN(n) ? undefined : n
    })(),
    engineSizeParameterId: ((): number | undefined => {
      const v = a?.engineSizeParameterId ?? a?.engine_size_parameter_id ?? a?.engineSizeId ?? a?.engineSize?.id ?? a?.EngineSizeParameterId ?? a?.engine_size_id
      if (v == null) return undefined
      const n = Number(v)
      return Number.isNaN(n) ? undefined : n
    })(),
    odometerParameterId: ((): number | undefined => {
      const v = a?.odometerParameterId ?? a?.odometer_parameter_id ?? a?.odometerId ?? a?.odometer?.id ?? a?.OdometerParameterId ?? a?.odometer_type_parameter_id ?? a?.odometer_type_id
      if (v == null) return undefined
      const n = Number(v)
      return Number.isNaN(n) ? undefined : n
    })(),
    customerRegistrationTypeParameterId: ((): number | undefined => {
      const v = a?.customerRegistrationTypeParameterId ?? a?.customer_registration_type_parameter_id ?? a?.registrationTypeParameterId ?? a?.registration_type_parameter_id ?? a?.registrationTypeId ?? a?.registrationType?.id ?? a?.CustomerRegistrationTypeParameterId
      if (v == null) return undefined
      const n = Number(v)
      return Number.isNaN(n) ? undefined : n
    })(),
    customerName: String(customerName),
    customerId: customerId == null ? undefined : customerId,
    mobile: String(mobile),
    createdDate: a.createdAt ?? a.created_at ?? a.createdOn ?? a.dateCreated ?? a.createdDate ?? a.created_on ?? a.created ?? a.registeredAt ?? null,
  }
}

async function sendVehicleJson(path: string, method: string, body?: Record<string, unknown>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${APP.API_BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    let message = text.trim()
    if (message) {
      try {
        const parsed = JSON.parse(message)
        if (typeof parsed === 'string' && parsed.trim()) message = parsed.trim()
        else if (parsed && typeof parsed === 'object') message = String((parsed as any).message ?? (parsed as any).Message ?? message)
      } catch {
        // keep the raw text when the response is not JSON
      }
    }
    throw new Error(message || `HTTP ${res.status}`)
  }
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export const createVehicle = (body: Record<string, unknown>) => sendVehicleJson('/api/Vehicles', 'POST', body)
export const updateVehicle = (id: string | number, body: Record<string, unknown>) => sendVehicleJson(`/api/Vehicles/${id}`, 'PUT', body)
export const deleteVehicle = (id: string | number) => sendVehicleJson(`/api/Vehicles/${id}`, 'DELETE')

export async function fetchVehicleById(id: string | number, signal?: AbortSignal): Promise<ApiVehicle> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${APP.API_BASE_URL}/api/Vehicles/${id}`, { signal, headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401): authentication required')
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to fetch vehicle: ${res.status}${body ? ` - ${body}` : ''}`)
  }
  return res.json()
}

export async function fetchVehiclesByCustomer(customerId: string | number, signal?: AbortSignal) {
  const url = new URL(`${APP.API_BASE_URL}/api/Vehicles/by-customer/${customerId}`)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url.toString(), { signal, headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401): authentication required')
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to fetch vehicles: ${res.status}${body ? ` - ${body}` : ''}`)
  }
  const data = await res.json()
  let items: ApiVehicle[] = []
  if (Array.isArray(data)) {
    items = data
  } else if (data && Array.isArray(data.items)) {
    items = data.items
  } else if (data && Array.isArray(data.data)) {
    items = data.data
  }
  return { vehicles: items.map(mapToVehicle), total: items.length }
}

export async function fetchVehicles(signal?: AbortSignal) {
  const url = new URL(`${APP.API_BASE_URL}/api/Vehicles/summary`)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string,string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), { signal, headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401): authentication required')
    throw new Error(`Failed to fetch vehicles: ${res.status}`)
  }
  const data = await res.json()

  let items: ApiVehicle[] = []
  let total = 0
  if (Array.isArray(data)) {
    items = data
    total = data.length
  } else if (data && Array.isArray(data.items)) {
    items = data.items
    total = Number(data.total ?? items.length)
  } else if (data && Array.isArray(data.data)) {
    items = data.data
    total = Number(data.total ?? items.length)
  } else {
    items = []
    total = 0
  }

  const vehicles = items.map(mapToVehicle)
  return { vehicles, total }
}
