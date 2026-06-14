// @ts-nocheck
export type AppAction =
  | 'inventory.view'
  | 'inventory.adjust'
  | 'inventory.reconcile'
  | 'inventory.deleteManualTransaction'
  | 'reports.view'
  | 'operations.convert'
  | 'payments.edit'
  | 'admin.manage'

const ADMIN_ROLES = new Set(['ADMIN', 'ADMINISTRATOR', 'SYSTEM ADMINISTRATOR', 'OWNER', 'SUPERVISOR'])
const STAFF_ROLES = new Set(['STAFF', 'SERVICE ADVISOR', 'TECHNICIAN'])
const FULL_ACCESS_ROLES = new Set(['OWNER', 'SYSTEM ADMINISTRATOR'])
const ROLE_LIST_KEYS = ['roles', 'Roles', 'userRoles', 'UserRoles', 'assignedRoles', 'AssignedRoles', 'roleNames', 'RoleNames']
const ROLE_VALUE_KEYS = ['role', 'Role', 'roleName', 'RoleName', 'role_name', 'Role_Name', 'primaryRole', 'PrimaryRole', 'primaryRoleName', 'PrimaryRoleName']
const ROLE_NAME_KEYS = ['name', 'Name', 'roleName', 'RoleName', 'role_name']

export function normalizeRoleName(role: unknown): string {
  if (role === null || role === undefined) return ''
  if (typeof role === 'number') {
    if (role === 1) return 'ADMIN'
    if (role === 2) return 'STAFF'
    return role === 0 ? 'GUEST' : String(role)
  }
  const raw = String(role).trim()
  if (/^[0-9]+$/.test(raw)) return normalizeRoleName(Number(raw))
  return raw.toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function extractRoleNames(value: unknown): string[] {
  const roles: string[] = []
  const seen = new Set<unknown>()

  const push = (role: unknown) => {
    const normalized = normalizeRoleName(role)
    if (normalized && normalized !== '[OBJECT OBJECT]' && !roles.includes(normalized)) roles.push(normalized)
  }

  const collect = (current: unknown, allowNameProperty = false) => {
    if (current === null || current === undefined) return
    if (Array.isArray(current)) {
      current.forEach(item => collect(item, true))
      return
    }
    if (typeof current !== 'object') {
      push(current)
      return
    }
    if (seen.has(current)) return
    seen.add(current)

    const record = current as Record<string, unknown>
    ROLE_VALUE_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(record, key)) collect(record[key], true)
    })
    ROLE_LIST_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(record, key)) collect(record[key], true)
    })
    if (allowNameProperty) {
      ROLE_NAME_KEYS.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(record, key)) collect(record[key], false)
      })
    }
  }

  collect(value)
  return roles
}

export function isOwnerRole(role: unknown): boolean {
  return extractRoleNames(role).some(name => /\bOWNER\b/.test(name))
}

export function isSystemAdministratorRole(role: unknown): boolean {
  return extractRoleNames(role).some(name => name === 'SYSTEM ADMINISTRATOR')
}

export function isFullAccessRole(role: unknown): boolean {
  return extractRoleNames(role).some(name => FULL_ACCESS_ROLES.has(name) || /\bOWNER\b/.test(name))
}

export function isAdministratorRole(role: unknown): boolean {
  return extractRoleNames(role).some(normalized =>
    ADMIN_ROLES.has(normalized)
      || /\bADMIN\b/.test(normalized)
      || /\bADMINISTRATOR\b/.test(normalized)
  )
}

export function isAdminRole(role: unknown): boolean {
  return isFullAccessRole(role) || isAdministratorRole(role)
}

export function isStaffRole(role: unknown): boolean {
  return extractRoleNames(role).some(name => STAFF_ROLES.has(name))
}

export function hasAllowedRole(userRoles: unknown, allowedRoles: unknown): boolean {
  const normalizedUserRoles = extractRoleNames(userRoles)
  const normalizedAllowedRoles = extractRoleNames(allowedRoles)
  if (normalizedUserRoles.length === 0 || normalizedAllowedRoles.length === 0) return false
  if (isFullAccessRole(normalizedUserRoles)) return true
  if (normalizedUserRoles.some(role => normalizedAllowedRoles.includes(role))) return true
  return isAdministratorRole(normalizedUserRoles)
    && normalizedAllowedRoles.some(role => role === 'ADMIN' || /\bADMIN\b/.test(role) || /\bADMINISTRATOR\b/.test(role))
}

export function isActionAllowed(role: unknown, action: AppAction): boolean {
  if (isAdminRole(role)) return true

  switch (action) {
    case 'inventory.view':
    case 'reports.view':
    case 'operations.convert':
      return isStaffRole(role)
    case 'inventory.adjust':
    case 'inventory.reconcile':
    case 'inventory.deleteManualTransaction':
    case 'payments.edit':
    case 'admin.manage':
      return false
    default:
      return false
  }
}

export function permissionDeniedMessage(action: AppAction): string {
  switch (action) {
    case 'inventory.adjust':
      return 'Only administrators can record manual stock movements.'
    case 'inventory.reconcile':
      return 'Only administrators can reconcile physical inventory.'
    case 'inventory.deleteManualTransaction':
      return 'Only administrators can delete manual inventory transactions.'
    case 'payments.edit':
      return 'Only administrators can edit payment records.'
    default:
      return 'Permission denied.'
  }
}
