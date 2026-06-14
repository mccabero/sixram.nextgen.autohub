// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Wrench, Code2, Search, Hash, X } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import managementService from '../../services/managementService'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import PriceEditLockedBadge from '../../components/rbac/PriceEditLockedBadge'
import ServiceJobOrderTable from '../../components/tables/ServiceJobOrderTable'
import { useCanEditPricePermission } from '../../hooks/useCanEditPricePermission'

function CurrencyInput({ value, onChange, className, disabled }: { value: number; onChange: (v: number) => void; className?: string; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  function handleFocus() { if (disabled) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { if (disabled) return; setInputVal(e.target.value) }
  function handleBlur() { if (disabled) return; setFocused(false); onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} disabled={disabled} className={className} />
}

function normalizeOptions(items: any[]): any[] {
  return items.map(item => {
    const id = item.id !== undefined ? item.id
      : (Object.entries(item).find(([k, v]) => k !== 'id' && /id$/i.test(k) && v !== undefined)?.[1])
    const name = item.name !== undefined ? item.name
      : (Object.entries(item).find(([k]) => /name/i.test(k))?.[1] ?? '')
    return { ...item, id, name }
  })
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-bosch-blue' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

const TABS = ['General Information', 'Transaction']

export default function ManageServices() {
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const canEditPrice = useCanEditPricePermission()

  const [form, setForm] = useState<any>({ name: '', code: '', serviceGroupId: '', serviceCategoryId: '', standardRate: 0, standardHours: 0, isReplacement: false, isAllowRateOverride: false, isMechanicRequired: false, displayStandardHours: false, displayStandardRate: false, displayNotes: false })
  const [errors, setErrors] = useState<any>({})
  const [groups, setGroups] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSuggestions, setGroupSuggestions] = useState<any[]>([])
  const [groupShowDrop, setGroupShowDrop] = useState(false)
  const [catSearch, setCatSearch] = useState('')
  const [catSuggestions, setCatSuggestions] = useState<any[]>([])
  const [catShowDrop, setCatShowDrop] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    ;(async () => {
      const [g, c] = await Promise.all([configService.getServiceGroups(), configService.getServiceCategories()])
      setGroups(normalizeOptions(Array.isArray(g) ? g : []))
      setCategories(normalizeOptions(Array.isArray(c) ? c : []))
    })()
  }, [])

  useEffect(() => {
    if (!id || isAdd) return
    ;(async () => {
      try {
        const data: any = await managementService.getService(id as string)
        if (data) {
          const serviceGroupId = data.serviceGroup?.id ?? data.serviceGroupId ?? ''
          const serviceCategoryId = data.serviceCategory?.id ?? data.serviceCategoryId ?? ''
          setForm({ name: data.name ?? '', code: data.code ?? '', serviceGroupId, serviceCategoryId, standardRate: data.standardRate ?? 0, standardHours: data.standardHours ?? 0, isReplacement: !!data.isReplacement, isAllowRateOverride: !!data.isAllowRateOverride, isMechanicRequired: !!data.isMechanicRequired, displayStandardHours: !!data.displayStandardHours, displayStandardRate: !!data.displayStandardRate, displayNotes: !!data.displayNotes })
          if (serviceGroupId) {
            const found = groups.find((g: any) => String(g.id) === String(serviceGroupId))
            setGroupSearch(found?.name ?? data.serviceGroup?.name ?? '')
          }
          if (serviceCategoryId) {
            const found = categories.find((c: any) => String(c.id) === String(serviceCategoryId))
            setCatSearch(found?.name ?? data.serviceCategory?.name ?? '')
          }
        }
      } catch { showToast('Error loading Service', 'error') }
    })()
  }, [id, isAdd, location.pathname, groups, categories, showToast])

  function updateField(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); setErrors((e: any) => ({ ...e, [key]: '' })) }

  function onGroupSearch(q: string) {
    setGroupSearch(q)
    updateField('serviceGroupId', '')
    const filtered = q.trim() ? groups.filter(g => (g.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : groups.slice(0, 10)
    setGroupSuggestions(filtered)
    setGroupShowDrop(true)
  }
  function selectGroup(g: any) { setGroupSearch(g.name ?? ''); updateField('serviceGroupId', g.id); setGroupSuggestions([]); setGroupShowDrop(false) }
  function clearGroup() { setGroupSearch(''); updateField('serviceGroupId', ''); setGroupSuggestions([]); setGroupShowDrop(false) }

  function onCatSearch(q: string) {
    setCatSearch(q)
    updateField('serviceCategoryId', '')
    const filtered = q.trim() ? categories.filter(c => (c.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : categories.slice(0, 10)
    setCatSuggestions(filtered)
    setCatShowDrop(true)
  }
  function selectCat(c: any) { setCatSearch(c.name ?? ''); updateField('serviceCategoryId', c.id); setCatSuggestions([]); setCatShowDrop(false) }
  function clearCat() { setCatSearch(''); updateField('serviceCategoryId', ''); setCatSuggestions([]); setCatShowDrop(false) }

  function validate() {
    const e: any = {}
    if (!form.name || !String(form.name).trim()) e.name = 'Required'
    if (!form.code || !String(form.code).trim()) e.code = 'Required'
    if (!form.serviceGroupId) e.serviceGroupId = 'Required'
    if (!form.serviceCategoryId) e.serviceCategoryId = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    try {
      const body: any = { name: form.name, code: form.code, serviceGroupId: form.serviceGroupId || null, serviceCategoryId: form.serviceCategoryId || null, standardRate: Number(form.standardRate) || 0, standardHours: Number(form.standardHours) || 0, isReplacement: !!form.isReplacement, isAllowRateOverride: !!form.isAllowRateOverride, isMechanicRequired: !!form.isMechanicRequired, displayStandardHours: !!form.displayStandardHours, displayStandardRate: !!form.displayStandardRate, displayNotes: !!form.displayNotes }
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await managementService.createService(body)
      else await managementService.updateService(id as string, body)
      showToast(isAdd ? 'Service added' : 'Service updated', 'success')
      navigate('/management/services')
    } catch { showToast('Error saving Service', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Service' : 'Manage Service'}</h2>
      </div>

      <div className="mt-4">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px space-x-2">
            {(isAdd ? [TABS[0]] : TABS).map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 ${activeTab === index ? 'border-b-2 border-bosch-blue text-bosch-blue' : 'text-slate-600 hover:text-bosch-blue'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 0 && (
            <div className="p-4 bg-white rounded shadow-sm">
              <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Service Information</div>
                  </div>

                <div className="p-4 grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Service Name <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Wrench className="text-slate-400 shrink-0" size={16} />
                        <input
                          placeholder="Service Name"
                          value={form.name}
                          onChange={e => updateField('name', e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                        />
                        {form.name && <button type="button" onClick={() => updateField('name', '')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                      </div>
                      {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Service Code <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Code2 className="text-slate-400 shrink-0" size={16} />
                        <input
                          placeholder="Service Code"
                          value={form.code}
                          onChange={e => updateField('code', e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                        />
                        {form.code && <button type="button" onClick={() => updateField('code', '')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                      </div>
                      {errors.code && <div className="text-rose-600 text-sm mt-1">{errors.code}</div>}
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700">Service Group <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Search className="text-slate-400 shrink-0" size={16} />
                        <input
                          placeholder="Search group..."
                          value={groupSearch}
                          onChange={e => onGroupSearch(e.target.value)}
                          onFocus={() => { const filtered = groupSearch.trim() ? groups.filter(g => (g.name ?? '').toLowerCase().includes(groupSearch.toLowerCase())).slice(0, 10) : groups.slice(0, 10); setGroupSuggestions(filtered); setGroupShowDrop(true) }}
                          onBlur={() => setTimeout(() => setGroupShowDrop(false), 150)}
                          className="w-full bg-transparent outline-none text-sm"
                        />
                        {groupSearch && <button type="button" onMouseDown={e => { e.preventDefault(); clearGroup() }} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                      </div>
                      {errors.serviceGroupId && <div className="text-rose-600 text-sm mt-1">{errors.serviceGroupId}</div>}
                      {groupShowDrop && groupSuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                          {groupSuggestions.map((g: any) => (
                            <div key={g.id} onClick={() => selectGroup(g)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">{g.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700">Service Category <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Search className="text-slate-400 shrink-0" size={16} />
                        <input
                          placeholder="Search category..."
                          value={catSearch}
                          onChange={e => onCatSearch(e.target.value)}
                          onFocus={() => { const filtered = catSearch.trim() ? categories.filter(c => (c.name ?? '').toLowerCase().includes(catSearch.toLowerCase())).slice(0, 10) : categories.slice(0, 10); setCatSuggestions(filtered); setCatShowDrop(true) }}
                          onBlur={() => setTimeout(() => setCatShowDrop(false), 150)}
                          className="w-full bg-transparent outline-none text-sm"
                        />
                        {catSearch && <button type="button" onMouseDown={e => { e.preventDefault(); clearCat() }} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                      </div>
                      {errors.serviceCategoryId && <div className="text-rose-600 text-sm mt-1">{errors.serviceCategoryId}</div>}
                      {catShowDrop && catSuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                          {catSuggestions.map((c: any) => (
                            <div key={c.id} onClick={() => selectCat(c)} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">{c.name}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Standard Rate</label>
                      <div className={`relative mt-2 flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                        <Hash className="text-slate-400 shrink-0" size={16} />
                        <CurrencyInput value={Number(form.standardRate)} onChange={v => updateField('standardRate', v)} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-14' : ''}`} />
                        {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Standard Hours</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Hash className="text-slate-400 shrink-0" size={16} />
                        <input type="number" step="0.01" value={form.standardHours} onChange={e => updateField('standardHours', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-1">
                    {([
                      { key: 'isReplacement', label: 'Is Replacement?' },
                      { key: 'isMechanicRequired', label: 'Is Mechanic Required?' },
                      { key: 'displayStandardRate', label: 'Display Standard Rate?' },
                    ] as const).map(({ key, label }) => (
                      <div key={key}>
                        <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
                        <Toggle checked={!!form[key]} onChange={v => updateField(key, v)} />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-1">
                    {([
                      { key: 'isAllowRateOverride', label: 'Is Allow Rate Override?' },
                      { key: 'displayStandardHours', label: 'Display Standard Hours?' },
                      { key: 'displayNotes', label: 'Display Notes?' },
                    ] as const).map(({ key, label }) => (
                      <div key={key}>
                        <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
                        <Toggle checked={!!form[key]} onChange={v => updateField(key, v)} />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => navigate('/management/services')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isAdd && activeTab === 1 && (
            <ServiceJobOrderTable serviceId={id} />
          )}
        </div>
      </div>
    </div>
  )
}
