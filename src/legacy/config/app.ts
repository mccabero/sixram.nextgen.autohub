// @ts-nocheck
import pkg from '../../../package.json'
import buildInfo from './build.json'

const buildNumber = String((buildInfo as { buildNumber?: number } | undefined)?.buildNumber ?? 0)

const baseVersion = (pkg as { version?: string })?.version ?? '0.0.0'
const [, minor = '0', patch = '0'] = baseVersion.split('.')
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''

function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return browserOrigin
}

export const APP = {
  COPYRIGHT_YEAR: 2026,
  COMPANY: 'Sixram Technologies Inc.',
  VERSION: `2.${minor}.${patch}.${buildNumber}`,
  BUILD_NUMBER: buildNumber,
  // Default to the current frontend origin so IIS can reverse-proxy /api requests
  // to the backend site. Override with VITE_API_BASE_URL only when needed.
  API_BASE_URL: resolveApiBaseUrl()
}
