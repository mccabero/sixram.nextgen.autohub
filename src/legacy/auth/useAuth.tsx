// @ts-nocheck
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Role, Roles } from './roles'
import { extractRoleNames, isAdminRole, isStaffRole } from '../utils/permissions'
import { clearEffectivePermissionKeys } from '../utils/effectivePermissions'

const AUTO_LOGOUT_MS = 5 * 60 * 1000
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
const SERVER_UNAVAILABLE_MESSAGE = 'Server not available. Please refresh and sign in again.'

type AuthUser = {
  name: string | null
  given_name: string | null
  family_name: string | null
  email: string | null
  role: Role | string | null
  userRoles?: string[]
  [key: string]: unknown
}

// normalize role values from tokens or persisted users
const normalizeRole = (r: any) => {
  const roles = extractRoleNames(r)
  if (roles.some(role => isAdminRole(role))) return Roles.ADMIN
  if (roles.some(role => isStaffRole(role))) return Roles.STAFF
  return roles[0] ?? null
}

const normalizeAuthUser = (u: AuthUser): AuthUser => {
  const userRoles = extractRoleNames(u)
  const normalizedRole = normalizeRole(userRoles.length ? userRoles : u.role)
  return {
    ...u,
    role: normalizedRole,
    userRoles: userRoles.length ? userRoles : (normalizedRole ? [normalizedRole] : []),
  }
}

type AuthContext = {
  isAuthenticated: boolean
  role: Role
  userRoles: string[]
  user: AuthUser | null
  login: (token: string, user?: AuthUser) => void
  logout: () => void
}

const AUTH_CONTEXT_KEY = '__sixram_nextgen_auth_context__'

const ctx = (() => {
  const store = globalThis as typeof globalThis & { [AUTH_CONTEXT_KEY]?: React.Context<AuthContext | null> }
  if (!store[AUTH_CONTEXT_KEY]) store[AUTH_CONTEXT_KEY] = createContext<AuthContext | null>(null)
  return store[AUTH_CONTEXT_KEY]
})()

function readStoredAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('auth_user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed ? normalizeAuthUser(parsed) : null
  } catch {
    return null
  }
}

function fallbackLogout() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  } catch {}
  clearEffectivePermissionKeys()
}

function fallbackLogin(token: string, user?: AuthUser) {
  try {
    localStorage.setItem('auth_token', token)
    if (user) localStorage.setItem('auth_user', JSON.stringify(normalizeAuthUser(user)))
  } catch {}
}

function fallbackAuthContext(): AuthContext {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('auth_token') : null
  const user = readStoredAuthUser()
  const derivedUserRoles = user ? extractRoleNames(user) : []
  const role: Role = (user && (normalizeRole(derivedUserRoles.length ? derivedUserRoles : user.role) as Role)) || (token ? Roles.ADMIN : Roles.GUEST)
  const userRoles = derivedUserRoles.length ? derivedUserRoles : [role]

  return {
    isAuthenticated: !!token,
    role,
    userRoles,
    user,
    login: fallbackLogin,
    logout: fallbackLogout,
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const v = localStorage.getItem('auth_user')
    if (!v) return null
    try {
      const parsed = JSON.parse(v)
      return parsed ? normalizeAuthUser(parsed) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!token) return

    let timeoutId: ReturnType<typeof window.setTimeout> | null = null

    const clearIdleTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const handleAutoLogout = () => {
      try {
        localStorage.setItem('logout_reason', JSON.stringify({
          status: 'inactive',
          message: 'You were logged out after 5 minutes of inactivity. Please sign in again.',
        }))
      } catch {}
      logout()
      const path = window.location?.pathname ?? ''
      if (path !== '/login' && !path.startsWith('/login')) window.location.href = '/login'
    }

    const resetIdleTimer = () => {
      clearIdleTimer()
      timeoutId = window.setTimeout(handleAutoLogout, AUTO_LOGOUT_MS)
    }

    ACTIVITY_EVENTS.forEach(eventName => window.addEventListener(eventName, resetIdleTimer, { passive: true }))
    resetIdleTimer()

    return () => {
      clearIdleTimer()
      ACTIVITY_EVENTS.forEach(eventName => window.removeEventListener(eventName, resetIdleTimer))
    }
  }, [token])

  useEffect(() => {
    try {
      if (token) localStorage.setItem('auth_token', token)
      else localStorage.removeItem('auth_token')
    } catch {}
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user))
    else localStorage.removeItem('auth_user')
  }, [user])

  // If there's a token stored but no user, attempt to decode the JWT on mount
  useEffect(() => {
    if (!user && token) {
      try {
        if (token && token.split('.').length === 3) {
          // reuse login's decoding logic by calling login with the token
          login(token)
        }
      } catch (e) {
        // ignore
      }
    }
  }, [token, user])

  // Validate token on mount/refresh: check exp if JWT, otherwise hit validation endpoint
  useEffect(() => {
    let mounted = true
    const validate = async () => {
      if (!token) return
      try {
        if (token.split('.').length === 3) {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload && payload.exp) {
            const now = Math.floor(Date.now() / 1000)
            // consider token expired if within 30 seconds of expiry
            if (now > (payload.exp - 30)) {
              try { logout() } catch {}
              if (mounted) window.location.href = '/login'
              return
            }
            // not expired, nothing to do
            return
          }
        }

        // If token is not a JWT or has no exp, try validating with backend
        try {
          const res = await fetch('/api/auth/validate', { headers: { Authorization: `Bearer ${token}` } })
          if (res.status === 401 || res.status === 403) {
            try { logout() } catch {}
            if (mounted) window.location.href = '/login'
            return
          }
          // other statuses (200) considered valid
        } catch (e) {
          // network errors or unreachable validation endpoint: clear session and redirect
          try {
            localStorage.setItem('logout_reason', JSON.stringify({
              status: 'network',
              message: SERVER_UNAVAILABLE_MESSAGE,
            }))
          } catch {}
          try { logout() } catch {}
          if (mounted) {
            const path = window.location && window.location.pathname ? window.location.pathname : ''
            const onLogin = path === '/login' || path.startsWith('/login')
            if (!onLogin) window.location.href = '/login'
          }
          return
        }
      } catch (e) {
        // on any parsing error, clear auth and redirect
        try { logout() } catch {}
        if (mounted) window.location.href = '/login'
      }
    }
    validate()
    return () => { mounted = false }
  }, [])

  const login = (t: string, u?: AuthUser) => {
    clearEffectivePermissionKeys()
    setToken(t)
    if (u) {
      try {
        u = normalizeAuthUser(u)
      } catch {}
      setUser(u)
      return
    }

    // If backend didn't return a user object, try to decode a JWT access token
    try {
      if (t && t.split('.').length === 3) {
        const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        // prefer explicit given_name and family_name if present
        const given = payload.given_name || payload.first_name || null
        const family = payload.family_name || payload.last_name || null
        const nameFromPayload = payload.name || payload.preferred_username || payload.unique_name || payload.email || null
        const first = given || (typeof nameFromPayload === 'string' ? nameFromPayload.split(' ')[0] : null) || null
        const last = family || (typeof nameFromPayload === 'string' ? nameFromPayload.split(' ').slice(-1)[0] : null) || null
        const displayName = [first, last].filter(Boolean).join(' ')
        const email = payload.email || payload.unique_name || null
        const roleNames = extractRoleNames({
          role: payload.role,
          roles: payload.roles,
          roleName: payload.roleName ?? payload.role_name,
          userRoles: payload.userRoles ?? payload.UserRoles,
        })
        const inferredRole = normalizeRole(roleNames)
        const inferredUser = { name: displayName || nameFromPayload, given_name: first, family_name: last, email, role: inferredRole, userRoles: roleNames }
        setUser(inferredUser)
        return
      }
    } catch (e) {
      // ignore decode errors
    }
  }

  const logout = () => {
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    } catch {}
    clearEffectivePermissionKeys()
    setToken(null)
    setUser(null)
  }

  const derivedUserRoles = user ? extractRoleNames(user) : []
  const role: Role = (user && (normalizeRole(derivedUserRoles.length ? derivedUserRoles : user.role) as Role)) || (token ? Roles.ADMIN : Roles.GUEST)
  const userRoles = derivedUserRoles.length ? derivedUserRoles : [role]

  return (
    <ctx.Provider value={{ isAuthenticated: !!token, role, userRoles, user, login, logout }}>{children}</ctx.Provider>
  )
}

export function useAuth() {
  const c = useContext(ctx)
  return c ?? fallbackAuthContext()
}
