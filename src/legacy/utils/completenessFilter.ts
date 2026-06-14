// @ts-nocheck
export type CompletenessFilterKey = 'ALL' | 'COMPLETE' | 'NEEDS_REVIEW'

export function hasValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function filterByCompleteness<T>(
  rows: T[],
  filter: CompletenessFilterKey,
  isComplete: (row: T) => boolean,
): T[] {
  if (filter === 'ALL') return rows
  return rows.filter(row => filter === 'COMPLETE' ? isComplete(row) : !isComplete(row))
}

export function buildCompletenessFilterOptions<T>(
  rows: T[],
  isComplete: (row: T) => boolean,
) {
  const completeCount = rows.filter(isComplete).length
  const needsReviewCount = rows.length - completeCount

  return [
    { key: 'ALL' as const, label: 'All', count: rows.length },
    { key: 'COMPLETE' as const, label: 'Complete', count: completeCount, activeClass: 'bg-emerald-500 text-white' },
    { key: 'NEEDS_REVIEW' as const, label: 'Needs Review', count: needsReviewCount, activeClass: 'bg-amber-500 text-white' },
  ]
}
