// @ts-nocheck
// Global fetch wrapper: attaches auth header and clears session on API unavailability
import { APP } from './app'
import { clearEffectivePermissionKeys } from '../utils/effectivePermissions'

const _origFetch = (window as any).fetch.bind(window)
import { increment as _loadingIncrement, decrement as _loadingDecrement } from './loadingManager'

const SERVER_UNAVAILABLE_MESSAGE = 'Server not available. Please refresh and sign in again.'

function clearSessionAndRedirect() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    clearEffectivePermissionKeys()
  } catch {}
  try {
    const path = window.location && window.location.pathname ? window.location.pathname : ''
    const onLogin = path === '/login' || path.startsWith('/login')
    if (!onLogin) window.location.href = '/login'
  } catch {}
}

function requestUrl(input: RequestInfo): string {
  if (typeof input === 'string') return input
  try {
    return input instanceof Request ? input.url : ''
  } catch {
    return ''
  }
}

function isAuthLoginRequest(input: RequestInfo): boolean {
  const raw = requestUrl(input)
  if (!raw) return false
  try {
    const url = new URL(raw, window.location.origin)
    return url.pathname.replace(/\/+/g, '/').toLowerCase() === '/api/auth/login'
  } catch {
    return /\/api\/auth\/login(?:[?#]|$)/i.test(raw)
  }
}

function normalizeLegacyApiPath(raw: string): string {
  try {
    const url = new URL(raw, window.location.origin)
    url.pathname = url.pathname
      .replace(/^\/api\/Auth(?=\/|$)/, '/api/auth')
      .replace(/^\/api\/Vehicles(?=\/|$)/, '/api/vehicles')

    if (/^https?:\/\//i.test(raw)) return url.toString()
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return raw
      .replace(/\/api\/Auth(?=\/|$)/, '/api/auth')
      .replace(/\/api\/Vehicles(?=\/|$)/, '/api/vehicles')
  }
}

async function wrappedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const isLoginRequest = isAuthLoginRequest(input)
  const token = (() => { try { return localStorage.getItem('auth_token') } catch { return null } })()
  const headers = new Headers(init && init.headers ? init.headers as HeadersInit : undefined)
  const isOverrideAuthRequest = headers.get('X-Override-Auth') === 'true'
  if (isOverrideAuthRequest) headers.delete('X-Override-Auth')
  const hasExplicitAuthorization = headers.has('Authorization')
  
  function getCurrentUserId(): string | null {
    try {
      const raw = localStorage.getItem('auth_user')
      if (!raw) return null
      const u = JSON.parse(raw)
      const id = u?.id ?? u?.Id ?? u?.userId ?? u?.user_id ?? u?.uid
      if (id === undefined || id === null) return null
      return String(id)
    } catch {
      return null
    }
  }
  if (token && !isLoginRequest && !hasExplicitAuthorization) headers.set('Authorization', `Bearer ${token}`)

  const newInit: RequestInit = { ...(init || {}), headers }
  // attach current user id to POST/PUT requests so backend can set createdBy/updatedBy
  try {
    const method = (newInit.method || 'GET').toString().toUpperCase()
    if (!isLoginRequest && !hasExplicitAuthorization && (method === 'POST' || method === 'PUT')) {
      const uid = getCurrentUserId()
      if (uid) headers.set('X-User-Id', uid)
    }
  } catch {}

  try {
    // rewrite legacy operations queries like `/api/operations?type=inspection`
    let resolvedInput: RequestInfo = input
    try {
      if (typeof input === 'string') {
        let str = input as string
        if (str.startsWith('/api') && APP.API_BASE_URL) {
          str = `${APP.API_BASE_URL}${str}`
        }
        str = normalizeLegacyApiPath(str)
        // only handle local api paths
        if (str.startsWith('/api/operations') || str.startsWith(`${APP.API_BASE_URL}/api/operations`)) {
          const idx = str.indexOf('?')
          const base = idx === -1 ? str : str.slice(0, idx)
          const qs = idx === -1 ? '' : str.slice(idx + 1)
          const operationsBases = new Set(['/api/operations', `${APP.API_BASE_URL}/api/operations`])
          if (operationsBases.has(base) && qs) {
            const params = new URLSearchParams(qs)
            const t = (params.get('type') || '').toLowerCase()
            const map: Record<string, string> = {
              'inspection': 'inspections',
              'estimate': 'estimates',
              'job-order': 'joborders',
              'joborder': 'joborders',
              'joborders': 'joborders',
              'invoice': 'invoices',
              'deposit': 'deposits',
              'payment': 'payments',
              'quick-sales': 'quicksales',
              'quicksales': 'quicksales',
              'expenses': 'expenses',
              'pettycash': 'pettycashvouchers',
              'petty-cash': 'pettycashvouchers',
              'pettycashvouchers': 'pettycashvouchers'
            }
            const mapped = map[t]
            if (mapped) {
              params.delete('type')
              const suffix = params.toString()
              const rewritten = suffix ? `/api/operations/${mapped}?${suffix}` : `/api/operations/${mapped}`
              resolvedInput = APP.API_BASE_URL ? `${APP.API_BASE_URL}${rewritten}` : rewritten
            }
            else {
              resolvedInput = str
            }
          }
          else {
            resolvedInput = str
          }
        }
        else {
          resolvedInput = str
        }
      }
    } catch (e) {
      // if mapping fails, fall back to original input
      resolvedInput = input
    }

    // Determine if the caller passed an AbortSignal either in init or inside a Request object.
    const providedSignal = (newInit as any)?.signal ?? (
      (typeof Request !== 'undefined' && input instanceof Request) ? (input as Request).signal : undefined
    )

    // If the provided signal is already aborted, do not increment loading nor call fetch.
    if (providedSignal && providedSignal.aborted) {
      const ae = (typeof DOMException !== 'undefined') ? new DOMException('The operation was aborted.', 'AbortError') : Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
      throw ae
    }

    try{ _loadingIncrement() }catch{}

    const res = await _origFetch(resolvedInput, newInit)

    // Clear session only for true authentication failures.
    // A 403 means the user is signed in but not allowed to perform that action.
    if (res.status === 401) {
      try{ _loadingDecrement() }catch{}
      if (isLoginRequest || isOverrideAuthRequest) return res
      console.warn('[fetchWrapper] auth failure, clearing session', { url: input, status: res.status })
      clearSessionAndRedirect()
      return res
    }

    if (res.status === 403) {
      try{ _loadingDecrement() }catch{}
      return res
    }

    // Server errors are not authentication failures; keep the session intact so
    // the page can show the actual failing action to the user.
    if (res.status >= 500 && res.status < 600) {
      try{ _loadingDecrement() }catch{}
      if (isLoginRequest || isOverrideAuthRequest) return res
      console.warn('[fetchWrapper] server error (5xx), keeping session', { url: input, status: res.status })
      return res
    }

    try{ _loadingDecrement() }catch{}
    return res
  } catch (e: any) {
    // Ignore AbortError cancellations from AbortController to avoid noisy logs.
    const isAbort =
      (e && (e.name === 'AbortError')) ||
      (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError')
    if (isAbort) {
      // Let callers handle AbortError; rethrow without logging.
      try{ _loadingDecrement() }catch{}
      throw e
    }
    // network error / endpoint unreachable
    const msg = (e && (e.message || '') || '').toString()
    const isConnRefused = msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('ECONNREFUSED') || msg.toLowerCase().includes('connection refused') || msg.toLowerCase().includes('failed to fetch')
    if (isConnRefused) {
      if (isLoginRequest || isOverrideAuthRequest) {
        try{ _loadingDecrement() }catch{}
        throw e
      }
      try{ localStorage.setItem('logout_reason', JSON.stringify({ status: 'network', message: SERVER_UNAVAILABLE_MESSAGE })) }catch{}
      try{ _loadingDecrement() }catch{}
      console.warn('[fetchWrapper] network error (connection refused), clearing session', { url: input, error: e })
      clearSessionAndRedirect()
      throw e
    }
    console.warn('[fetchWrapper] network error, not auto-logging out', { url: input, error: e })
    // Do not clear session on other transient network errors to avoid logging out user during navigation.
    try{ _loadingDecrement() }catch{}
    throw e
  }
}

(window as any).fetch = wrappedFetch
