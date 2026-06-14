// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginService } from '../services/authService'
import { useAuth } from '../auth/useAuth'
import { Wrench } from 'lucide-react'
import { getEffectivePermissions } from '../services/adminService'
import { findFirstAccessiblePath } from '../navigation/menu'
import MaskedPinInput, { createEmptyPinDigits } from '../components/ui/MaskedPinInput'

const SERVER_UNAVAILABLE_MESSAGE = 'Server not available. Please refresh and sign in again.'

function isApiUnavailableResult(result: PromiseSettledResult<Response>) {
  if (result.status === 'rejected') return true
  return result.value.status >= 500
}

export default function Login() {
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [pinDigits, setPinDigits] = useState<string[]>(createEmptyPinDigits)
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('pin')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [companyName, setCompanyName] = useState('Golden Wrench Car Care')
  const [companyTag, setCompanyTag] = useState('Opc.')
  const [companyLogo, setCompanyLogo] = useState('')
  const [backgroundImage, setBackgroundImage] = useState('/login-bg.jpg')
  const { login: setAuth, logout } = useAuth()
  const lastAutoPinRef = useRef('')
  const pin = pinDigits.join('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('logout_reason')
      if (raw) {
        const obj = JSON.parse(raw)
        setError(obj && (obj.message || obj.msg || 'Session ended. Please sign in again.'))
        localStorage.removeItem('logout_reason')
      }
    } catch {}
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [companyRes, settingsRes] = await Promise.allSettled([
          fetch('/api/companyinfo'),
          fetch('/api/login-settings'),
        ])

        if (!mounted) return

        if (isApiUnavailableResult(companyRes) && isApiUnavailableResult(settingsRes)) {
          setError(SERVER_UNAVAILABLE_MESSAGE)
        }

        if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
          const data = await companyRes.value.json()
          const items = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
              ? data.items
              : Array.isArray(data?.companyInfo)
                ? data.companyInfo
                : []

          if (items.length) {
            const first = items[0] ?? {}
            const name = first.name ?? first.Name ?? first.companyName ?? first.CompanyName
            const tag = first.tagline ?? first.slogan ?? first.description ?? first.info
            const logo = first.logo ?? first.logoUrl ?? first.logoPath ?? first.Logo ?? ''
            if (name) setCompanyName(String(name))
            if (tag) setCompanyTag(String(tag))
            if (logo) setCompanyLogo(String(logo))
          }
        }

        if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
          const settings = await settingsRes.value.json()
          const customCompanyName = settings?.companyName ?? ''
          const customBackground = settings?.backgroundImageUrl ?? settings?.backgroundUrl ?? ''
          const customLogo = settings?.logoUrl ?? ''

          if (customCompanyName) setCompanyName(String(customCompanyName))
          if (customBackground) setBackgroundImage(String(customBackground))
          if (customLogo) setCompanyLogo(String(customLogo))
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  async function authenticate(mode = loginMode) {
    setError('')
    if (mode === 'pin' && !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 numbers')
      return
    }
    setLoading(true)
    logout()
    try {
      const data  = await loginService(mode === 'pin' ? { pin } : { email, password })
      const token = data && (data.token || data.accessToken || data.access_token)
      if (token) {
        setPassword('')
        setPinDigits(createEmptyPinDigits())
        lastAutoPinRef.current = ''
        setAuth(token as string, (data && data.user) || null)
        try { localStorage.setItem('auth_token', token as string) } catch {}
        let nextPath = '/dashboard'
        try {
          const permissionKeys = await getEffectivePermissions()
          nextPath = findFirstAccessiblePath(permissionKeys) ?? nextPath
        } catch {
          // keep dashboard fallback if permission bootstrap fails
        }
        setTimeout(() => navigate(nextPath), 50)
        return
      }
      setError((data && (data.message || data.error)) || 'Invalid credentials')
    } catch (err: any) {
      setError(err?.message || SERVER_UNAVAILABLE_MESSAGE)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await authenticate()
  }

  useEffect(() => {
    if (loginMode !== 'pin' || loading || !/^\d{6}$/.test(pin)) return
    if (lastAutoPinRef.current === pin) return
    lastAutoPinRef.current = pin
    void authenticate('pin')
  }, [pin, loginMode, loading])

  function updatePinDigits(digits: string[]) {
    setPinDigits(digits)
    if (!/^\d{6}$/.test(digits.join(''))) {
      lastAutoPinRef.current = ''
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${backgroundImage}')` }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Soft vignette — edges darker than centre */}
      <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent to-black/40 pointer-events-none" />

      {/* ── Login card ────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm mx-5">
        <div className="rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)]">

          {/* Card top — brand ─────────────────────────────── */}
          <div className="bg-[#1c2530]/95 backdrop-blur-sm px-8 pt-8 pb-7 text-center">
            <div className="flex items-center justify-center mb-4">
              {companyLogo ? (
                <div className="flex h-20 w-full max-w-[220px] items-center justify-center overflow-hidden">
                  <img src={companyLogo} alt={`${companyName} logo`} className="max-h-20 max-w-full object-contain drop-shadow-lg" onError={() => setCompanyLogo('')} />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-bosch-blue flex items-center justify-center shadow-lg shadow-bosch-blue/40">
                  <Wrench size={26} className="text-white" />
                </div>
              )}
            </div>
            <div className="text-white font-bold text-xl leading-tight tracking-tight">
              {companyName}
            </div>
            <div className="text-slate-500 text-sm mt-1 font-medium">{companyTag}</div>
            <div className="mt-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Card bottom — form ───────────────────────────── */}
          <div className="bg-white px-8 pt-7 pb-8">
            <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase mb-6">
              Sign in to your account
            </p>

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="inline-flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('pin')
                    setError('')
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${loginMode === 'pin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('password')
                    setError('')
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${loginMode === 'password' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Email
                </button>
              </div>

              {/* Email */}
              {loginMode === 'password' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="off"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    required
                    className="
                      w-full px-3.5 py-2.5 rounded-lg text-sm
                      border border-slate-200 bg-slate-50
                      text-slate-800 placeholder-slate-400
                      focus:outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15
                      transition-all duration-150
                    "
                  />
                </div>
              )}

              {loginMode === 'password' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  required
                  className="
                    w-full px-3.5 py-2.5 rounded-lg text-sm
                    border border-slate-200 bg-slate-50
                    text-slate-800 placeholder-slate-400
                    focus:outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15
                    transition-all duration-150
                  "
                />
              </div>
              ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 text-center">
                  Enter PIN
                </label>
                <MaskedPinInput
                  value={pinDigits}
                  onChange={updatePinDigits}
                  ariaLabelPrefix="PIN digit"
                  autoFocusFirst
                  inputClassName="
                    h-12 w-full rounded-lg border border-slate-200 bg-slate-50
                    text-center text-lg font-semibold text-slate-800
                    focus:outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15
                    transition-all duration-150
                  "
                />
              </div>
              )}

              {/* Forgot */}
              {loginMode === 'password' && (
                <div className="flex justify-start pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs text-bosch-blue hover:text-sky-500 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              {loginMode === 'pin' && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-pin')}
                    className="text-xs text-bosch-blue hover:text-sky-500 transition-colors"
                  >
                    Forgot PIN?
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                  <span className="mt-px">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="
                  w-full mt-2 py-2.5 rounded-lg
                  bg-bosch-blue hover:bg-sky-500
                  text-white text-sm font-semibold tracking-wide
                  shadow-md shadow-bosch-blue/30
                  disabled:opacity-50 transition-all duration-150
                  active:scale-[0.99]
                "
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

            </form>

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                By signing in you agree to our{' '}
                <button type="button" onClick={() => navigate('/terms-and-conditions')} className="text-bosch-blue hover:underline">
                  Terms &amp; Conditions
                </button>
                {' '}&amp;{' '}
                <button type="button" onClick={() => navigate('/privacy-policy')} className="text-bosch-blue hover:underline">
                  Privacy Policy
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Copyright below card */}
        <p className="text-center text-white/30 text-xs mt-5">
          {companyName} {companyTag} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
