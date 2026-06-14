// @ts-nocheck
import React from 'react'

type ComponentModule<T extends React.ComponentType<any>> = { default: T }
type RecoveryAttempt = { route: string; at: number }

const RECOVERY_STORAGE_KEY = 'sixram.nextgen.chunk-load-recovery'
const RECOVERY_QUERY_PARAM = '__app_refresh'
const RECOVERY_WINDOW_MS = 5 * 60 * 1000

function canUseBrowserNavigation() {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined'
}

function getErrorText(error: unknown) {
  if (error instanceof Error) return `${error.name} ${error.message}`
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

export function isChunkLoadError(error: unknown) {
  const message = getErrorText(error)

  return /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS/i.test(message)
}

function getRouteKey() {
  const url = new URL(window.location.href)
  url.searchParams.delete(RECOVERY_QUERY_PARAM)
  return `${url.pathname}${url.search}${url.hash}`
}

function readRecoveryAttempt(): RecoveryAttempt | null {
  try {
    const raw = window.sessionStorage.getItem(RECOVERY_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<RecoveryAttempt>
    if (typeof parsed.route !== 'string' || typeof parsed.at !== 'number') return null

    return { route: parsed.route, at: parsed.at }
  } catch {
    return null
  }
}

function removeRecoveryParamFromAddressBar() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(RECOVERY_QUERY_PARAM)) return

    url.searchParams.delete(RECOVERY_QUERY_PARAM)
    window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`)
  } catch {
    // The URL cleanup is cosmetic. Recovery should not depend on it.
  }
}

export function clearChunkLoadRecoveryAttempt() {
  if (!canUseBrowserNavigation()) return

  try {
    window.sessionStorage.removeItem(RECOVERY_STORAGE_KEY)
  } catch {
    // Ignore storage failures in private or locked-down browser contexts.
  }

  removeRecoveryParamFromAddressBar()
}

export function requestChunkLoadRecovery(error?: unknown) {
  if (!canUseBrowserNavigation()) return false
  if (error !== undefined && !isChunkLoadError(error)) return false

  const now = Date.now()
  const nextUrl = new URL(window.location.href)
  const alreadyReloadedWithCacheBuster = nextUrl.searchParams.has(RECOVERY_QUERY_PARAM)
  const route = getRouteKey()
  const previousAttempt = readRecoveryAttempt()
  const alreadyTriedRecently = previousAttempt?.route === route && now - previousAttempt.at < RECOVERY_WINDOW_MS

  if (alreadyReloadedWithCacheBuster || alreadyTriedRecently) return false

  try {
    window.sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ route, at: now }))
  } catch {
    // The cache-busting URL param below still prevents reload loops if storage is unavailable.
  }

  try {
    nextUrl.searchParams.set(RECOVERY_QUERY_PARAM, String(now))
    window.location.replace(nextUrl.toString())
    return true
  } catch {
    window.location.reload()
    return true
  }
}

export function setupChunkLoadRecovery() {
  if (!canUseBrowserNavigation()) return

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    requestChunkLoadRecovery()
  })
}

export function lazyWithReload<T extends React.ComponentType<any>>(loader: () => Promise<ComponentModule<T>>) {
  return React.lazy(async () => {
    try {
      const loadedModule = await loader()
      clearChunkLoadRecoveryAttempt()
      return loadedModule
    } catch (error) {
      if (requestChunkLoadRecovery(error)) {
        return new Promise<ComponentModule<T>>(() => {})
      }

      throw error
    }
  })
}
