// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { checkPageAccess, getEffectivePermissions } from '../services/adminService'
import { findFirstAccessiblePath } from '../navigation/menu'

type AccessState = 'checking' | 'allowed' | 'denied' | 'error'

export default function PageAccessGuard() {
  const location = useLocation()
  const [state, setState] = useState<AccessState>('checking')
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setState('checking')
    setRedirectTo(null)

    const resolveDeniedRedirect = async () => {
      try {
        const permissionKeys = await getEffectivePermissions()
        const nextPath = findFirstAccessiblePath(permissionKeys)
        if (!mounted) return
        if (nextPath && nextPath !== location.pathname) {
          setRedirectTo(nextPath)
        }
      } catch {
        // keep denied state below
      }
    }

    checkPageAccess(location.pathname)
      .then(async result => {
        if (!mounted) return
        if (result.allowed) {
          setState('allowed')
          return
        }

        await resolveDeniedRedirect()
        if (mounted) setState('denied')
      })
      .catch(() => {
        if (mounted) setState('error')
      })

    return () => { mounted = false }
  }, [location.pathname])

  if (state === 'checking') {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Checking access...</div>
  }

  if (state === 'allowed') return <Outlet />

  if (redirectTo) return <Navigate to={redirectTo} replace />

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
      You are not authorized to access this page.
    </div>
  )
}
