// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Loader2, RotateCcw, Save, ShieldCheck, Square } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { getRbacConfig, saveRbacConfig } from '../../services/adminService'

type RbacUser = {
  id: number
  email: string
  name: string
  primaryRoleId: number
  roleIds: number[]
  isActive: boolean
}

type RbacRole = {
  id: number
  name: string
  description?: string
}

type RbacPermission = {
  id: number
  key: string
  name: string
  group: string
}

type RolePermission = {
  roleId: number
  permissionId: number
  allowed: boolean
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function matrixKey(roleId: number, permissionId: number) {
  return `${roleId}:${permissionId}`
}

function normalizeSnapshot(snapshot: any) {
  const users: RbacUser[] = (snapshot?.users ?? snapshot?.Users ?? []).map((user: any) => ({
    id: toNumber(user.id ?? user.Id),
    email: String(user.email ?? user.Email ?? ''),
    name: String(user.name ?? user.Name ?? user.email ?? user.Email ?? ''),
    primaryRoleId: toNumber(user.primaryRoleId ?? user.PrimaryRoleId ?? user.roleId ?? user.RoleId),
    roleIds: Array.from(new Set((user.roleIds ?? user.RoleIds ?? user.roles ?? user.Roles ?? []).map((role: any) => toNumber(role?.id ?? role?.Id ?? role)).filter(Boolean))),
    isActive: Boolean(user.isActive ?? user.IsActive ?? true),
  })).filter((user: RbacUser) => user.id > 0)

  const roles: RbacRole[] = (snapshot?.roles ?? snapshot?.Roles ?? []).map((role: any) => ({
    id: toNumber(role.id ?? role.Id),
    name: String(role.name ?? role.Name ?? ''),
    description: role.description ?? role.Description ?? '',
  })).filter((role: RbacRole) => role.id > 0)

  const permissions: RbacPermission[] = (snapshot?.permissions ?? snapshot?.Permissions ?? []).map((permission: any) => ({
    id: toNumber(permission.id ?? permission.Id),
    key: String(permission.key ?? permission.Key ?? ''),
    name: String(permission.name ?? permission.Name ?? ''),
    group: String(permission.group ?? permission.Group ?? 'Other'),
  })).filter((permission: RbacPermission) => permission.id > 0 && permission.key)

  const rolePermissions: RolePermission[] = (snapshot?.rolePermissions ?? snapshot?.RolePermissions ?? []).map((item: any) => ({
    roleId: toNumber(item.roleId ?? item.RoleId),
    permissionId: toNumber(item.permissionId ?? item.PermissionId),
    allowed: Boolean(item.allowed ?? item.Allowed),
  })).filter((item: RolePermission) => item.roleId > 0 && item.permissionId > 0)

  return { users, roles, permissions, rolePermissions }
}

export default function Rbac() {
  const { showToast } = useToast()
  const [users, setUsers] = useState<RbacUser[]>([])
  const [roles, setRoles] = useState<RbacRole[]>([])
  const [permissions, setPermissions] = useState<RbacPermission[]>([])
  const [rolePermissionMap, setRolePermissionMap] = useState<Record<string, boolean>>({})
  const [selectedUserId, setSelectedUserId] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeGroup, setActiveGroup] = useState('Management Permission')

  const selectedUser = users.find(user => user.id === selectedUserId) ?? null

  const groupedPermissions = useMemo(() => {
    const groupOrder = ['Management Permission', 'Page Access', 'RBAC Management']
    const grouped = permissions.reduce<Record<string, RbacPermission[]>>((acc, permission) => {
      const group = permission.group || 'Other'
      acc[group] = acc[group] ?? []
      acc[group].push(permission)
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const ai = groupOrder.indexOf(a)
        const bi = groupOrder.indexOf(b)
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        return a.localeCompare(b)
      })
      .map(([group, items]) => [group, items.sort((a, b) => a.name.localeCompare(b.name))] as const)
  }, [permissions])

  const activePermissions = useMemo(
    () => groupedPermissions.find(([group]) => group === activeGroup) ?? groupedPermissions[0] ?? null,
    [activeGroup, groupedPermissions],
  )
  const selectedUserRoleIds = useMemo(
    () => Array.from(new Set([...(selectedUser?.roleIds ?? []), selectedUser?.primaryRoleId ?? 0].filter(Boolean))),
    [selectedUser],
  )
  const selectedUserRoles = useMemo(
    () => roles.filter(role => selectedUserRoleIds.includes(role.id)),
    [roles, selectedUserRoleIds],
  )
  const selectedPrimaryRole = useMemo(
    () => roles.find(role => role.id === selectedUser?.primaryRoleId) ?? null,
    [roles, selectedUser],
  )

  function applySnapshot(snapshot: any, preferredUserId?: number) {
    const normalized = normalizeSnapshot(snapshot)
    setUsers(normalized.users)
    setRoles(normalized.roles)
    setPermissions(normalized.permissions)
    setRolePermissionMap(Object.fromEntries(normalized.rolePermissions.map(item => [matrixKey(item.roleId, item.permissionId), item.allowed])))

    const nextUserId = preferredUserId && normalized.users.some(user => user.id === preferredUserId)
      ? preferredUserId
      : normalized.users[0]?.id ?? 0

    const nextGroup = normalized.permissions.some((permission: RbacPermission) => permission.group === activeGroup)
      ? activeGroup
      : normalized.permissions[0]?.group ?? 'Management Permission'
    setActiveGroup(nextGroup)
    selectUser(nextUserId, normalized.users)
  }

  async function load(preferredUserId = selectedUserId) {
    setLoading(true)
    setError('')
    try {
      const snapshot = await getRbacConfig()
      applySnapshot(snapshot, preferredUserId)
    } catch (err: any) {
      const message = err?.message || 'Failed to load RBAC settings'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(0)
  }, [])

  function selectUser(userId: number, sourceUsers = users) {
    const user = sourceUsers.find(item => item.id === userId)
    setSelectedUserId(user?.id ?? 0)
  }

  function toggleRolePermission(roleId: number, permissionId: number) {
    const key = matrixKey(roleId, permissionId)
    setRolePermissionMap(current => ({ ...current, [key]: !current[key] }))
  }

  function setPermissionValues(roleIds: number[], permissionIds: number[], allowed: boolean) {
    if (roleIds.length === 0 || permissionIds.length === 0) return
    setRolePermissionMap(current => {
      const next = { ...current }
      roleIds.forEach(roleId => {
        permissionIds.forEach(permissionId => {
          next[matrixKey(roleId, permissionId)] = allowed
        })
      })
      return next
    })
  }

  function setActiveGroupPermissions(allowed: boolean) {
    if (!activePermissions) return
    setPermissionValues(
      roles.map(role => role.id),
      activePermissions[1].map(permission => permission.id),
      allowed,
    )
  }

  function setRolePermissionsForActiveGroup(roleId: number, allowed: boolean) {
    if (!activePermissions) return
    setPermissionValues([roleId], activePermissions[1].map(permission => permission.id), allowed)
  }

  async function handleSave() {
    if (!selectedUserId || !selectedUser) {
      showToast('Select a user before saving.', 'error')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        userId: selectedUserId,
        primaryRoleId: selectedUser.primaryRoleId,
        assignedRoleIds: Array.from(new Set([...(selectedUser.roleIds ?? []), selectedUser.primaryRoleId].filter(Boolean))),
        rolePermissions: roles.flatMap(role =>
          permissions.map(permission => ({
            roleId: role.id,
            permissionId: permission.id,
            allowed: !!rolePermissionMap[matrixKey(role.id, permission.id)],
          }))
        ),
      }

      const snapshot = await saveRbacConfig(payload)
      applySnapshot(snapshot, selectedUserId)
      showToast('RBAC settings saved', 'success')
    } catch (err: any) {
      const message = err?.message || 'Save failed'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 xl:overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">RBAC</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage role-based login and page access.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(selectedUserId)}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-bosch-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 xl:overflow-hidden">
        <section className="flex min-h-0 h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-700">
            <div className="grid gap-3 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] xl:items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Select User</label>
                <select
                  aria-label="Select User"
                  value={selectedUserId || ''}
                  onChange={event => selectUser(Number(event.target.value))}
                  disabled={loading || saving}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Select user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <div className="flex flex-wrap gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-slate-200">
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium">{selectedUser.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.email}</div>
                  </div>
                  {selectedPrimaryRole && (
                    <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-sky-100 dark:bg-slate-900/50 dark:text-slate-200 dark:ring-sky-500/20">
                      Primary: {selectedPrimaryRole.name}
                    </div>
                  )}
                  {selectedUserRoles.length > 0 && (
                    <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-sky-100 dark:bg-slate-900/50 dark:text-slate-200 dark:ring-sky-500/20">
                      Roles: {selectedUserRoles.map(role => role.name).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <ShieldCheck size={18} className="text-sky-600 dark:text-sky-300" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Permissions</h2>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={16} className="animate-spin" />
              Loading RBAC settings...
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 xl:overflow-hidden">
              <div className="flex flex-wrap gap-2">
                {groupedPermissions.map(([group, items]) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setActiveGroup(group)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      group === activeGroup
                        ? 'border-bosch-blue bg-bosch-blue text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/50 dark:hover:text-sky-300'
                    }`}
                  >
                    <span>{group}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${group === activeGroup ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {items.length}
                    </span>
                  </button>
                ))}
              </div>

              {activePermissions && (
                <div className="flex min-h-0 flex-1 flex-col gap-3 xl:overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{activePermissions[0]}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Toggle access per role for the selected permission group.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs text-slate-400">{activePermissions[1].length} items</div>
                      <button
                        type="button"
                        onClick={() => setActiveGroupPermissions(true)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/50 dark:hover:text-sky-300"
                      >
                        <CheckSquare size={14} />
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveGroupPermissions(false)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
                      >
                        <Square size={14} />
                        Unselect All
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 xl:flex-1 xl:overflow-auto">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                          <th className="w-[34%] px-3 py-3">{activePermissions[0] === 'Page Access' ? 'Page / Permission' : 'Permission'}</th>
                          {roles.map(role => (
                            <th key={role.id} className="w-[6.5rem] px-2 py-2 text-center align-top">
                              <span className="block whitespace-normal text-[11px] leading-4">{role.name}</span>
                              <div className="mt-1 flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Select all ${role.name} ${activePermissions[0]}`}
                                  onClick={() => setRolePermissionsForActiveGroup(role.id, true)}
                                  disabled={saving}
                                  className="rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-sky-600 hover:border-sky-200 hover:bg-sky-50 disabled:opacity-60 dark:text-sky-300 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10"
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Unselect all ${role.name} ${activePermissions[0]}`}
                                  onClick={() => setRolePermissionsForActiveGroup(role.id, false)}
                                  disabled={saving}
                                  className="rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:border-slate-200 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700/50"
                                >
                                  None
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activePermissions[1].map(permission => (
                          <tr key={permission.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700/70">
                            <td className="px-3 py-2.5 align-middle">
                              <div className="text-sm font-medium leading-5 text-slate-800 dark:text-slate-100">{permission.name}</div>
                              <div className="mt-0.5 break-all text-[10px] text-slate-400">{permission.key}</div>
                            </td>
                            {roles.map(role => (
                              <td key={role.id} className="px-2 py-2 text-center align-middle">
                                <input
                                  type="checkbox"
                                  aria-label={`${role.name} ${permission.name}`}
                                  checked={!!rolePermissionMap[matrixKey(role.id, permission.id)]}
                                  onChange={() => toggleRolePermission(role.id, permission.id)}
                                  disabled={saving}
                                  className="h-4 w-4 rounded border-slate-300 text-bosch-blue focus:ring-bosch-blue"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
