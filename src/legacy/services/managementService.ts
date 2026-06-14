// @ts-nocheck
async function fetchJson(path: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(path, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (Array.isArray(json)) return json
    if (json == null) return []
    if (Array.isArray((json as any).data)) return (json as any).data
    if (Array.isArray((json as any).items)) return (json as any).items
    if (Array.isArray((json as any).results)) return (json as any).results
    if (typeof json === 'object') {
      const maybeArray = Object.values(json).filter(v => v !== undefined && v !== null)
      if (maybeArray.length > 0 && maybeArray.length <= 100 && maybeArray.some(v => typeof v === 'object')) return maybeArray
    }
    // unexpected response shape for ${path}
    return []
  } catch (e) {
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

async function sendJson(path: string, method: string, body?: Record<string, unknown>) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
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
          // keep the raw text when the response is not JSON
        }
      }
      throw new Error(message || `HTTP ${res.status}`)
    }
    if (!text) return null
    try { return JSON.parse(text) } catch (e) { return text }
  } catch (e) {
    throw e
  }
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function openPdfInNewTab(path: string, loadingTitle: string, loadingMessage: string): Promise<void> {
  const target = window.open('', '_blank')
  if (!target) throw new Error('Popup blocked. Please allow popups to open the PDF report.')

  try {
    target.document.title = loadingTitle
    target.document.body.innerHTML = `<p style="font-family:Arial,sans-serif;padding:16px">${loadingMessage}</p>`

    const res = await fetch(path, {
      headers: {
        ...authHeaders(),
        Accept: 'application/pdf,text/html'
      }
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`)
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      const html = await res.text()
      target.document.open()
      target.document.write(html)
      target.document.close()
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(new Blob([blob], { type: contentType || 'application/pdf' }))
    target.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    target.close()
    throw error
  }
}

export const getPackages = () => fetchJson('/api/management/packages')
export const getServices = () => fetchJson('/api/management/services')
export const getProducts = (query?: { includeApplicableVehicleSearch?: boolean; isQuickSalesProduct?: boolean }) => {
  const params = new URLSearchParams()
  if (query?.includeApplicableVehicleSearch) params.set('includeApplicableVehicleSearch', 'true')
  if (typeof query?.isQuickSalesProduct === 'boolean') params.set('isQuickSalesProduct', String(query.isQuickSalesProduct))
  const suffix = params.toString()
  return fetchJson(`/api/management/products${suffix ? `?${suffix}` : ''}`)
}
export const getSuppliers = () => fetchJson('/api/management/suppliers')
export const getManufacturers = () => fetchJson('/api/management/manufacturers')

export const getPackage = (id: string) => fetchItem(`/api/management/packages/${id}`)
export const getService = (id: string) => fetchItem(`/api/management/services/${id}`)
export const getProduct = (id: string) => fetchItem(`/api/management/products/${id}`)
export const getSupplier = (id: string) => fetchItem(`/api/management/suppliers/${id}`)
export const getManufacturer = (id: string) => fetchItem(`/api/management/manufacturers/${id}`)
export const getProductsBySupplierId = (id: string | number) => fetchJson(`/api/management/suppliers/${id}/products`)
export const getProductsByManufacturerId = (id: string | number) => fetchJson(`/api/management/manufacturers/${id}/products`)
export const getInventorySummary = () => fetchItem('/api/management/inventory/summary')
export const getInventoryAudit = (query?: { page?: number; pageSize?: number; search?: string }) => {
  if (!query) return fetchJson('/api/management/inventory/audit')
  const params = new URLSearchParams()
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  if (query.search && query.search.trim()) params.set('search', query.search.trim())
  const suffix = params.toString()
  return fetchItem(`/api/management/inventory/audit${suffix ? `?${suffix}` : ''}`)
}
export const getInventoryChecks = (query?: { type?: string; start?: string; end?: string; page?: number; pageSize?: number }) => {
  const params = new URLSearchParams()
  if (query?.type) params.set('type', query.type)
  if (query?.start) params.set('start', query.start)
  if (query?.end) params.set('end', query.end)
  if (query?.page !== undefined) params.set('page', String(query.page))
  if (query?.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  const suffix = params.toString()
  return fetchItem(`/api/management/inventory/checks${suffix ? `?${suffix}` : ''}`)
}
export const getInventoryCheck = (id: string | number) => fetchItem(`/api/management/inventory/checks/${id}`)
export const getInventoryProductTransactions = (productId: string | number) => fetchJson(`/api/management/inventory/products/${productId}/transactions`)
export const getProductApplicableVehicles = (productId: string | number) => fetchItem(`/api/management/products/${productId}/applicable-vehicles`)
export const openInventoryProductsReportPdf = (status: 'all' | 'low-stock' | 'out-of-stock') =>
  openPdfInNewTab(
    `/api/management/reports/inventory-products/print?status=${encodeURIComponent(status)}`,
    'Loading inventory products report...',
    'Generating inventory products report...'
  )
export const openInventoryCheckReportPdf = (type: 'end-of-day' | 'month-end', start: string, end: string) =>
  openPdfInNewTab(
    `/api/management/reports/inventory-checks/print?type=${encodeURIComponent(type)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    `Loading ${type === 'month-end' ? 'month end' : 'end of day'} inventory check report...`,
    `Generating ${type === 'month-end' ? 'month end' : 'end of day'} inventory check report...`
  )

export const createPackage = (body: Record<string, unknown>) => sendJson('/api/management/packages', 'POST', body)
export const createService = (body: Record<string, unknown>) => sendJson('/api/management/services', 'POST', body)
export const createProduct = (body: Record<string, unknown>) => sendJson('/api/management/products', 'POST', body)
export const createSupplier = (body: Record<string, unknown>) => sendJson('/api/management/suppliers', 'POST', body)
export const createManufacturer = (body: Record<string, unknown>) => sendJson('/api/management/manufacturers', 'POST', body)
export const createInventoryTransaction = (body: Record<string, unknown>) => sendJson('/api/management/inventory/transactions', 'POST', body)
export const reconcileInventory = (body: Record<string, unknown>) => sendJson('/api/management/inventory/reconciliations', 'POST', body)
export const createInventoryCheck = (body: Record<string, unknown>) => sendJson('/api/management/inventory/checks', 'POST', body)

export const updatePackage = (id: string, body: Record<string, unknown>) => sendJson(`/api/management/packages/${id}`, 'PUT', body)
export const updateService = (id: string, body: Record<string, unknown>) => sendJson(`/api/management/services/${id}`, 'PUT', body)
export const updateProduct = (id: string, body: Record<string, unknown>) => sendJson(`/api/management/products/${id}`, 'PUT', body)
export const updateProductApplicableVehicles = (id: string, body: Record<string, unknown>) => sendJson(`/api/management/products/${id}/applicable-vehicles`, 'PUT', body)
export const updateSupplier = (id: string, body: Record<string, unknown>) => sendJson(`/api/management/suppliers/${id}`, 'PUT', body)
export const updateManufacturer = (id: string, body: Record<string, unknown>) => sendJson(`/api/management/manufacturers/${id}`, 'PUT', body)

export const deletePackage = (id: string) => sendJson(`/api/management/packages/${id}`, 'DELETE')
export const deleteService = (id: string) => sendJson(`/api/management/services/${id}`, 'DELETE')
export const deleteProduct = (id: string) => sendJson(`/api/management/products/${id}`, 'DELETE')
export const deleteSupplier = (id: string) => sendJson(`/api/management/suppliers/${id}`, 'DELETE')
export const deleteManufacturer = (id: string) => sendJson(`/api/management/manufacturers/${id}`, 'DELETE')
export const deleteInventoryTransaction = (id: string | number) => sendJson(`/api/management/inventory/transactions/${id}`, 'DELETE')

export default {
  getPackages,
  getServices,
  getProducts,
  getSuppliers,
  getManufacturers,
  getPackage,
  getService,
  getProduct,
  getSupplier,
  getManufacturer,
  getProductsBySupplierId,
  getProductsByManufacturerId,
  getInventorySummary,
  getInventoryAudit,
  getInventoryChecks,
  getInventoryCheck,
  getInventoryProductTransactions,
  getProductApplicableVehicles,
  openInventoryProductsReportPdf,
  openInventoryCheckReportPdf,
  createPackage,
  createService,
  createProduct,
  createSupplier,
  createManufacturer,
  createInventoryTransaction,
  reconcileInventory,
  createInventoryCheck,
  updatePackage,
  updateService,
  updateProduct,
  updateProductApplicableVehicles,
  updateSupplier,
  updateManufacturer,
  deletePackage,
  deleteService,
  deleteProduct,
  deleteSupplier,
  deleteManufacturer,
  deleteInventoryTransaction,
}
