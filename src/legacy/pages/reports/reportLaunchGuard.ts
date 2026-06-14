// @ts-nocheck
const RECENT_REPORT_LAUNCH_WINDOW_MS = 2000

const recentReportLaunches = new Map<string, number>()

export function claimRecentReportLaunch(key: string) {
  const now = Date.now()
  const lastLaunchedAt = recentReportLaunches.get(key) ?? 0

  if (now - lastLaunchedAt < RECENT_REPORT_LAUNCH_WINDOW_MS) {
    return false
  }

  recentReportLaunches.set(key, now)
  return true
}
