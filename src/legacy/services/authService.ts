// @ts-nocheck
import { API } from '../config/api'

const SERVER_UNAVAILABLE_MESSAGE = 'Server not available. Please refresh and sign in again.'

type LoginPayload = {
  email?: string
  password?: string
  pin?: string
}

type LoginResponse = {
  token?: string
  user?: any
  message?: string
}

type ForgotPinPayload = {
  username: string
  password: string
  newPin: string
  confirmPin: string
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const url = `${API.BASE_URL}/login`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const body = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      // server errors -> friendly message; client errors -> preserve backend message
      if (resp.status >= 500) {
        throw new Error(SERVER_UNAVAILABLE_MESSAGE)
      }
      const message = (body && (body.message || body.error)) || resp.statusText || 'Login failed'
      const err = new Error(message)
      ;(err as any).status = resp.status
      throw err
    }

    // Normalize backend token/user field names so callers always receive `token` and `user` where possible
    const token = (body && (body.token || body.accessToken || body.access_token || body.AccessToken)) || null
    const user = (body && (body.user || body.userDto || body.userdto)) || null

    const normalized: LoginResponse = {
      token: token || undefined,
      user: user || undefined,
      message: undefined
    }

    return normalized
  } catch (err: any) {
    // Network / fetch errors are typically TypeError; show friendly message.
    if (err instanceof TypeError) {
      throw new Error(SERVER_UNAVAILABLE_MESSAGE)
    }
    throw new Error(err?.message || SERVER_UNAVAILABLE_MESSAGE)
  }
}

export async function forgotPin(payload: ForgotPinPayload): Promise<void> {
  const url = `${API.BASE_URL}/forgot-pin`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Override-Auth': 'true' },
      body: JSON.stringify(payload)
    })

    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      if (resp.status >= 500) {
        throw new Error(SERVER_UNAVAILABLE_MESSAGE)
      }
      const message = (body && (body.message || body.error)) || resp.statusText || 'Failed to reset PIN'
      throw new Error(message)
    }
  } catch (err: any) {
    if (err instanceof TypeError) {
      throw new Error(SERVER_UNAVAILABLE_MESSAGE)
    }
    throw new Error(err?.message || SERVER_UNAVAILABLE_MESSAGE)
  }
}
