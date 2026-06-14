// @ts-nocheck
async function fetchJson(path: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(path, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    // normalize common API wrappers
    if (Array.isArray(json)) return json
    if (json == null) return []
    if (Array.isArray((json as any).data)) return (json as any).data
    if (Array.isArray((json as any).items)) return (json as any).items
    if (Array.isArray((json as any).results)) return (json as any).results
    // if object has numeric keys and length, convert to array
    if (typeof json === 'object') {
      const maybeArray = Object.values(json).filter(v => v !== undefined && v !== null)
      // if most values are primitives or objects and it looks like array, return values
      if (maybeArray.length > 0 && maybeArray.length <= 100 && maybeArray.some(v => typeof v === 'object')) return maybeArray
    }
    // unexpected response shape for ${path}
    return []
  } catch (e) {
    // fetchJson error
    return []
  }
}

async function fetchItem(path: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(path, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    return null
  }
}

async function sendJson(path: string, method: string, body?: any) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    // read text once to safely handle empty responses (204) and non-JSON payloads
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
    try {
      return JSON.parse(text)
    } catch (e) {
      return text
    }
  } catch (e) {
    throw e
  }
}

export const getServiceCategories = () => fetchJson('/api/config/service-categories')
export const getServiceGroups = () => fetchJson('/api/config/service-groups')
export const getVehicleMakes = () => fetchJson('/api/config/vehicle-makes')
export const getVehicleModels = () => fetchJson('/api/config/vehicle-models')
export const getProductGroups = () => fetchJson('/api/config/product-groups')
export const getProductCategories = () => fetchJson('/api/config/product-categories')
export const getParameterGroups = () => fetchJson('/api/config/parameter-groups')
export const getParameters = () => fetchJson('/api/config/parameters')
export const getParametersByGroup = (group: string) => fetchJson(`/api/config/parameters?parameterGroup=${encodeURIComponent(group)}`)
export const getUnitOfMeasures = () => fetchJson('/api/config/unit-of-measures')
export const getJobStatuses = () => fetchJson('/api/config/job-statuses')
export const getInspectionChecklistTemplates = () => fetchJson('/api/config/inspection-templates')
export const getActiveInspectionChecklistTemplate = () => fetchItem('/api/config/inspection-templates/active')

// Get single item
export const getServiceCategory = (id: string) => fetchItem(`/api/config/service-categories/${id}`)
export const getServiceGroup = (id: string) => fetchItem(`/api/config/service-groups/${id}`)
export const getVehicleMake = (id: string) => fetchItem(`/api/config/vehicle-makes/${id}`)
export const getVehicleModel = (id: string) => fetchItem(`/api/config/vehicle-models/${id}`)
export async function getVehicleModelApplicableProducts(id: string | number, signal?: AbortSignal) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api/config/vehicle-models/${id}/applicable-products`, { signal, headers })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized (401): authentication required')
    if (res.status === 403) throw new Error('Forbidden (403): access denied')
    if (res.status === 404) throw new Error('Vehicle model not found')
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to fetch applicable products: ${res.status}${body ? ` - ${body}` : ''}`)
  }

  const data = await res.json()
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  if (data && Array.isArray(data.data)) return data.data
  return []
}
export const getProductGroup = (id: string) => fetchItem(`/api/config/product-groups/${id}`)
export const getProductCategory = (id: string) => fetchItem(`/api/config/product-categories/${id}`)
export const getParameterGroup = (id: string) => fetchItem(`/api/config/parameter-groups/${id}`)
export const getParameter = (id: string) => fetchItem(`/api/config/parameters/${id}`)
export const getUnitOfMeasure = (id: string) => fetchItem(`/api/config/unit-of-measures/${id}`)
export const getJobStatus = (id: string) => fetchItem(`/api/config/job-statuses/${id}`)
export const getInspectionChecklistTemplate = (id: string) => fetchItem(`/api/config/inspection-templates/${id}`)

// Create
export const createServiceCategory = (body: any) => sendJson('/api/config/service-categories', 'POST', body)
export const createServiceGroup = (body: any) => sendJson('/api/config/service-groups', 'POST', body)
export const createVehicleMake = (body: any) => sendJson('/api/config/vehicle-makes', 'POST', body)
export const createVehicleModel = (body: any) => sendJson('/api/config/vehicle-models', 'POST', body)
export const createProductGroup = (body: any) => sendJson('/api/config/product-groups', 'POST', body)
export const createProductCategory = (body: any) => sendJson('/api/config/product-categories', 'POST', body)
export const createParameterGroup = (body: any) => sendJson('/api/config/parameter-groups', 'POST', body)
export const createParameter = (body: any) => sendJson('/api/config/parameters', 'POST', body)
export const createUnitOfMeasure = (body: any) => sendJson('/api/config/unit-of-measures', 'POST', body)
export const createJobStatus = (body: any) => sendJson('/api/config/job-statuses', 'POST', body)
export const createInspectionChecklistTemplate = (body: any) => sendJson('/api/config/inspection-templates', 'POST', body)

// Update
export const updateServiceCategory = (id: string, body: any) => sendJson(`/api/config/service-categories/${id}`, 'PUT', body)
export const updateServiceGroup = (id: string, body: any) => sendJson(`/api/config/service-groups/${id}`, 'PUT', body)
export const updateVehicleMake = (id: string, body: any) => sendJson(`/api/config/vehicle-makes/${id}`, 'PUT', body)
export const updateVehicleModel = (id: string, body: any) => sendJson(`/api/config/vehicle-models/${id}`, 'PUT', body)
export const updateProductGroup = (id: string, body: any) => sendJson(`/api/config/product-groups/${id}`, 'PUT', body)
export const updateProductCategory = (id: string, body: any) => sendJson(`/api/config/product-categories/${id}`, 'PUT', body)
export const updateParameterGroup = (id: string, body: any) => sendJson(`/api/config/parameter-groups/${id}`, 'PUT', body)
export const updateParameter = (id: string, body: any) => sendJson(`/api/config/parameters/${id}`, 'PUT', body)
export const updateUnitOfMeasure = (id: string, body: any) => sendJson(`/api/config/unit-of-measures/${id}`, 'PUT', body)
export const updateJobStatus = (id: string, body: any) => sendJson(`/api/config/job-statuses/${id}`, 'PUT', body)
export const updateInspectionChecklistTemplate = (id: string, body: any) => sendJson(`/api/config/inspection-templates/${id}`, 'PUT', body)
export const activateInspectionChecklistTemplate = (id: string) => sendJson(`/api/config/inspection-templates/${id}/activate`, 'POST')

// Delete
export const deleteServiceCategory = (id: string) => sendJson(`/api/config/service-categories/${id}`, 'DELETE')
export const deleteServiceGroup = (id: string) => sendJson(`/api/config/service-groups/${id}`, 'DELETE')
export const deleteVehicleMake = (id: string) => sendJson(`/api/config/vehicle-makes/${id}`, 'DELETE')
export const deleteVehicleModel = (id: string) => sendJson(`/api/config/vehicle-models/${id}`, 'DELETE')
export const deleteProductGroup = (id: string) => sendJson(`/api/config/product-groups/${id}`, 'DELETE')
export const deleteProductCategory = (id: string) => sendJson(`/api/config/product-categories/${id}`, 'DELETE')
export const deleteParameterGroup = (id: string) => sendJson(`/api/config/parameter-groups/${id}`, 'DELETE')
export const deleteParameter = (id: string) => sendJson(`/api/config/parameters/${id}`, 'DELETE')
export const deleteUnitOfMeasure = (id: string) => sendJson(`/api/config/unit-of-measures/${id}`, 'DELETE')
export const deleteJobStatus = (id: string) => sendJson(`/api/config/job-statuses/${id}`, 'DELETE')
export const deleteInspectionChecklistTemplate = (id: string) => sendJson(`/api/config/inspection-templates/${id}`, 'DELETE')

export default {
  getServiceCategories,
  getServiceGroups,
  getVehicleMakes,
  getVehicleModels,
  getProductGroups,
  getProductCategories,
  getParameterGroups,
  getParameters,
  getUnitOfMeasures,
  getJobStatuses,
  getInspectionChecklistTemplates,
  getActiveInspectionChecklistTemplate,
  getServiceCategory,
  getServiceGroup,
  getVehicleMake,
  getVehicleModel,
  getVehicleModelApplicableProducts,
  getProductGroup,
  getProductCategory,
  getParameterGroup,
  getParameter,
  getUnitOfMeasure,
  getJobStatus,
  getInspectionChecklistTemplate,
  createServiceCategory,
  createServiceGroup,
  createVehicleMake,
  createVehicleModel,
  createProductGroup,
  createProductCategory,
  createParameterGroup,
  createParameter,
  createUnitOfMeasure,
  createJobStatus,
  createInspectionChecklistTemplate,
  getParametersByGroup,
  updateServiceCategory,
  updateServiceGroup,
  updateVehicleMake,
  updateVehicleModel,
  updateProductGroup,
  updateProductCategory,
  updateParameterGroup,
  updateParameter,
  updateUnitOfMeasure,
  updateJobStatus,
  updateInspectionChecklistTemplate,
  activateInspectionChecklistTemplate,
  deleteInspectionChecklistTemplate,
}
