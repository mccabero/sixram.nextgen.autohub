// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, Users, Tag, Phone, Mail, Calendar as CalendarIcon, Clock } from 'lucide-react'

export default function AddAppointment(){
  const navigate = useNavigate()
  const location = useLocation()
  const preselected: any = (location.state as any)?.selectedDate || null

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [status, setStatus] = useState('Scheduled')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [schedule, setSchedule] = useState(preselected || '')
  const [time, setTime] = useState('')
  const [appointmentType, setAppointmentType] = useState('Consultation')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const statusOptions = ['Scheduled','Confirmed','Cancelled','Completed']
  const typeOptions = ['Consultation','Maintenance','Repair','Inspection']

  useEffect(()=>{
    if (preselected) setSchedule(preselected)
  },[preselected])

  function goBack(){
    navigate('/operations/appointments')
  }

  async function handleSave(e:any){
    e.preventDefault()
    if (!firstName || !lastName || !status || !mobile || !schedule || !time || !appointmentType) {
      alert('Please fill required fields')
      return
    }
    setSaving(true)
    try{
      const token = localStorage.getItem('auth_token')
      const payload = {
        firstName, lastName, status, mobile, email, schedule, time, appointmentType, description
      }
      // attempt to save via backend only

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        // backend save failed
      }
      navigate('/operations/appointments')
    }catch(err){
      alert('Failed to save appointment')
    }finally{ setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Add Appointment</h2>
      </div>

      <div className="mt-4">
        <div className="p-4 bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Appointment Details</div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">First Name <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <User className="text-slate-400" />
                  <input required value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Last Name <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <User className="text-slate-400" />
                  <input required value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Status <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Users className="text-slate-400" />
                  <select required value={status} onChange={e=>setStatus(e.target.value)} className="w-full bg-transparent outline-none text-sm">
                    {statusOptions.map(s=> <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Appointment Type <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Tag className="text-slate-400" />
                  <select required value={appointmentType} onChange={e=>setAppointmentType(e.target.value)} className="w-full bg-transparent outline-none text-sm">
                    {typeOptions.map(t=> <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Mobile Number <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Phone className="text-slate-400" />
                  <input required value={mobile} onChange={e=>setMobile(e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address</label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Mail className="text-slate-400" />
                  <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Schedule <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <CalendarIcon className="text-slate-400" />
                  <input required value={schedule} onChange={e=>setSchedule(e.target.value)} type="date" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Appointment Time <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                  <Clock className="text-slate-400" />
                  <input required value={time} onChange={e=>setTime(e.target.value)} type="time" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <div className="mt-2 bg-white border rounded">
                  <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full p-3 bg-transparent outline-none text-sm" rows={4} />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={goBack} className="px-4 py-2 border rounded bg-white">Close</button>
                <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 bg-bosch-blue text-white rounded">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
