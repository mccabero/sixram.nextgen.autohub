// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'

export default function ManageProductGroups(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)

  const [form, setForm] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({})

  useEffect(()=>{
    if (!id || isAdd) return
    ;(async ()=>{
      try{
        const data: any = await configService.getProductGroup(id as string)
        if (data) setForm({ name: data.name ?? '', description: data.description ?? '' })
      }catch(e){ showToast('Error loading Product Group', 'error') }
    })()
  },[id, location.pathname])

  function updateField(key: string, value: any){ setForm(f=> ({ ...f, [key]: value})); setErrors(e=> ({ ...e, [key]: '' })) }

  function validate(){ const e: any = {}; if (!form.name || !String(form.name).trim()) e.name = 'Required'; if (!form.description || !String(form.description).trim()) e.description = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  async function handleSave(){
    if (!validate()){ showToast('Please fill required fields', 'error'); return }
    try{
      const body: Record<string, any> = { name: form.name, description: form.description }
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await configService.createProductGroup(body)
      else await configService.updateProductGroup(id as string, body)
      showToast(isAdd ? 'Product Group added' : 'Product Group updated', 'success')
      navigate('/configuration/product-groups')
    }catch(e){ showToast('Error saving Product Group', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Product Group' : 'Manage Product Group'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">General Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Layers className="text-slate-400 shrink-0" size={16} />
                  <input placeholder="Name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                </div>
                {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
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
          <button onClick={()=>navigate('/configuration/product-groups')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
        </div>

      </div>
    </div>
  )
}
