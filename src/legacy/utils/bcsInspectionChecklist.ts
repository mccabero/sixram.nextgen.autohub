// @ts-nocheck
export const BCS_INSPECTION_LAYOUT_KEY = 'bcs-checklist-v1'
export const BCS_INSPECTION_TEMPLATE_NAME = 'Bosch Car Service Checklist'

export type BcsCondition = '' | 'C' | 'A' | 'R' | 'NA'

export type BcsInspectionChecklistItem = {
  id: number
  name: string
  condition: BcsCondition
  remarks: string
}

export type BcsInspectionChecklistGroup = {
  group: string
  sequence: number
  detailsModelList: BcsInspectionChecklistItem[]
}

export type BcsRecommendation = {
  id: number
  task: string
  item: string
  reason: string
}

const bcsChecklistSeed: Array<{
  group: string
  items: string[]
}> = [
  {
    group: 'Lights & Electrical & Comfort System',
    items: [
      'Internal lights and bulb (specify defective in recommendation)',
      'Interior switches (specify defective in recommendation)',
      'Horn operation',
      'Infotainment | Audio System | AC Control Panel',
      'Power windows | Run channel | Door hinges',
      'Hand Brake Operation (Number of clicks)',
      'Check Engine / MIL (specify in recommendation)',
      'Wiper Blades Condition',
      'Windshield washer reservoir (top up if necessary)',
      'Exterior lights and bulbs (specify defective in recommendation)',
      'Battery condition (CCA / Rating / Volts)',
      'Alternator Charging (Voltage)',
    ],
  },
  {
    group: 'Fluids & Lubricants',
    items: [
      'Engine Oil & Filter',
      'Transmission Fluid',
      'Brake Fluid | Clutch Fluid',
      'Coolant',
      'Power Steering Fluid',
      'Differential Fluid',
    ],
  },
  {
    group: 'Filters, Ignition & Belts',
    items: [
      'Air Intake Filter (Dust and pollen)',
      'Cabin / Aircon Filter (Dust and pollen) | Blower Motor FRT & RR',
      'Fuel Filter (1) & (2 if equipped)',
      'Spark Plug | Ignition Coil | High tension wire | Distributor',
      'Timing Belt | Timing Chain condition',
      'Drive Belt | Serpentine Belt | Tensioner',
    ],
  },
  {
    group: 'Cooling System',
    items: [
      'Radiator and Radiator Cap',
      'Auxiliary Fan Motors | Clutch Fan',
      'Water Pump and Pulley',
      'Heater Exchanger | Heater Core | Hoses',
      'Reservoir Tank',
    ],
  },
  {
    group: 'Engine',
    items: [
      'Idling condition (minimum 750+- rpm)',
      'Engine Leak | Blow by | Low power (specify condition if defective)',
      'Engine and Transmission supports / mountings',
      'Engine Electrical | Harness | Fuse Box (specify condition if defective)',
      'PCV Hose and Valve',
    ],
  },
  {
    group: 'Brakes',
    items: [
      'Pads / Shoe - Front Left / Front Right (mm)',
      'Pads / Shoe - Rear Left / Rear Right (mm)',
      'Caliper / Wheel Cylinder - Front Left / Front Right',
      'Caliper / Wheel Cylinder - Rear Left / Rear Right',
      'Brake Booster & Brake Master (Hydraulic / Electric)',
      'Rotor / Drum Brake - Front Left / Front Right',
      'Rotor / Drum Brake - Rear Left / Rear Right',
      'Hand Brake Cable | Linkage | Connections',
      'Electronic Parking Brake Motor | Connection | Harness',
      'Parking Brake Lining Condition',
    ],
  },
  {
    group: 'Steering / Suspension',
    items: [
      'Ball Joint | Bushing | Stab. Link | Rack-end | Tie Rod | Drag Links',
      'Power Steering Rack-end | EPS (leak/play/alignment)',
      'Power Steering Pump & Hoses',
      'Suspension Arm | Trailing Arm Bushing (Lower & Upper)',
      'Shock Absorber | Spring | Mounting',
      'Wheel Hub Bearing (Front & Rear)',
    ],
  },
  {
    group: 'Driveshaft / Propeller / Gearbox',
    items: [
      'Driveshaft, Boot (CV Boot), and Center bearing condition',
      'Propeller Shaft and Joints',
      'Clutch System and Operation',
      'Differential | Carrier | Transfer Case | Axle Oil Seal',
      'Pitman | Center Link | Center Post',
      'Tighten Body and Suspension Bolts',
    ],
  },
  {
    group: 'Exhaust / EGR & Turbo',
    items: [
      'Exhaust Muffler | Catalytic | Pipe | Lambda Sensor',
      'Exhaust Gas Recirculation Valve (EGR) | Turbo Charger | Intercooler',
    ],
  },
  {
    group: 'Airconditioning',
    items: [
      'Air-conditioning System Temp. (Lowest temp at vent, deg C)',
      'Condenser | Compressor | Low Pressure Hoses | High Pressure Hoses',
    ],
  },
  {
    group: 'Tires and Spare',
    items: [
      'Tire depth (mm)',
      'Tire pressure (psi)',
      'Mag wheel condition (specify if crack, split, bent)',
      'Tire Condition & Wheel alignment (specify if punctured/cracks/uneven)',
    ],
  },
  {
    group: 'Final Re-set / Service Book',
    items: [
      'Perform ECU/ECM scanning & Print Test Protocol (KTS)',
      'Reset vehicle service light where applicable',
      'Reset oil quality (if equipped)',
      'Stamp Maintenance Card (if service acquired is PMS/Change Oil)',
    ],
  },
]

export const DEFAULT_BCS_INSPECTION_CHECKLIST_GROUPS: BcsInspectionChecklistGroup[] =
  bcsChecklistSeed.map((group, groupIndex) => ({
    group: group.group,
    sequence: groupIndex + 1,
    detailsModelList: group.items.map((name, itemIndex) => ({
      id: itemIndex + 1,
      name,
      condition: '',
      remarks: '',
    })),
  }))

export function cloneBcsInspectionChecklistGroups(groups: BcsInspectionChecklistGroup[]): BcsInspectionChecklistGroup[] {
  return groups.map(group => ({
    ...group,
    detailsModelList: group.detailsModelList.map(item => ({ ...item })),
  }))
}

export function createEmptyBcsRecommendations(count = 1): BcsRecommendation[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    task: '',
    item: '',
    reason: '',
  }))
}

export function normalizeBcsInspectionChecklistGroups(input: unknown): BcsInspectionChecklistGroup[] {
  const rawGroups = Array.isArray(input)
    ? input
    : (input && typeof input === 'object'
        ? (((input as Record<string, unknown>).groups ?? (input as Record<string, unknown>).Groups) as unknown)
        : null)

  if (!Array.isArray(rawGroups)) return cloneBcsInspectionChecklistGroups(DEFAULT_BCS_INSPECTION_CHECKLIST_GROUPS)

  const normalized = rawGroups
    .map((rawGroup, groupIndex): BcsInspectionChecklistGroup | null => {
      if (!rawGroup || typeof rawGroup !== 'object') return null
      const record = rawGroup as Record<string, unknown>
      const group = String(record.group ?? record.Group ?? '').trim()
      if (!group) return null

      const detailsRaw = Array.isArray(record.detailsModelList ?? record.DetailsModelList)
        ? ((record.detailsModelList ?? record.DetailsModelList) as unknown[])
        : []

      const detailsModelList = detailsRaw
        .map((rawItem, itemIndex): BcsInspectionChecklistItem | null => {
          if (!rawItem || typeof rawItem !== 'object') return null
          const item = rawItem as Record<string, unknown>
          const name = String(item.name ?? item.Name ?? '').trim()
          if (!name) return null
          const parsedId = Number(item.id ?? item.Id ?? itemIndex + 1)
          const rawCondition = String(item.condition ?? item.Condition ?? '').toUpperCase()
          const condition: BcsCondition =
            rawCondition === 'C' || rawCondition === 'A' || rawCondition === 'R' || rawCondition === 'NA'
              ? rawCondition
              : ''

          return {
            id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : itemIndex + 1,
            name,
            condition,
            remarks: String(item.remarks ?? item.Remarks ?? ''),
          }
        })
        .filter((item): item is BcsInspectionChecklistItem => Boolean(item))

      if (detailsModelList.length === 0) return null
      const parsedSequence = Number(record.sequence ?? record.Sequence ?? groupIndex + 1)

      return {
        group,
        sequence: Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : groupIndex + 1,
        detailsModelList,
      }
    })
    .filter((group): group is BcsInspectionChecklistGroup => Boolean(group))
    .sort((left, right) => left.sequence - right.sequence)

  return normalized.length > 0
    ? normalized
    : cloneBcsInspectionChecklistGroups(DEFAULT_BCS_INSPECTION_CHECKLIST_GROUPS)
}

export function normalizeBcsRecommendations(input: unknown): BcsRecommendation[] {
  if (!Array.isArray(input)) return createEmptyBcsRecommendations()

  const raw = input
  const normalized = raw
    .map((item, index): BcsRecommendation | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      return {
        id: Number(record.id ?? record.Id ?? index + 1) || index + 1,
        task: String(record.task ?? record.Task ?? ''),
        item: String(record.item ?? record.Item ?? ''),
        reason: String(record.reason ?? record.Reason ?? ''),
      }
    })
    .filter((item): item is BcsRecommendation => Boolean(item))

  return normalized
}
