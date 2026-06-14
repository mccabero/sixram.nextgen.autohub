// @ts-nocheck
export type CanonicalStatus =
  | 'OPEN'
  | 'PENDING'
  | 'CONVERTED'
  | 'COMPLETED'
  | 'CLOSED'
  | 'PAID'
  | 'VOID'
  | 'CANCELLED'
  | 'DELETED'
  | 'UNKNOWN'

export function canonicalStatus(value: unknown): CanonicalStatus {
  const text = String(value ?? '').trim().toUpperCase().replace(/[-_]+/g, ' ')
  if (!text) return 'UNKNOWN'
  if (text.includes('CANCEL')) return 'CANCELLED'
  if (text.includes('VOID')) return 'VOID'
  if (text.includes('DELETE')) return 'DELETED'
  if (text.includes('COMPLETE')) return 'COMPLETED'
  if (text.includes('CONVERT')) return 'CONVERTED'
  if (text.includes('CLOSE')) return 'CLOSED'
  if (text.includes('PAID')) return 'PAID'
  if (text.includes('PENDING')) return 'PENDING'
  if (text.includes('OPEN')) return 'OPEN'
  return 'UNKNOWN'
}

export function isOpenStatus(value: unknown): boolean {
  return canonicalStatus(value) === 'OPEN'
}

export function isTerminalStatus(value: unknown): boolean {
  return ['COMPLETED', 'CLOSED', 'PAID', 'VOID', 'CANCELLED', 'DELETED'].includes(canonicalStatus(value))
}

export function isInventoryAffectingStatus(value: unknown): boolean {
  const status = canonicalStatus(value)
  return status !== 'VOID' && status !== 'CANCELLED' && status !== 'DELETED'
}

export function canConvertFromStatus(value: unknown): boolean {
  return canonicalStatus(value) === 'OPEN'
}

export function canVoidStatus(value: unknown): boolean {
  return !['VOID', 'CANCELLED', 'DELETED'].includes(canonicalStatus(value))
}
