// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Sliders, Search, Hash, Tag, FileText } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'

export default function ManageParameters(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)

  const [form, setForm] = useState({ group: '', code: '', name: '', sortOrder: 0, numericData: 0, otherData: '', description: '' })
  const [errors, setErrors] = useState<{ group?: string; name?: string; code?: string; description?: string }>({})
  const [groups, setGroups] = useState<any[]>([])
  const [groupFilter, setGroupFilter] = useState('')
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [groupDisplay, setGroupDisplay] = useState('')

  useEffect(()=>{
    if (!id || isAdd) return
    ;(async ()=>{
      try{
        const data: any = await configService.getParameter(id as string)
        if (data) setForm({
          group: data.parameterGroup?.id ? String(data.parameterGroup.id) : (data.parameterGroupId ? String(data.parameterGroupId) : (data.group ?? '')),
          code: data.code ?? '',
          name: data.name ?? '',
          sortOrder: data.sortOrder ?? 0,
          numericData: data.numericData ?? 0,
          otherData: data.otherData ?? '',
          description: data.description ?? ''
        })
      }catch(e){ showToast('Error loading Parameter', 'error') }
    })()
  },[id, location.pathname])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        const res: any = await configService.getParameterGroups()
        if (!mounted) return
        if (!Array.isArray(res)) return
        setGroups(res)
      }catch(e){ /* ignore */ }
    })()
    return ()=>{ mounted = false }
  },[])

  useEffect(()=>{
    const match = groups.find(g => String(g.id) === String(form.group) || String(g.name) === String(form.group))
    setGroupDisplay(match ? (match.name ?? '') : '')
  },[groups, form.group])

  function updateField(key: string, value: any){ setForm(f=> ({ ...f, [key]: value})); setErrors(e=> ({ ...e, [key]: '' })) }

  function validate(){
    const e: any = {}
    if (!form.group || !String(form.group).trim()) e.group = 'Required'
    if (!form.code || !String(form.code).trim()) e.code = 'Required'
    if (!form.name || !String(form.name).trim()) e.name = 'Required'
    if (!form.description || !String(form.description).trim()) e.description = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave(){
    if (!validate()){ showToast('Please fill required fields', 'error'); return }
    try{
      const body: any = {
        code: form.code,
        name: form.name,
        sortOrder: Number(form.sortOrder) || 0,
        numericData: Number(form.numericData) || 0,
        otherData: form.otherData,
        description: form.description,
      }
      if (groupDisplay) body.group = groupDisplay
      else if (form.group) body.group = form.group
      if (form.group && !Number.isNaN(Number(form.group))) body.parameterGroupId = Number(form.group)
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await configService.createParameter(body)
      else await configService.updateParameter(id as string, body)
      showToast(isAdd ? 'Parameter added' : 'Parameter updated', 'success')
      navigate('/configuration/parameters')
    }catch(e){ showToast('Error saving Parameter', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Parameter' : 'Manage Parameter'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">General Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700">Parameter Group <span className="text-rose-600">*</span></label>
                <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2${errors.group ? ' border-rose-400' : ''}`}>
                  <Search className="text-slate-400 shrink-0" size={16} />
                  <input
                    value={groupFilter || groupDisplay}
                    onChange={e=>{ setGroupFilter(e.target.value); setGroupDisplay(''); updateField('group', ''); setShowGroupDropdown(true) }}
                    onFocus={()=>{ setShowGroupDropdown(true); setGroupFilter(groupDisplay || groupFilter) }}
                    onBlur={()=>{ setTimeout(()=> setShowGroupDropdown(false), 150) }}
                    placeholder="Search group"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
                {showGroupDropdown && (
                  <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border rounded shadow-sm">
                    {groups.filter(g => (g.name||'').toLowerCase().includes((groupFilter||groupDisplay).toLowerCase())).map(g => (
                      <div key={g.id} onMouseDown={() => { updateField('group', String(g.id)); setGroupDisplay(g.name); setGroupFilter(''); setShowGroupDropdown(false) }} className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700">{g.name}{g.code ? (' (' + g.code + ')') : ''}</div>
                    ))}
                    {groups.filter(g => (g.name||'').toLowerCase().includes((groupFilter||groupDisplay).toLowerCase())).length === 0 && <div className="p-3 text-sm text-slate-500">No groups</div>}
                  </div>
                )}
                {errors.group && <div className="text-rose-600 text-sm mt-1">{errors.group}</div>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Parameter Code <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Code" value={form.code} onChange={e=>updateField('code', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.code && <div className="text-rose-600 text-sm mt-1">{errors.code}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Parameter Name <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Sort Order</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Sliders className="text-slate-400 shrink-0" size={16} />
                    <input type="number" placeholder="0" value={form.sortOrder} onChange={e=>updateField('sortOrder', Number(e.target.value))} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Numeric Data</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input type="number" placeholder="0" value={form.numericData} onChange={e=>updateField('numericData', Number(e.target.value))} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Other Data</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <FileText className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Other data" value={form.otherData} onChange={e=>updateField('otherData', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Description <span className="text-rose-600">*</span></label>
                <div className="mt-2 bg-white border rounded">
                  <textarea value={form.description} onChange={e=>updateField('description', e.target.value)} placeholder="Description" className="w-full p-3 bg-transparent outline-none text-sm resize-none h-24" />
                </div>
                {errors.description && <div className="text-rose-600 text-sm mt-1">{errors.description}</div>}
              </div>

            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-4">
          <button onClick={()=>navigate('/configuration/parameters')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
        </div>

      </div>
    </div>
  )
}
