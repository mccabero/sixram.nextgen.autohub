// @ts-nocheck
export type InventoryVarianceTone = 'balanced' | 'surplus' | 'shortage'

export function calculateInventoryVariance(systemQuantity: number, physicalQuantity: number): number {
  const system = Number.isFinite(systemQuantity) ? systemQuantity : 0
  const physical = Number.isFinite(physicalQuantity) ? physicalQuantity : 0
  return Number((physical - system).toFixed(2))
}

export function inventoryVarianceTone(variance: number): InventoryVarianceTone {
  if (variance > 0) return 'surplus'
  if (variance < 0) return 'shortage'
  return 'balanced'
}

export function inventoryVarianceLabel(variance: number): string {
  const tone = inventoryVarianceTone(variance)
  if (tone === 'surplus') return 'Surplus'
  if (tone === 'shortage') return 'Shortage'
  return 'Balanced'
}

