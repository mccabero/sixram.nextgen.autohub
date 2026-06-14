// @ts-nocheck
import { useEffect, useState } from 'react'
import { getEffectivePermissions } from '../services/adminService'
import {
  EFFECTIVE_PERMISSIONS_UPDATED_EVENT,
  getCachedEffectivePermissionKeys,
  hasPermissionKey,
} from '../utils/effectivePermissions'

let pendingPermissionLoad: Promise<string[]> | null = null

function hasAuthToken() {
  if (typeof window === 'undefined') return false
  try {
    return !!window.localStorage.getItem('auth_token')
  } catch {
    return false
  }
}

function loadEffectivePermissionsOnce() {
  if (!pendingPermissionLoad) {
    pendingPermissionLoad = getEffectivePermissions().finally(() => {
      pendingPermissionLoad = null
    })
  }
  return pendingPermissionLoad
}

export function useEffectivePermissionKey(permissionKey: string) {
  const [allowed, setAllowed] = useState(() => hasAuthToken() && hasPermissionKey(getCachedEffectivePermissionKeys(), permissionKey))

  useEffect(() => {
    let mounted = true

    const syncFromCache = () => {
      if (mounted) setAllowed(hasPermissionKey(getCachedEffectivePermissionKeys(), permissionKey))
    }

    window.addEventListener(EFFECTIVE_PERMISSIONS_UPDATED_EVENT, syncFromCache)

    if (!hasAuthToken()) {
      setAllowed(false)
      return () => {
        mounted = false
        window.removeEventListener(EFFECTIVE_PERMISSIONS_UPDATED_EVENT, syncFromCache)
      }
    }

    loadEffectivePermissionsOnce()
      .then(keys => {
        if (mounted) setAllowed(hasPermissionKey(keys, permissionKey))
      })
      .catch(() => {
        if (mounted) setAllowed(false)
      })

    return () => {
      mounted = false
      window.removeEventListener(EFFECTIVE_PERMISSIONS_UPDATED_EVENT, syncFromCache)
    }
  }, [permissionKey])

  return allowed
}
