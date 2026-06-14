// @ts-nocheck
import { APP } from '../config/app'

export async function fetchCustomerById(id: string | number, signal?: AbortSignal) {
  const url = new URL(`${APP.API_BASE_URL}/api/customers/${id}`)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string,string> = { 'Accept': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), { signal, headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401)')
    if (res.status === 404) throw new Error('NotFound (404)')
    throw new Error(`Failed to fetch customer: ${res.status}`)
  }
  const data = await res.json()
  return data
}

export async function updateCustomerById(id: string | number, payload: Record<string, any>, signal?: AbortSignal) {
  const url = new URL(`${APP.API_BASE_URL}/api/customers/${id}`)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string,string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), { method: 'PUT', body: JSON.stringify(payload), headers, signal })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401)')
    if (res.status === 404) throw new Error('NotFound (404)')
    const txt = await res.text().catch(()=>null)
    throw new Error(`Failed to update customer: ${res.status} ${txt ?? ''}`)
  }
  const data = await res.json().catch(()=>null)
  return data
}

export async function createCustomer(payload: Record<string, any>, signal?: AbortSignal) {
  const url = new URL(`${APP.API_BASE_URL}/api/customers`)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string,string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), { method: 'POST', body: JSON.stringify(payload), headers, signal })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401)')
    const txt = await res.text().catch(()=>null)
    throw new Error(`Failed to create customer: ${res.status} ${txt ?? ''}`)
  }
  const data = await res.json().catch(()=>null)
  return data
}

export async function deleteCustomerById(id: string | number, signal?: AbortSignal) {
  const url = new URL(`${APP.API_BASE_URL}/api/customers/${id}`)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string,string> = { 'Accept': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), { method: 'DELETE', headers, signal })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401)')
    const txt = await res.text().catch(()=>null)
    let message = (txt ?? '').trim()
    if (message) {
      try {
        const parsed = JSON.parse(message)
        if (typeof parsed === 'string' && parsed.trim()) message = parsed.trim()
        else if (parsed && typeof parsed === 'object') message = String((parsed as any).message ?? (parsed as any).Message ?? message)
      } catch {
        // keep the raw text when the response is not JSON
      }
    }
    throw new Error(message || `Failed to delete customer: ${res.status}`)
  }
  const data = await res.json().catch(()=>null)
  return data
}
import type { Customer } from '../components/tables/CustomerListTable'

type ApiCustomer = Record<string, any>

function mapToCustomer(a: ApiCustomer) : Customer {
  // flexible mapping for common property names
  const id = a.id ?? a.customerId ?? a.customer_id ?? a.uid ?? ''
  // prefer explicit first/last name fields when available
  const first = a.firstName ?? a.first_name ?? a.given_name ?? a.givenName ?? a.fname ?? null
  const last = a.lastName ?? a.last_name ?? a.family_name ?? a.familyName ?? a.lname ?? null
  let name = ''
  if (first && last) name = `${first} ${last}`
  else if (first) name = String(first)
  else if (last) name = String(last)
  else name = a.name ?? a.fullName ?? a.full_name ?? a.customerName ?? ''
  const address = a.address ?? a.homeAddress ?? a.location ?? ''
  // accept many possible phone field names returned by different APIs
  const mobile = (
    a.mobile ??
    a.mobileNumber ??
    a.mobile_number ??
    a.phone ??
    a.phoneNumber ??
    a.phone_number ??
    a.contact ??
    a.contactNumber ??
    a.contact_number ??
    a.msisdn ??
    a.telephone ??
    a.cell ??
    a.phone1 ??
    ''
  )
  const clientTypeRaw = (a.clientType ?? a.client_type ?? a.type ?? '')
  const isChangan = (
    clientTypeRaw === 'CHANGAN' ||
    String(clientTypeRaw).toLowerCase() === 'changan' ||
    a.isChangan === true ||
    a.is_changan === true ||
    Number(a.isChangan) === 1 ||
    Number(a.is_changan) === 1
  )
  return {
    id: String(id),
    clientType: isChangan ? 'CHANGAN' : 'BOSCH',
    name: String(name),
    address: String(address),
    mobile: String(mobile),
    createdDate: a.createdAt ?? a.created_at ?? a.createdOn ?? a.dateCreated ?? a.createdDate ?? a.created_on ?? a.created ?? a.registeredAt ?? null,
  }
}

export async function fetchCustomers(signal?: AbortSignal, start?: string | null, end?: string | null) {
  const url = new URL(`${APP.API_BASE_URL}/api/customers/summary`)
  if (start) url.searchParams.set('start', start)
  if (end) url.searchParams.set('end', end)

  // include auth token when available
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string,string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  // no debug logging in production

  const res = await fetch(url.toString(), { signal, headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401): authentication required')
    throw new Error(`Failed to fetch customers: ${res.status}`)
  }
  const data = await res.json()

  // Expecting either { items: [...], total: n } or plain array
  let items: ApiCustomer[] = []
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
    // try to coerce
    items = []
    total = 0
  }

  const customers = items.map(mapToCustomer)
  return { customers, total }
}
