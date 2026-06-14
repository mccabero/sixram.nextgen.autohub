// @ts-nocheck
export const CAN_DELETE_PERMISSION_KEY = 'auth.can_delete'
export const CAN_VOID_PERMISSION_KEY = 'operations.can_void'
export const CAN_USE_CHATBOT_PERMISSION_KEY = 'chatbot.can_use'
export const CAN_EDIT_PRICE_PERMISSION_KEY = 'auth.can_edit_price'
export const CAN_FILTER_DASHBOARD_PERMISSION_KEY = 'dashboard.can_filter'
export const EFFECTIVE_PERMISSIONS_UPDATED_EVENT = 'effective-permissions-updated'

const EFFECTIVE_PERMISSIONS_STORAGE_KEY = 'effective_permission_keys'

let cachedPermissionKeys: string[] | null = null

export function normalizePermissionKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return []
  return Array.from(new Set(keys.map(key => String(key).trim()).filter(Boolean)))
}

export function hasPermissionKey(keys: unknown, permissionKey: string): boolean {
  const normalizedPermissionKey = String(permissionKey || '').trim().toLowerCase()
  if (!normalizedPermissionKey) return false
  return normalizePermissionKeys(keys).some(key => key.toLowerCase() === normalizedPermissionKey)
}

export function canDeleteFromPermissionKeys(keys: unknown): boolean {
  return hasPermissionKey(keys, CAN_DELETE_PERMISSION_KEY)
}

export function canEditPriceFromPermissionKeys(keys: unknown): boolean {
  return hasPermissionKey(keys, CAN_EDIT_PRICE_PERMISSION_KEY)
}

export function getCachedEffectivePermissionKeys(): string[] {
  if (cachedPermissionKeys) return cachedPermissionKeys
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(EFFECTIVE_PERMISSIONS_STORAGE_KEY)
    cachedPermissionKeys = normalizePermissionKeys(raw ? JSON.parse(raw) : [])
    return cachedPermissionKeys
  } catch {
    return []
  }
}

export function publishEffectivePermissionKeys(keys: unknown): string[] {
  const normalized = normalizePermissionKeys(keys)
  cachedPermissionKeys = normalized

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(EFFECTIVE_PERMISSIONS_STORAGE_KEY, JSON.stringify(normalized))
      window.dispatchEvent(new CustomEvent(EFFECTIVE_PERMISSIONS_UPDATED_EVENT, { detail: { permissionKeys: normalized } }))
    } catch {}
  }

  return normalized
}

export function clearEffectivePermissionKeys() {
  cachedPermissionKeys = null
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(EFFECTIVE_PERMISSIONS_STORAGE_KEY)
      window.dispatchEvent(new CustomEvent(EFFECTIVE_PERMISSIONS_UPDATED_EVENT, { detail: { permissionKeys: [] } }))
    } catch {}
  }
}
