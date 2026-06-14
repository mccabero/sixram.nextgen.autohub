// @ts-nocheck
import getCurrentUserId from '../auth/getCurrentUserId'
import {
  getCachedEffectivePermissionKeys,
  hasCachedEffectivePermissionKeys,
  publishEffectivePermissionKeys,
} from '../utils/effectivePermissions'

let loginSettingsCache: any | null = null
let loginSettingsLoad: Promise<any> | null = null
let effectivePermissionsLoad: Promise<string[]> | null = null
let effectivePermissionsCacheReady = false

function currentAuthUser() {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function normalizeId(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function requirePositiveId(value: unknown, label = 'ID') {
  const id = normalizeId(value)
  if (!id) throw new Error(`${label} is required.`)
  return id
}

function publishEffectivePermissionsFromRbacSnapshot(snapshot: any) {
  const currentUserId = getCurrentUserId(currentAuthUser())
  if (!currentUserId) return false

  const users = Array.isArray(snapshot?.users) ? snapshot.users : Array.isArray(snapshot?.Users) ? snapshot.Users : []
  const currentUser = users.find((user: any) => normalizeId(user?.id ?? user?.Id) === currentUserId)
  if (!currentUser) return false

  const roleIds = new Set<number>()
  const primaryRoleId = normalizeId(currentUser.primaryRoleId ?? currentUser.PrimaryRoleId ?? currentUser.roleId ?? currentUser.RoleId)
  if (primaryRoleId) roleIds.add(primaryRoleId)

  const assignedRoleIds = currentUser.roleIds ?? currentUser.RoleIds ?? currentUser.roles ?? currentUser.Roles ?? []
  if (Array.isArray(assignedRoleIds)) {
    assignedRoleIds.forEach((role: any) => {
      const roleId = normalizeId(role?.id ?? role?.Id ?? role)
      if (roleId) roleIds.add(roleId)
    })
  }

  const permissions = Array.isArray(snapshot?.permissions) ? snapshot.permissions : Array.isArray(snapshot?.Permissions) ? snapshot.Permissions : []
  const permissionKeysById = new Map<number, string>()
  permissions.forEach((permission: any) => {
    const permissionId = normalizeId(permission?.id ?? permission?.Id)
    const key = String(permission?.key ?? permission?.Key ?? '').trim()
    if (permissionId && key) permissionKeysById.set(permissionId, key)
  })

  const rolePermissions = Array.isArray(snapshot?.rolePermissions)
    ? snapshot.rolePermissions
    : Array.isArray(snapshot?.RolePermissions)
      ? snapshot.RolePermissions
      : []

  const effectiveKeys = rolePermissions
    .filter((item: any) => roleIds.has(normalizeId(item?.roleId ?? item?.RoleId)) && Boolean(item?.allowed ?? item?.Allowed))
    .map((item: any) => permissionKeysById.get(normalizeId(item?.permissionId ?? item?.PermissionId)))
    .filter(Boolean)

  publishEffectivePermissionKeys(effectiveKeys)
  return true
}

async function fetchJson(path: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const masked = token ? `${String(token).slice(0,8)}...` : null
    // debug: adminService fetch
    const res = await fetch(path, { headers })
    // debug: adminService response status
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
    // fetchJson error
    return []
  }
}

function parseErrorMessage(text: string, fallback: string) {
  const raw = text.trim()
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (parsed && typeof parsed === 'object') {
      const message = (parsed as any).error ?? (parsed as any).message ?? (parsed as any).Message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
  } catch {
    // keep raw response text
  }

  return raw
}

function normalizeArrayResponse(json: any) {
  if (Array.isArray(json)) return json
  if (json == null) return []
  if (Array.isArray(json.data)) return json.data
  if (Array.isArray(json.items)) return json.items
  if (Array.isArray(json.results)) return json.results
  if (typeof json === 'object') {
    const maybeArray = Object.values(json).filter(v => v !== undefined && v !== null)
    if (maybeArray.length > 0 && maybeArray.length <= 100 && maybeArray.some(v => typeof v === 'object')) return maybeArray
  }
  return []
}

function tokenHeaders(token: string, includeContentType = false) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (includeContentType) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  headers['X-Override-Auth'] = 'true'
  return headers
}

async function responseMessage(res: Response) {
  const text = await res.text().catch(() => '')
  if (!text.trim()) return `HTTP ${res.status}`

  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (parsed && typeof parsed === 'object') {
      const message = parsed.message ?? parsed.Message ?? parsed.error ?? parsed.Error ?? parsed.title ?? parsed.Title
      if (message) return String(message)
      if (parsed.errors && typeof parsed.errors === 'object') {
        const first = Object.values(parsed.errors).flat().find(Boolean)
        if (first) return String(first)
      }
    }
  } catch {
    // keep raw text below
  }

  return text.trim() || `HTTP ${res.status}`
}

export async function getUserByEmailWithToken(email: string, token: string) {
  const res = await fetch(`/api/users/by-email?email=${encodeURIComponent(email)}`, {
    headers: tokenHeaders(token),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await responseMessage(res))
  try { return await res.json() } catch { return null }
}

export async function getUsersWithToken(token: string) {
  const res = await fetch('/api/users', {
    headers: tokenHeaders(token),
  })
  if (!res.ok) throw new Error(await responseMessage(res))
  try { return normalizeArrayResponse(await res.json()) } catch { return [] }
}

export async function updateUserWithToken(id: string | number, payload: any, token: string) {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: tokenHeaders(token, true),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await responseMessage(res))
  try { return await res.json() } catch { return null }
}

export const getCompanyInfo = () => fetchJson('/api/companyinfo')
export async function getLoginSettings(options?: { force?: boolean }) {
  if (!options?.force && loginSettingsCache !== null) return loginSettingsCache
  if (!options?.force && loginSettingsLoad) return loginSettingsLoad

  loginSettingsLoad = (async () => {
    const res = await fetch('/api/login-settings', { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loginSettingsCache = await res.json()
    return loginSettingsCache
  })()

  try {
    return await loginSettingsLoad
  } finally {
    loginSettingsLoad = null
  }
}

export async function updateLoginSettings(payload: { companyName?: string; showIsChanganOption?: boolean; cameraEventCooldownSeconds?: number }) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/login-settings', { method: 'PUT', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loginSettingsCache = await res.json()
    return loginSettingsCache
  } catch (e) {
    loginSettingsCache = null
    throw e
  }
}

export async function getHikvisionCameraSettings() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/camera/hikvision/settings', { headers })
  if (!res.ok) throw new Error(await responseMessage(res))
  return await res.json()
}

export async function updateHikvisionCameraSettings(payload: {
  snapshotCaptureEnabled?: boolean
  cameraIp?: string
  username?: string
  password?: string
  snapshotChannel?: string
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/camera/hikvision/settings', { method: 'PUT', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(await responseMessage(res))
  return await res.json()
}

export async function testHikvisionSnapshotSettings(payload: {
  snapshotCaptureEnabled?: boolean
  cameraIp?: string
  username?: string
  password?: string
  snapshotChannel?: string
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/camera/hikvision/settings/test-snapshot', { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(await responseMessage(res))
  return await res.json()
}
export const getUsers = () => fetchJson('/api/users')
export const getRoles = () => fetchJson('/api/roles')
export const getRole = (id: string | number) => fetchJson(`/api/roles/${id}`)

export async function getRbacConfig() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/rbac', { headers })
  if (!res.ok) throw new Error(await responseMessage(res))
  return await res.json()
}

export async function saveRbacConfig(payload: any) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/rbac/save', { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(await responseMessage(res))
  const snapshot = await res.json()

  if (publishEffectivePermissionsFromRbacSnapshot(snapshot)) {
    effectivePermissionsCacheReady = true
  } else {
    try {
      await getEffectivePermissions({ force: true })
    } catch {
      // Keep the current session intact; page access will re-check on the next navigation.
    }
  }

  return snapshot
}

export async function getEffectivePermissions(options?: { force?: boolean }): Promise<string[]> {
  if (!options?.force && effectivePermissionsCacheReady && hasCachedEffectivePermissionKeys()) {
    return getCachedEffectivePermissionKeys()
  }

  if (!options?.force && effectivePermissionsLoad) return effectivePermissionsLoad

  effectivePermissionsLoad = (async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/rbac/effective-permissions', { headers })
    if (!res.ok) throw new Error(await responseMessage(res))
    const json = await res.json().catch(() => ({}))
    const keys = json?.permissionKeys ?? json?.permissions ?? json?.PermissionKeys ?? []
    effectivePermissionsCacheReady = true
    return publishEffectivePermissionKeys(Array.isArray(keys) ? keys.map(String) : [])
  })()

  try {
    return await effectivePermissionsLoad
  } finally {
    effectivePermissionsLoad = null
  }
}

export async function checkPageAccess(path: string): Promise<{ allowed: boolean; permissionKey?: string | null }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api/rbac/page-access?path=${encodeURIComponent(path)}`, { headers })
  if (!res.ok) throw new Error(await responseMessage(res))
  const json = await res.json().catch(() => ({}))
  return { allowed: !!(json?.allowed ?? json?.Allowed), permissionKey: json?.permissionKey ?? json?.PermissionKey ?? null }
}

export async function getRoleById(id: string | number) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/roles/${id}`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    throw e
  }
}

export async function createRole(payload: any) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/roles', { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    throw e
  }
}

export async function deleteRole(id: string | number) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/roles/${id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
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
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function updateRole(id: string | number, payload: any) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/roles/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    try {
      return await res.json()
    } catch (e) {
      // some APIs return 204 No Content or empty body on success
      return null
    }
  } catch (e) {
    throw e
  }
}

export async function getCompanyById(id: string | number) {
  try {
    const companyId = requirePositiveId(id, 'Company ID')
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/companyinfo/${companyId}`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function createCompany(payload: any) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/companyinfo', { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function uploadCompanyLogo(companyId: string | number, file: File) {
  try {
    const id = requirePositiveId(companyId, 'Company ID')
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const form = new FormData()
    form.append('file', file, file.name)
    const res = await fetch(`/api/companyinfo/${id}/logo`, { method: 'POST', headers, body: form })
    if (!res.ok) {
      // try to extract server error message
      const text = await res.text().catch(() => '')
      throw new Error(parseErrorMessage(text, `HTTP ${res.status}`))
    }
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

async function uploadLoginAsset(path: string, file: File) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const form = new FormData()
    form.append('file', file, file.name)
    const res = await fetch(path, { method: 'POST', headers, body: form })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(parseErrorMessage(text, `HTTP ${res.status}`))
    }
    loginSettingsCache = null
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

async function deleteLoginAsset(path: string) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(path, { method: 'DELETE', headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loginSettingsCache = null
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export function uploadLoginBackground(file: File) {
  return uploadLoginAsset('/api/login-settings/background', file)
}

export function uploadLoginLogo(file: File) {
  return uploadLoginAsset('/api/login-settings/logo', file)
}

export function deleteLoginBackground() {
  return deleteLoginAsset('/api/login-settings/background')
}

export function deleteLoginLogo() {
  return deleteLoginAsset('/api/login-settings/logo')
}

export async function updateCompany(id: string | number, payload: any) {
  try {
    const companyId = requirePositiveId(id, 'Company ID')
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/companyinfo/${companyId}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function deleteCompany(id: string | number) {
  try {
    const companyId = requirePositiveId(id, 'Company ID')
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/companyinfo/${companyId}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
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
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function getUserById(id: string | number) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/users/${id}`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function createUser(payload: any) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/users', { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(await responseMessage(res))
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function updateUser(id: string | number, payload: any) {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(await responseMessage(res))
    try { return await res.json() } catch { return null }
  } catch (e) {
    throw e
  }
}

export async function checkPinAvailability(pin: string, excludeUserId?: string | number | null) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const params = new URLSearchParams({ pin })
  if (excludeUserId) params.set('excludeUserId', String(excludeUserId))
  const res = await fetch(`/api/users/pin-availability?${params.toString()}`, { headers })
  if (!res.ok) throw new Error(await responseMessage(res))
  const json = await res.json().catch(() => ({}))
  return Boolean(json?.available ?? json?.Available)
}

export async function getVoidCodes(take = 25) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api/administrators/void-codes?take=${encodeURIComponent(String(take))}`, { headers })
  if (!res.ok) throw new Error(await responseMessage(res))
  try { return await res.json() } catch { return [] }
}

export async function generateVoidCode(expiresInMinutes: number) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/administrators/void-codes', {
    method: 'POST',
    headers,
    body: JSON.stringify({ expiresInMinutes }),
  })
  if (!res.ok) throw new Error(await responseMessage(res))
  try { return await res.json() } catch { return null }
}

export default {
  getCompanyInfo,
  getLoginSettings,
  updateLoginSettings,
  getHikvisionCameraSettings,
  updateHikvisionCameraSettings,
  testHikvisionSnapshotSettings,
  getUsers,
  getRoles,
  getRole,
  getRbacConfig,
  saveRbacConfig,
  getEffectivePermissions,
  checkPageAccess,
  getRoleById,
  createRole,
  deleteRole,
  updateRole,
  getCompanyById,
  createCompany,
  updateCompany,
  uploadCompanyLogo,
  uploadLoginBackground,
  uploadLoginLogo,
  deleteLoginBackground,
  deleteLoginLogo,
  deleteCompany,
  getUserById,
  createUser,
  updateUser,
  checkPinAvailability,
  getUserByEmailWithToken,
  getUsersWithToken,
  updateUserWithToken,
  getVoidCodes,
  generateVoidCode,
}
