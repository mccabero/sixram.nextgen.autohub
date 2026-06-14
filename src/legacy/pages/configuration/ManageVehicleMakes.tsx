// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Truck, MapPin } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'

export default function ManageVehicleMakes(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)

  const [form, setForm] = useState({ name: '', region: '', description: '' })
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({})
  const [regions, setRegions] = useState<any[]>([])
  const [regionFilter, setRegionFilter] = useState('')
  const [showRegionDropdown, setShowRegionDropdown] = useState(false)
  const [regionDisplay, setRegionDisplay] = useState('')

  useEffect(()=>{
    if (!id || isAdd) return
    ;(async ()=>{
      try{
        const data: any = await configService.getVehicleMake(id as string)
        if (data) setForm({ name: data.name ?? '', region: (data.regionParameterId ?? data.regionParameter?.id ?? '') as any, description: data.description ?? '' })
      }catch(e){ showToast('Error loading Vehicle Make', 'error') }
    })()
  },[id, location.pathname])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        const res: any = await configService.getParameters()
        if (!mounted) return
        if (!Array.isArray(res)) return
        const filtered = res.filter((p: any) => (p.parameterGroup && p.parameterGroup.name === 'REGION') || (p.parameterGroupName === 'REGION'))
        setRegions(filtered)
      }catch(e){ /* ignore */ }
    })()
    return ()=>{ mounted = false }
  },[])

  useEffect(()=>{
    const match = regions.find(r => String(r.id) === String(form.region) || (r.id === form.region))
    setRegionDisplay(match ? (match.name ?? '') : '')
  },[regions, form.region])

  function updateField(key: string, value: any){ setForm(f=> ({ ...f, [key]: value})); setErrors(e=> ({ ...e, [key]: '' })) }

  function validate(){ const e: any = {}; if (!form.name || !String(form.name).trim()) e.name = 'Required'; if (!form.description || !String(form.description).trim()) e.description = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  async function handleSave(){
    if (!validate()){ showToast('Please fill required fields', 'error'); return }
    try{
      const body: any = { name: form.name, description: form.description }
      if (form.region) body.regionParameterId = Number(form.region)
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await configService.createVehicleMake(body)
      else await configService.updateVehicleMake(id as string, body)
      showToast(isAdd ? 'Vehicle Make added' : 'Vehicle Make updated', 'success')
      navigate('/configuration/vehicle-makes')
    }catch(e){ showToast('Error saving Vehicle Make', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Vehicle Make' : 'Manage Vehicle Make'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">General Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Truck className="text-slate-400 shrink-0" size={16} />
                  <input placeholder="Name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                </div>
                {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700">Region</label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <MapPin className="text-slate-400 shrink-0" size={16} />
                  <input
                    value={regionFilter || regionDisplay}
                    onChange={e=>{ setRegionFilter(e.target.value); setShowRegionDropdown(true) }}
                    onFocus={()=>{ setShowRegionDropdown(true); setRegionFilter(''); setRegionDisplay('') }}
                    onBlur={()=>{ setTimeout(()=> setShowRegionDropdown(false), 150) }}
                    placeholder="Search region"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
                {showRegionDropdown && (
                  <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border rounded shadow-sm">
                    {regions.filter(r => (r.name||'').toLowerCase().includes((regionFilter||regionDisplay).toLowerCase())).map(r => (
                      <div key={r.id} onMouseDown={() => { updateField('region', String(r.id)); setRegionDisplay(r.name); setRegionFilter(''); setShowRegionDropdown(false) }} className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700">{r.name}</div>
                    ))}
                    {regions.filter(r => (r.name||'').toLowerCase().includes((regionFilter||regionDisplay).toLowerCase())).length === 0 && <div className="p-3 text-sm text-slate-500">No regions</div>}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
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
          <button onClick={()=>navigate('/configuration/vehicle-makes')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
        </div>

      </div>
    </div>
  )
}
