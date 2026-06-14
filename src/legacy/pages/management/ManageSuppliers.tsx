// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { MapPin, Phone, User } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import managementService from '../../services/managementService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import SupplierProductsTable from '../../components/tables/SupplierProductsTable'

const TABS = ['General Information', 'Products']

export default function ManageSuppliers(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)

  const [form, setForm] = useState<any>({ name:'', address:'', contactPerson:'', contactNumber:'' })
  const [errors, setErrors] = useState<any>({})
  const [activeTab, setActiveTab] = useState(0)

  useEffect(()=>{
    if (!id || isAdd) return
    ;(async ()=>{
      try{
        const data: any = await managementService.getSupplier(id as string)
        if (data) setForm({ name: data.name ?? '', address: data.address ?? '', contactPerson: data.contactPerson ?? '', contactNumber: data.contactNumber ?? '' })
      }catch(e){ showToast('Error loading Supplier', 'error') }
    })()
  },[id, isAdd, location.pathname, showToast])

  function updateField(key:string, value:any){ setForm((f:any)=> ({ ...f, [key]: value })); setErrors((e:any)=> ({ ...e, [key]: '' })) }
  function validate(){ const e:any = {}; if (!form.name || !String(form.name).trim()) e.name = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  async function handleSave(){ if (!validate()){ showToast('Please fill required fields', 'error'); return }
    try{
      const body: any = { name: form.name, address: form.address, contactPerson: form.contactPerson, contactNumber: form.contactNumber }
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await managementService.createSupplier(body)
      else await managementService.updateSupplier(id as string, body)
      showToast(isAdd ? 'Supplier added' : 'Supplier updated', 'success')
      navigate('/management/suppliers')
    }catch(e){ showToast('Error saving Supplier', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Supplier' : 'Manage Supplier'}</h2>
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
                  <div className="text-sm font-medium text-slate-700">Supplier Information</div>
                </div>

                <div className="p-4 grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span></label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <User className="text-slate-400" size={16} />
                      <input placeholder="Name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                    {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Contact Person</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <User className="text-slate-400" size={16} />
                        <input value={form.contactPerson} onChange={e=>updateField('contactPerson', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Contact Number</label>
                      <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                        <Phone className="text-slate-400" size={16} />
                        <input value={form.contactNumber} onChange={e=>updateField('contactNumber', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Address</label>
                    <div className="mt-2 bg-white border rounded">
                      <div className="flex items-start gap-2 px-3 py-2">
                        <MapPin className="text-slate-400 mt-1 shrink-0" size={16} />
                        <textarea rows={3} value={form.address} onChange={e=>updateField('address', e.target.value)} placeholder="Address" className="w-full bg-transparent outline-none text-sm resize-none" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={()=>navigate('/management/suppliers')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isAdd && activeTab === 1 && (
            <SupplierProductsTable supplierId={id} />
          )}
        </div>
      </div>
    </div>
  )
}
