// @ts-nocheck
import { useEffect, useState } from 'react'
import { getLoginSettings } from '../services/adminService'

const LOGIN_SETTINGS_UPDATED_EVENT = 'login-settings-updated'

function parseBooleanSetting(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

export function useShowIsChanganOption() {
  const [showIsChanganOption, setShowIsChanganOption] = useState(true)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const data: any = await getLoginSettings()
        if (!mounted) return
        setShowIsChanganOption(parseBooleanSetting(data?.showIsChanganOption))
      } catch {
        if (!mounted) return
        setShowIsChanganOption(true)
      }
    })()

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ showIsChanganOption?: unknown }>).detail
      if (!mounted || !detail || !Object.prototype.hasOwnProperty.call(detail, 'showIsChanganOption')) return
      setShowIsChanganOption(parseBooleanSetting(detail.showIsChanganOption))
    }

    window.addEventListener(LOGIN_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)

    return () => {
      mounted = false
      window.removeEventListener(LOGIN_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)
    }
  }, [])

  return showIsChanganOption
}
