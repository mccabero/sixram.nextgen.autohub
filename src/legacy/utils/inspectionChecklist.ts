// @ts-nocheck
import inspectionChecklistData from '../data/inspectionChecklist.json'

export type InspectionChecklistItem = {
  id: number
  name: string
  isRed: boolean
  isAmber: boolean
  isGreen: boolean
  remarks: string
}

export type InspectionChecklistGroup = {
  group: string
  sequence: number
  detailsModelList: InspectionChecklistItem[]
}

export type InspectionChecklistTemplateReference = {
  id?: number | string
  name?: string
  revision?: number
  layoutKey?: string
}

export type InspectionChecklistTemplateSummary = {
  id: number
  name: string
  description?: string
  revision: number
  isActive: boolean
  layoutKey?: string
  groupCount: number
  itemCount: number
  updatedDateTime?: string
  createdDateTime?: string
}

export type InspectionChecklistTemplateDetail = InspectionChecklistTemplateSummary & {
  groups: InspectionChecklistGroup[]
}

export function normalizeInspectionChecklistGroups(input: unknown): InspectionChecklistGroup[] {
  const rawGroups = Array.isArray(input)
    ? input
    : (input && typeof input === 'object'
        ? (((input as Record<string, unknown>).groups ?? (input as Record<string, unknown>).Groups) as unknown)
        : null)

  if (!Array.isArray(rawGroups)) return []

  return rawGroups
    .map((rawGroup, groupIndex): InspectionChecklistGroup | null => {
      if (!rawGroup || typeof rawGroup !== 'object') return null
      const record = rawGroup as Record<string, unknown>
      const group = String(record.group ?? record.Group ?? '').trim()
      if (!group) return null

      const detailsRaw = Array.isArray(record.detailsModelList ?? record.DetailsModelList)
        ? ((record.detailsModelList ?? record.DetailsModelList) as unknown[])
        : []

      const detailsModelList = detailsRaw
        .map((rawItem, itemIndex): InspectionChecklistItem | null => {
          if (!rawItem || typeof rawItem !== 'object') return null
          const item = rawItem as Record<string, unknown>
          const name = String(item.name ?? item.Name ?? '').trim()
          if (!name) return null
          const parsedId = Number(item.id ?? item.Id ?? itemIndex + 1)
          return {
            id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : itemIndex + 1,
            name,
            isRed: !!(item.isRed ?? item.IsRed),
            isAmber: !!(item.isAmber ?? item.IsAmber),
            isGreen: !!(item.isGreen ?? item.IsGreen),
            remarks: String(item.remarks ?? item.Remarks ?? ''),
          }
        })
        .filter((item): item is InspectionChecklistItem => Boolean(item))

      if (detailsModelList.length === 0) return null

      const parsedSequence = Number(record.sequence ?? record.Sequence ?? groupIndex + 1)
      return {
        group,
        sequence: Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : groupIndex + 1,
        detailsModelList,
      }
    })
    .filter((group): group is InspectionChecklistGroup => Boolean(group))
    .sort((left, right) => left.sequence - right.sequence)
}

export function cloneInspectionChecklistGroups(groups: InspectionChecklistGroup[]): InspectionChecklistGroup[] {
  return groups.map(group => ({
    ...group,
    detailsModelList: group.detailsModelList.map(item => ({ ...item })),
  }))
}

export function countInspectionChecklistItems(groups: InspectionChecklistGroup[]): number {
  return groups.reduce((total, group) => total + group.detailsModelList.length, 0)
}

export const DEFAULT_INSPECTION_CHECKLIST_GROUPS = normalizeInspectionChecklistGroups(inspectionChecklistData)
