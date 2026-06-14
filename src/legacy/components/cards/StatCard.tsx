// @ts-nocheck
import React from 'react'
import { Users, Truck, FileText, Activity, DollarSign, CreditCard, Percent } from 'lucide-react'

type StatCardVariant = 'default' | 'activity' | 'financial'
type StatCardTone =
  | 'fjord'
  | 'lagoon'
  | 'olive'
  | 'copper'
  | 'pine'
  | 'aqua'
  | 'gold'
  | 'cranberry'
  | 'coral'
  | 'teal'
  | 'mint'
  | 'orange'
  | 'rose'

interface StatCardProps {
  title: string
  value: React.ReactNode
  icon?: React.ReactNode
  color?: string
  tone?: StatCardTone
  variant?: StatCardVariant
  loading?: boolean
  onClick?: () => void
}

const cardToneClasses: Record<StatCardTone, string> = {
  fjord: 'from-[#315f86] to-[#244761] shadow-[#315f86]/25',
  lagoon: 'from-[#148084] to-[#0f626a] shadow-[#148084]/25',
  olive: 'from-[#7d8b3a] to-[#5f6f2d] shadow-[#7d8b3a]/25',
  copper: 'from-[#b76633] to-[#91481f] shadow-[#b76633]/25',
  pine: 'from-[#2f855a] to-[#236649] shadow-[#2f855a]/25',
  aqua: 'from-[#1688a7] to-[#106b8d] shadow-[#1688a7]/25',
  gold: 'from-[#c18a2f] to-[#9b6820] shadow-[#c18a2f]/25',
  cranberry: 'from-[#a34256] to-[#7f3142] shadow-[#a34256]/25',
  coral: 'from-[#315f86] to-[#244761] shadow-[#315f86]/25',
  teal: 'from-[#148084] to-[#0f626a] shadow-[#148084]/25',
  mint: 'from-[#7d8b3a] to-[#5f6f2d] shadow-[#7d8b3a]/25',
  orange: 'from-[#b76633] to-[#91481f] shadow-[#b76633]/25',
  rose: 'from-[#a34256] to-[#7f3142] shadow-[#a34256]/25',
}

const defaultToneByVariant: Record<StatCardVariant, StatCardTone> = {
  default: 'lagoon',
  activity: 'lagoon',
  financial: 'pine',
}

const toneByTitle: Array<[RegExp, StatCardTone]> = [
  [/total sales/i, 'pine'],
  [/quick/i, 'aqua'],
  [/discount/i, 'gold'],
  [/expense/i, 'cranberry'],
  [/customer/i, 'fjord'],
  [/vehicle/i, 'lagoon'],
  [/estimate/i, 'olive'],
  [/order/i, 'copper'],
]

function resolveTone(title: string, variant: StatCardVariant, tone?: StatCardTone) {
  if (tone) return tone
  const match = toneByTitle.find(([pattern]) => pattern.test(title))
  return match ? match[1] : defaultToneByVariant[variant]
}

export default function StatCard({ title, value, icon, tone, variant='default', loading=false, onClick }: StatCardProps){
  const key = title.toLowerCase()

  const defaultIcon = (
    (key.includes('customer') && <Users size={20} />) ||
    (key.includes('vehicle') && <Truck size={20} />) ||
    (key.includes('estimate') && <FileText size={20} />) ||
    (key.includes('order') && <Activity size={20} />) ||
    (key.includes('total sales') && <DollarSign size={20} />) ||
    (key.includes('quick sales') && <CreditCard size={20} />) ||
    (key.includes('discount') && <Percent size={20} />) ||
    (key.includes('expense') && <FileText size={20} />) ||
    <FileText size={20} />
  )

  const finalIcon = icon
    ? React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 20, strokeWidth: 2.25 }) : icon
    : defaultIcon

  const clickable = typeof onClick === 'function'
  const isMoney = key.includes('total sales') || key.includes('quick sales') || key.includes('discount') || key.includes('expense')
  const displayValue = loading ? '-' : (isMoney && (typeof value === 'string' || typeof value === 'number') ? `\u20b1${value}` : value)
  const resolvedTone = resolveTone(title, variant, tone)
  const ariaLabel = `${title}: ${typeof displayValue === 'string' || typeof displayValue === 'number' ? displayValue : ''}`.trim()

  return (
    <div
      className={`relative min-h-[150px] overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left text-white shadow-xl transition ${cardToneClasses[resolvedTone]} ${clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-sky-200 dark:focus:ring-sky-900' : ''}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? ariaLabel : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick() } } : undefined}
    >
      <span className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-white/20" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-5 -top-14 h-28 w-28 rounded-full bg-white/20" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-16 top-0 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />

      <div className="relative z-10 flex min-h-[110px] flex-col justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/20 text-white/75">
          {finalIcon}
        </div>
        <div className="min-w-0 pt-6">
          <div className="break-words text-3xl font-bold leading-none tracking-normal sm:text-[34px]">{displayValue}</div>
          <div className="mt-2 break-words text-base font-semibold leading-tight text-white/95">{title}</div>
        </div>
      </div>
    </div>
  )
}
