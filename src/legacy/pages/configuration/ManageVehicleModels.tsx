// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Layers, Truck, Car, Grid3x3 } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import VehicleModelApplicableProductsTable from '../../components/tables/VehicleModelApplicableProductsTable'

const TABS = ['General Information', 'Applicable Products']

export default function ManageVehicleModels(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const visibleTabs = isAdd ? [TABS[0]] : TABS

  const [form, setForm] = useState({ name: '', vehicleMake: '', description: '', bodyType: '', classification: '' })
  const [activeTab, setActiveTab] = useState(0)
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({})
  const [vehicleMakes, setVehicleMakes] = useState<any[]>([])
  const [makeFilter, setMakeFilter] = useState('')
  const [showMakeDropdown, setShowMakeDropdown] = useState(false)
  const [makeDisplay, setMakeDisplay] = useState('')

  const [bodyTypes, setBodyTypes] = useState<any[]>([])
  const [bodyFilter, setBodyFilter] = useState('')
  const [showBodyDropdown, setShowBodyDropdown] = useState(false)
  const [bodyDisplay, setBodyDisplay] = useState('')

  const [classifications, setClassifications] = useState<any[]>([])
  const [classFilter, setClassFilter] = useState('')
  const [showClassDropdown, setShowClassDropdown] = useState(false)
  const [classDisplay, setClassDisplay] = useState('')

  useEffect(()=>{
    if (!id || isAdd) return
    ;(async ()=>{
      try{
        const data: any = await configService.getVehicleModel(id as string)
        if (data) setForm({
          name: data.name ?? '',
          vehicleMake: data.vehicleMakeId ?? data.vehicleMake?.id ?? data.vehicleMake ?? '',
          description: data.description ?? '',
          bodyType: data.bodyParameterId ?? data.bodyParameter?.id ?? data.bodyTypeParameterId ?? data.bodyTypeParameter?.id ?? data.bodyType ?? '',
          classification: data.classificationParameterId ?? data.classificationParameter?.id ?? data.classification ?? ''
        })
      }catch(e){ showToast('Error loading Vehicle Model', 'error') }
    })()
  },[id, location.pathname])

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        const makes: any = await configService.getVehicleMakes()
        if (mounted && Array.isArray(makes)) setVehicleMakes(makes)
        const params: any = await configService.getParameters()
        if (!mounted) return
        if (Array.isArray(params)){
          const bodies = params.filter((p:any)=> {
            const pg = (p.parameterGroup && p.parameterGroup.name) || p.parameterGroupName || ''
            return String(pg).toLowerCase().includes('body')
          })
          const classes = params.filter((p:any)=> {
            const pg = (p.parameterGroup && p.parameterGroup.name) || p.parameterGroupName || ''
            return String(pg).toLowerCase().includes('class')
          })
          setBodyTypes(bodies)
          setClassifications(classes)
        }
      }catch(e){ /* ignore */ }
    })()
    return ()=>{ mounted = false }
  },[])

  function updateField(key: string, value: any){ setForm(f=> ({ ...f, [key]: value})); setErrors(e=> ({ ...e, [key]: '' })) }

  useEffect(()=>{ const m = vehicleMakes.find(x=> String(x.id) === String(form.vehicleMake) || x.id === form.vehicleMake); setMakeDisplay(m ? (m.name ?? '') : '') },[vehicleMakes, form.vehicleMake])
  useEffect(()=>{ const b = bodyTypes.find(x=> String(x.id) === String(form.bodyType) || x.id === form.bodyType); setBodyDisplay(b ? (b.name ?? '') : '') },[bodyTypes, form.bodyType])
  useEffect(()=>{ const c = classifications.find(x=> String(x.id) === String(form.classification) || x.id === form.classification); setClassDisplay(c ? (c.name ?? '') : '') },[classifications, form.classification])
  useEffect(() => {
    if (activeTab > visibleTabs.length - 1) setActiveTab(0)
  }, [activeTab, visibleTabs.length])

  function validate(){ const e: any = {}; if (!form.name || !String(form.name).trim()) e.name = 'Required'; if (!form.description || !String(form.description).trim()) e.description = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  async function handleSave(){
    if (!validate()){ showToast('Please fill required fields', 'error'); return }
    try{
      const body: any = { name: form.name, description: form.description }
      if (form.vehicleMake) {
        body.vehicleMakeId = Number(form.vehicleMake)
        body.VehicleMakeId = Number(form.vehicleMake)
      }
      if (form.bodyType) {
        body.bodyTypeParameterId = Number(form.bodyType)
        body.bodyParameterId = Number(form.bodyType)
        body.BodyParameterId = Number(form.bodyType)
        body.bodyTypeParameterID = Number(form.bodyType)
      }
      if (form.classification) {
        body.classificationParameterId = Number(form.classification)
        body.ClassificationParameterId = Number(form.classification)
      }
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await configService.createVehicleModel(body)
      else await configService.updateVehicleModel(id as string, body)
      showToast(isAdd ? 'Vehicle Model added' : 'Vehicle Model updated', 'success')
      navigate('/configuration/vehicle-models')
    }catch(e){ showToast('Error saving Vehicle Model', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Vehicle Model' : 'Manage Vehicle Model'}</h2>
      </div>

      <div className="mt-4">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px space-x-2">
            {visibleTabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 ${activeTab === index ? 'border-b-2 border-bosch-blue text-bosch-blue' : 'text-slate-600 hover:text-bosch-blue'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {activeTab === 0 && (
            <>
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">General Information</div>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span></label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Layers className="text-slate-400 shrink-0" size={16} />
                        <input placeholder="Name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                      </div>
                      {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700">Vehicle Make</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Truck className="text-slate-400 shrink-0" size={16} />
                        <input value={makeFilter || makeDisplay} onChange={e=>{ setMakeFilter(e.target.value); setShowMakeDropdown(true) }} onFocus={()=>{ setShowMakeDropdown(true); setMakeFilter(''); setMakeDisplay('') }} onBlur={()=>{ setTimeout(()=> setShowMakeDropdown(false),150) }} placeholder="Search vehicle make" className="w-full bg-transparent outline-none text-sm" />
                      </div>
                      {showMakeDropdown && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border rounded shadow-sm">
                          {vehicleMakes.filter(m=> (m.name||'').toLowerCase().includes((makeFilter||makeDisplay).toLowerCase())).map(m=> (
                            <div key={m.id} onMouseDown={()=>{ updateField('vehicleMake', String(m.id)); setMakeDisplay(m.name); setMakeFilter(''); setShowMakeDropdown(false) }} className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700">{m.name}</div>
                          ))}
                          {vehicleMakes.filter(m=> (m.name||'').toLowerCase().includes((makeFilter||makeDisplay).toLowerCase())).length === 0 && <div className="p-3 text-sm text-slate-500">No vehicle makes</div>}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700">Body Type</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Car className="text-slate-400 shrink-0" size={16} />
                        <input value={bodyFilter || bodyDisplay} onChange={e=>{ setBodyFilter(e.target.value); setShowBodyDropdown(true) }} onFocus={()=>{ setShowBodyDropdown(true); setBodyFilter(''); setBodyDisplay('') }} onBlur={()=>{ setTimeout(()=> setShowBodyDropdown(false),150) }} placeholder="Search body type" className="w-full bg-transparent outline-none text-sm" />
                      </div>
                      {showBodyDropdown && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border rounded shadow-sm">
                          {bodyTypes.filter(b=> (b.name||'').toLowerCase().includes((bodyFilter||bodyDisplay).toLowerCase())).map(b=> (
                            <div key={b.id} onMouseDown={()=>{ updateField('bodyType', String(b.id)); setBodyDisplay(b.name); setBodyFilter(''); setShowBodyDropdown(false) }} className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700">{b.name}</div>
                          ))}
                          {bodyTypes.filter(b=> (b.name||'').toLowerCase().includes((bodyFilter||bodyDisplay).toLowerCase())).length === 0 && <div className="p-3 text-sm text-slate-500">No body types</div>}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700">Classification</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Grid3x3 className="text-slate-400 shrink-0" size={16} />
                        <input value={classFilter || classDisplay} onChange={e=>{ setClassFilter(e.target.value); setShowClassDropdown(true) }} onFocus={()=>{ setShowClassDropdown(true); setClassFilter(''); setClassDisplay('') }} onBlur={()=>{ setTimeout(()=> setShowClassDropdown(false),150) }} placeholder="Search classification" className="w-full bg-transparent outline-none text-sm" />
                      </div>
                      {showClassDropdown && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border rounded shadow-sm">
                          {classifications.filter(c=> (c.name||'').toLowerCase().includes((classFilter||classDisplay).toLowerCase())).map(c=> (
                            <div key={c.id} onMouseDown={()=>{ updateField('classification', String(c.id)); setClassDisplay(c.name); setClassFilter(''); setShowClassDropdown(false) }} className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm text-slate-700">{c.name}</div>
                          ))}
                          {classifications.filter(c=> (c.name||'').toLowerCase().includes((classFilter||classDisplay).toLowerCase())).length === 0 && <div className="p-3 text-sm text-slate-500">No classifications</div>}
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
                <button onClick={()=>navigate('/configuration/vehicle-models')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
              </div>
            </>
          )}

          {activeTab === 1 && !isAdd && (
            <VehicleModelApplicableProductsTable vehicleModelId={id} />
          )}
        </div>
      </div>
    </div>
  )
}
