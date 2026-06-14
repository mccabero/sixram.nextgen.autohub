// @ts-nocheck
interface UserLike {
  id?: unknown
  userId?: unknown
  user_id?: unknown
  Id?: unknown
  sub?: unknown
}

export default function getCurrentUserId(user?: UserLike): number | undefined {
  const candidate = user?.id ?? user?.userId ?? user?.user_id ?? user?.Id ?? user?.sub
  let n = Number(candidate)
  if (Number.isFinite(n) && n > 0) return n

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (token && token.split('.').length === 3) {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      const pid = (payload as any)?.sub ?? (payload as any)?.userId ?? (payload as any)?.user_id ?? (payload as any)?.id ?? (payload as any)?.nameid ?? (payload as any)?.name_id
      n = Number(pid)
      if (Number.isFinite(n) && n > 0) return n
    }
  } catch (e) {
    // ignore decode errors
  }

  return undefined
}
