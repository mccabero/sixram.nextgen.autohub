// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ChevronDown, FileText } from 'lucide-react'
import { getEffectivePermissions, getLoginSettings } from '../../services/adminService'
import { childIconMap, filterNavigationByPermissions, navigationItems } from '../../navigation/menu'

/* ── Colour tokens
   The sidebar is always dark (gradient in light mode, deep card in dark mode).
   Light mode uses the charcoal gradient; dark mode uses our #1c2530 palette.  */
const C = {
  // text
  label:       'text-slate-200 dark:text-[#c0d6e4]',
  labelMuted:  'text-slate-400 dark:text-[#5d7f92]',
  icon:        'text-slate-400 dark:text-[#8aafc0]',
  // interactive
  hover:       'hover:bg-white/10 dark:hover:bg-[#273340]',
  active:      'bg-bosch-blue/20 dark:bg-bosch-blue/25 shadow-sm',
  activeTx:    'text-white dark:text-white',
  // structure
  divider:     'border-white/10 dark:border-[#2b3845]',
}

const LOGIN_SETTINGS_UPDATED_EVENT = 'login-settings-updated'
const CAMERA_EVENTS_PERMISSION = 'page.administrator.camera_events.view'

function parseBooleanSetting(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean, onClose?: ()=>void }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const helpCenterActive = location.pathname === '/help-center'
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [companyName, setCompanyName] = useState<string>('Bosch Auto')
  const [companyTag,  setCompanyTag]  = useState<string>('Service Experts')
  const [companyLogo, setCompanyLogo] = useState<string>('')
  const [permissionKeys, setPermissionKeys] = useState<string[]>([])
  const [isBoschMode, setIsBoschMode] = useState(true)
  const visibleItems = useMemo(
    () => filterNavigationByPermissions(navigationItems, permissionKeys, {
      hiddenPermissionKeys: isBoschMode ? [CAMERA_EVENTS_PERMISSION] : [],
    }),
    [isBoschMode, permissionKeys]
  )
  const canViewHelpCenter = useMemo(() => permissionKeys.some(key => key.toLowerCase() === 'page.help_center.view'), [permissionKeys])

  const toTitleCase = (s: string) =>
    String(s || '').toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase())

  useEffect(() => {
    let mounted = true

    const loadBranding = async () => {
      try {
        const [companyRes, settingsRes] = await Promise.allSettled([
          fetch('/api/companyinfo'),
          getLoginSettings(),
        ])

        if (!mounted) return

        let fallbackName = ''
        let fallbackTag = ''
        let fallbackLogo = ''

        if (companyRes.status === 'fulfilled' && companyRes.value.ok) {
          const data = await companyRes.value.json()
          const list: any[] = Array.isArray(data) ? data
            : Array.isArray(data?.items)       ? data.items
            : Array.isArray(data?.companyInfo) ? data.companyInfo : []
          const first = list[0]
          fallbackName = String(first?.name ?? first?.Name ?? first?.companyName ?? first?.CompanyName ?? first?.company_name ?? first?.businessName ?? first?.title ?? '')
          fallbackTag = String(first?.tagline ?? first?.slogan ?? first?.description ?? first?.info ?? '')
          fallbackLogo = String(first?.logo ?? first?.logoUrl ?? first?.logoPath ?? first?.Logo ?? '')
        }

        const settings = settingsRes.status === 'fulfilled' ? settingsRes.value : null
        const settingsName = String(settings?.companyName ?? '').trim()
        const settingsLogo = String(settings?.logoUrl ?? '').trim()

        setIsBoschMode(parseBooleanSetting(settings?.showIsChanganOption))
        if (settingsName || fallbackName) setCompanyName(settingsName || toTitleCase(fallbackName))
        if (fallbackTag) setCompanyTag(toTitleCase(fallbackTag))
        setCompanyLogo(settingsLogo || fallbackLogo)
      } catch {}
    }

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ companyName?: string; logoUrl?: string; showIsChanganOption?: unknown }>).detail
      if (detail) {
        if (typeof detail.companyName === 'string' && detail.companyName.trim()) setCompanyName(detail.companyName.trim())
        if (typeof detail.logoUrl === 'string') setCompanyLogo(detail.logoUrl)
        if (Object.prototype.hasOwnProperty.call(detail, 'showIsChanganOption')) {
          setIsBoschMode(parseBooleanSetting(detail.showIsChanganOption))
        }
      }
      void loadBranding()
    }

    void loadBranding()
    window.addEventListener(LOGIN_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)

    return () => {
      mounted = false
      window.removeEventListener(LOGIN_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)
    }
  }, [])

  useEffect(() => {
    try { const r = localStorage.getItem('sidebar_expanded'); if (r) setExpandedMap(JSON.parse(r)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('sidebar_expanded', JSON.stringify(expandedMap)) } catch {}
  }, [expandedMap])

  useEffect(() => {
    let mounted = true
    if (!isAuthenticated) {
      setPermissionKeys([])
      return
    }

    getEffectivePermissions()
      .then(keys => { if (mounted) setPermissionKeys(keys) })
      .catch(() => { if (mounted) setPermissionKeys([]) })

    return () => { mounted = false }
  }, [isAuthenticated])

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50
        md:sticky md:top-0
        w-72 max-w-[calc(100vw-2rem)] max-h-screen overflow-y-auto
        flex flex-col
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        bg-gradient-to-b from-[#2b3136] via-[#24292e] to-[#20252a]
        dark:from-[#1c2530] dark:via-[#192028] dark:to-[#14181c]
        border-r ${C.divider}
      `}>

        {/* ── Brand — h-16 matches the topbar ────────────── */}
        <div className={`flex min-h-16 items-center gap-3 px-4 py-3 sm:px-5 flex-shrink-0 border-b ${C.divider}`}>
          {companyLogo ? (
            <div className="flex h-12 w-20 flex-shrink-0 items-center justify-center overflow-hidden">
              <img src={companyLogo} alt={`${companyName} logo`} className="max-h-12 max-w-full object-contain drop-shadow-sm" onError={() => setCompanyLogo('')} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-bosch-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
              {(companyName || 'R').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white dark:text-[#dceaf3] truncate leading-tight text-sm">
              {companyName}
            </div>
            <div className={`text-xs ${C.labelMuted} truncate mt-0.5`}>{companyTag}</div>
          </div>
        </div>

        {/* ── Navigation ──────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className={`${C.labelMuted} text-xs font-semibold tracking-wider uppercase px-3 pb-2`}>
            Menu
          </div>

          {visibleItems.map(i => {
            const Icon         = i.icon
            const active       = location.pathname === i.to || (i.children?.some(c => location.pathname === c.to) ?? false)
            const isExpandable = Array.isArray(i.children) && i.children.length > 0
            const expanded     = !!expandedMap[i.to]

            return (
              <div key={i.to}>
                {isExpandable ? (
                  <button
                    onClick={() => setExpandedMap(m => ({ ...m, [i.to]: !expanded }))}
                    title={i.label}
                    className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${active ? C.active : C.hover}`}
                  >
                    <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 ${active ? C.activeTx : C.icon}`}>
                      <Icon size={17} />
                    </div>
                    <span className={`flex-1 text-sm font-medium truncate ${active ? C.activeTx : C.label}`}>
                      {i.label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`${C.labelMuted} transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : (
                  <Link
                    to={i.to}
                    onClick={onClose}
                    title={i.label}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${active ? C.active : C.hover}`}
                  >
                    <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 ${active ? C.activeTx : C.icon}`}>
                      <Icon size={17} />
                    </div>
                    <span className={`text-sm font-medium truncate ${active ? C.activeTx : C.label}`}>
                      {i.label}
                    </span>
                  </Link>
                )}

                {isExpandable && expanded && (
                  <div className={`ml-4 mt-0.5 space-y-0.5 border-l ${C.divider} pl-3`}>
                    {i.children!.map(c => {
                      const CI          = childIconMap[c.to] ?? FileText
                      const childActive = location.pathname === c.to
                      return (
                        <Link
                          key={c.to}
                          to={c.to}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 py-2 px-2 rounded-lg transition-colors ${childActive ? C.active : C.hover}`}
                        >
                          <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${childActive ? C.activeTx : C.icon}`}>
                            <CI size={13} />
                          </div>
                          <span className={`text-sm truncate ${childActive ? C.activeTx : C.label}`}>
                            {c.label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* ── Support ─────────────────────────────────────── */}
        <div className={`px-3 pb-4 pt-3 border-t ${C.divider}`}>
          <div className={`${C.labelMuted} text-xs font-semibold tracking-wider uppercase px-3 pb-2`}>
            Support
          </div>
          {canViewHelpCenter && <Link to="/help-center" onClick={onClose} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${helpCenterActive ? C.active : C.hover}`}>
            <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 ${helpCenterActive ? C.activeTx : C.icon}`}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor"/>
              </svg>
            </div>
            <span className={`text-sm font-medium ${helpCenterActive ? C.activeTx : C.label}`}>Help Center</span>
          </Link>}
        </div>

      </aside>
    </>
  )
}
