// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export default function ManageAppointment(){
  const navigate = useNavigate()
  const params = useParams()
  const id = params.id

  const [item, setItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    if (!id) return
    ;(async ()=>{
      try{
        const res = await fetch(`/api/appointments/${id}`)
        if (!res.ok){ setItem(null); return }
        const data = await res.json()
        setItem(data)
      }catch(e){ setItem(null) }
    })()
  },[id])

  function goBack(){ navigate('/operations/appointments') }

  async function handleSave(){
    if (!item) return
    setSaving(true)
    try{
      try{
        await fetch(`/api/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(item) })
      }catch(e){ /* ignore */ }
      navigate('/operations/appointments')
    }catch(e){ alert('Failed to save') }
    finally{ setSaving(false) }
  }

  async function handleConvert(){
    if (!item) return
    // mark status as Converted and save
    const newItem = (item ? { ...item, status: 'Converted' } : null)
    setItem(newItem)
    try{ await fetch(`/api/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(newItem) }) }catch(e){ /* ignore */ }
    alert('Appointment converted')
    navigate('/operations/appointments')
  }

  if (!item) return <div className="p-4">Loading appointment...</div>

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manage Appointment</h2>
      </div>

      <div className="mt-4">
        <div className="p-4 bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Appointment Details</div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">First Name</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <input value={item.firstName} onChange={e=>setItem((s:any)=> ({ ...s, firstName: e.target.value }))} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Last Name</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <input value={item.lastName} onChange={e=>setItem((s:any)=> ({ ...s, lastName: e.target.value }))} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <select value={item.status} onChange={e=>setItem((s:any)=> ({ ...s, status: e.target.value }))} className="w-full bg-transparent outline-none text-sm">
                    <option>Scheduled</option>
                    <option>Confirmed</option>
                    <option>Cancelled</option>
                    <option>Completed</option>
                    <option>Converted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Mobile</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <input value={item.mobile} onChange={e=>setItem((s:any)=> ({ ...s, mobile: e.target.value }))} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <input value={item.email} onChange={e=>setItem((s:any)=> ({ ...s, email: e.target.value }))} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Schedule</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <input value={item.schedule} onChange={e=>setItem((s:any)=> ({ ...s, schedule: e.target.value }))} type="date" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Time</label>
                <div className="mt-2 bg-white border rounded px-3 py-2">
                  <input value={item.time} onChange={e=>setItem((s:any)=> ({ ...s, time: e.target.value }))} type="time" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={goBack} className="px-4 py-2 border rounded bg-white">Close</button>
                <button type="button" onClick={handleConvert} className="px-4 py-2 bg-yellow-500 text-white rounded">Convert Appointment</button>
                <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 bg-bosch-blue text-white rounded">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

}
