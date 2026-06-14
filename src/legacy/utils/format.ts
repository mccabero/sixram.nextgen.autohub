// @ts-nocheck
export function currency(value?: number | string | null){
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''))
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatAmount(value?: number | string | null){
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ''))
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPHMobile(value?: string | null){
  if (!value) return ''
  const s = String(value)
  const digits = s.replace(/[^0-9]/g, '')
  if (!digits) return s

  let d = digits
  // handle leading country code '63' -> prepend 0
  if (d.startsWith('63')) d = '0' + d.slice(2)
  // handle missing leading zero for 10-digit numbers
  if (d.length === 10) d = '0' + d

  if (d.length === 11 && d.startsWith('0')) {
    // format as 0917-123-4567 (4-3-4)
    return `${d.slice(0,4)}-${d.slice(4,7)}-${d.slice(7)}`
  }

  // fallback: return original digits grouped by common lengths
  if (d.length === 7) return `${d.slice(0,3)}-${d.slice(3)}`
  if (d.length === 8) return `${d.slice(0,4)}-${d.slice(4)}`
  if (d.length === 9) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`

  return s
}

export function formatShortDate(value?: string | number | Date | null){
  if (value === null || value === undefined || value === '') return ''
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export function formatInteger(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9-]+/g, ''), 10)
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString()
}
