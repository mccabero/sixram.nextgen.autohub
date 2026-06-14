// @ts-nocheck
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/toast'
import { login as loginService } from '../services/authService'
import { getUserByEmailWithToken, updateUserWithToken } from '../services/adminService'
import { extractRoleNames } from '../utils/permissions'

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function getTokenFromLoginResponse(data: any): string | undefined {
  const token = data?.token ?? data?.accessToken ?? data?.access_token ?? data?.AccessToken
  return typeof token === 'string' && token.trim() ? token : undefined
}

function extractRolesFromLoginResponse(data: any): string[] {
  const directRoles = extractRoleNames(data?.user)
  const token = getTokenFromLoginResponse(data)
  if (!token || token.split('.').length !== 3) return Array.from(new Set(directRoles))

  const payload = decodeJwtPayload(token)
  const tokenRoles = payload
    ? extractRoleNames([
        payload.role_name,
        payload.roleName,
        payload.userRoles,
        payload.UserRoles,
        payload.roles,
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
      ])
    : []

  return Array.from(new Set([...directRoles, ...tokenRoles]))
}

function hasPasswordResetOverrideRole(roles: string[]): boolean {
  return extractRoleNames(roles).some(role =>
    role === 'OWNER'
    || /\bOWNER\b/.test(role)
    || role === 'ADMIN'
    || role === 'ADMINISTRATOR'
    || role === 'SYSTEM ADMINISTRATOR'
    || /\bADMIN\b/.test(role)
    || /\bADMINISTRATOR\b/.test(role)
  )
}

function getUserIdFromLoginResponse(data: any): number | undefined {
  const directCandidate = data?.user?.id ?? data?.user?.userId ?? data?.user?.user_id ?? data?.user?.Id ?? data?.user?.sub
  let parsed = Number(directCandidate)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  const token = getTokenFromLoginResponse(data)
  if (!token || token.split('.').length !== 3) return undefined
  const payload = decodeJwtPayload(token)
  const tokenCandidate =
    payload?.sub
    ?? payload?.userId
    ?? payload?.user_id
    ?? payload?.id
    ?? payload?.nameid
    ?? payload?.name_id
    ?? payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
  parsed = Number(tokenCandidate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function pickValue(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function stringOrNull(value: any) {
  if (value === undefined || value === null) return null
  return String(value)
}

function toPositiveNumber(value: any): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeBirthdayValue(value: any) {
  if (!value) return null
  const raw = String(value)
  if (raw.startsWith('1753-01-01') || raw.startsWith('0001-01-01')) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return raw.includes('T') ? raw.slice(0, 10) : raw
}

function genderToInt(value: any): number | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = String(value).trim().toLowerCase()
  if (/^[0-9]+$/.test(normalized)) return Number(normalized)
  if (normalized === 'male') return 0
  if (normalized === 'female') return 1
  if (normalized === 'other') return 2
  return null
}

function resolveIsActive(user: any): boolean | undefined {
  const explicit = pickValue(user, ['isActive', 'IsActive'])
  if (explicit !== undefined) return Boolean(explicit)
  const status = pickValue(user, ['status', 'Status'])
  if (status === undefined) return undefined
  return String(status).trim().toLowerCase() === 'active'
}

function extractRoleIds(user: any, roleId?: number) {
  const rawRoles = pickValue(user, ['roles', 'userRoles', 'Roles', 'roleIds', 'RoleIds'])
  if (!Array.isArray(rawRoles)) return undefined

  const ids = rawRoles
    .map(role => {
      if (role && typeof role === 'object') return pickValue(role, ['id', 'Id', 'ID', 'roleId', 'RoleId'])
      return role
    })
    .map(toPositiveNumber)
    .filter((id): id is number => typeof id === 'number')

  if (roleId && ids.length > 0 && !ids.includes(roleId)) ids.unshift(roleId)
  return Array.from(new Set(ids))
}

function getUserId(user: any): number | undefined {
  return toPositiveNumber(pickValue(user, ['id', 'Id', 'ID', 'userId', 'UserId']))
}

function buildUserUpdatePayload(user: any, resetEmail: string, newPassword: string, actorUserId?: number) {
  const roleId = toPositiveNumber(pickValue(user, ['roleId', 'RoleId', 'primaryRole', 'PrimaryRole', 'primaryRoleId', 'PrimaryRoleId']))
  const roleIds = extractRoleIds(user, roleId)
  const gender = genderToInt(pickValue(user, ['gender', 'Gender', 'sex', 'Sex']))
  const birthday = normalizeBirthdayValue(pickValue(user, ['birthday', 'Birthday', 'dateOfBirth', 'DateOfBirth', 'dob', 'Dob']))
  const isActive = resolveIsActive(user)

  const payload: Record<string, any> = {
    email: stringOrNull(pickValue(user, ['email', 'Email', 'emailAddress', 'EmailAddress'])) || resetEmail,
    firstname: stringOrNull(pickValue(user, ['firstName', 'firstname', 'Firstname', 'FirstName', 'first_name', 'fname', 'FName'])),
    middleName: stringOrNull(pickValue(user, ['middleName', 'MiddleName', 'middle_name', 'mname', 'MName'])),
    lastName: stringOrNull(pickValue(user, ['lastName', 'LastName', 'last_name', 'lname', 'LName'])),
    mobileNumber: stringOrNull(pickValue(user, ['mobileNumber', 'MobileNumber', 'mobile', 'Mobile', 'phone', 'Phone'])),
    address: stringOrNull(pickValue(user, ['address', 'Address', 'addr', 'Addr'])),
    password: newPassword,
  }

  if (roleId !== undefined) payload.roleId = roleId
  if (roleIds && roleIds.length > 0) payload.roles = roleIds
  if (gender !== null) payload.gender = gender
  if (birthday) payload.birthday = birthday
  if (typeof isActive === 'boolean') payload.isActive = isActive
  if (actorUserId) payload.updatedById = actorUserId

  return payload
}

export default function ForgotPassword(){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideUsername, setOverrideUsername] = useState('')
  const [overridePassword, setOverridePassword] = useState('')

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const resetEmail = email.trim()
    if (!resetEmail) { showToast('Please enter your email address', 'error'); return }
    if (!password) { showToast('Please enter a new password', 'error'); return }
    if (password !== confirm) { showToast('Passwords do not match', 'error'); return }

    setOverrideUsername('')
    setOverridePassword('')
    setShowOverrideModal(true)
  }

  async function confirmOverrideAndSave() {
    if (!overrideUsername.trim() || !overridePassword) {
      showToast('Please enter administrator or owner credentials', 'error')
      return
    }

    setLoading(true)
    try {
      const loginResult = await loginService({ email: overrideUsername.trim(), password: overridePassword })
      const roles = extractRolesFromLoginResponse(loginResult)
      if (!hasPasswordResetOverrideRole(roles)) {
        throw new Error('Only administrators and owners can reset passwords.')
      }

      const token = getTokenFromLoginResponse(loginResult)
      if (!token) throw new Error('Unable to verify administrator or owner permissions.')

      const resetEmail = email.trim()
      const user = await getUserByEmailWithToken(resetEmail, token)
      if (!user) throw new Error('No user account was found for this email address.')

      const userId = getUserId(user)
      if (!userId) throw new Error('The selected user account could not be updated.')

      const payload = buildUserUpdatePayload(user, resetEmail, password, getUserIdFromLoginResponse(loginResult))
      await updateUserWithToken(userId, payload, token)

      showToast('Password updated successfully', 'success')
      setShowOverrideModal(false)
      setOverrideUsername('')
      setOverridePassword('')
      setPassword('')
      setConfirm('')
      navigate('/login')
    } catch (error: any) {
      showToast(error?.message || 'Failed to save the new password', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Reset your password</div>
          <div className="text-sm text-slate-500 dark:text-slate-300">Enter your email and choose a new password.</div>
        </div>

        <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">Email address</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} disabled={loading} autoComplete="off" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" className="mt-2 w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 placeholder-slate-400" placeholder="you@example.com" />
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">New password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} type="password" autoComplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" className="mt-2 w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 placeholder-slate-400" placeholder="New password" />
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">Confirm password</label>
            <input value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={loading} type="password" autoComplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" className="mt-2 w-full px-3 py-2 rounded-md bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 placeholder-slate-400" placeholder="Confirm password" />
          </div>

          <div>
            <button type="submit" disabled={loading} className="w-full py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>

    {showOverrideModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="forgot-password-override-title">
        <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setShowOverrideModal(false)} />
        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800">
          <div className="border-b bg-gray-100 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div id="forgot-password-override-title" className="text-sm font-semibold text-slate-700 dark:text-slate-100">Admin Verification Required</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Enter administrator or owner credentials to reset this password.</div>
          </div>
          <form onSubmit={e => { e.preventDefault(); confirmOverrideAndSave() }}>
            <div className="space-y-4 p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Username</label>
                <input
                  type="text"
                  value={overrideUsername}
                  onChange={e => setOverrideUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  className="mt-2 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Enter username or email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
                <input
                  type="password"
                  value={overridePassword}
                  onChange={e => setOverridePassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  className="mt-2 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Enter password"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                disabled={loading}
                className="rounded border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-bosch-blue px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-70"
              >
                {loading ? 'Saving...' : 'Verify and Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
