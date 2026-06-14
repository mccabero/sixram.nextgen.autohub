// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { User, Mail, Phone, Lock, MapPin, Calendar, Shield } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { getUserById, createUser, updateUser, getRoles, checkPinAvailability } from '../../services/adminService'

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

export default function ManageUser(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const isAdd = !id || id === 'add'
  const { showToast } = useToast()
  const { logout } = useAuth()

  const [, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', email: '', mobile: '', password: '', confirmPassword: '', pin: isAdd ? '111111' : '', confirmPin: isAdd ? '111111' : '', primaryRole: '', gender: '', birthday: '', isActive: true, address: '' })

  const [allRoles, setAllRoles] = useState<any[]>([])
  const [availableRoles, setAvailableRoles] = useState<any[]>([])
  const [assignedRoles, setAssignedRoles] = useState<any[]>([])
  const [pinAvailability, setPinAvailability] = useState<{ status: 'idle' | 'checking' | 'available' | 'unavailable' | 'error'; message: string }>({ status: 'idle', message: '' })
  const rolesPopulated = React.useRef(false)

  useEffect(()=>{
    let mounted = true
    const load = async ()=>{
      setLoading(true)
      try{
        const rolesRes:any = await getRoles()
        if (!mounted) return
        const parsed = Array.isArray(rolesRes) ? rolesRes.map(r=>({ id: r.id ?? r.Id ?? r.ID, name: r.name ?? r.Name ?? r.roleName ?? String(r) })) : []
        setAllRoles(parsed)
        setAvailableRoles(parsed)
      }catch(e:any){ /* Failed to load roles */ }
      finally{ if (mounted) setLoading(false) }
    }
    load()
    return ()=>{ mounted = false }
  },[])

  const [userData, setUserData] = useState<any>(null)

  useEffect(()=>{ rolesPopulated.current = false },[id])

  useEffect(()=>{
    if (!id || isAdd) return
    let mounted = true
    const load = async ()=>{
      setLoading(true)
      try{
        const res:any = await getUserById(id!)
        if (!mounted) return
        if (res){
          setForm({
            firstName: res.firstName ?? res.firstname ?? res.FirstName ?? res.first_name ?? res.fname ?? '',
            middleName: res.middleName ?? res.MiddleName ?? res.middle_name ?? res.mname ?? '',
            lastName: res.lastName ?? res.LastName ?? res.last_name ?? res.lname ?? '',
            email: res.email ?? res.Email ?? res.emailAddress ?? '',
            mobile: res.mobile ?? res.Mobile ?? res.phone ?? res.mobileNumber ?? '',
            password: '',
            confirmPassword: '',
            pin: '',
            confirmPin: '',
            primaryRole: (res.primaryRole ?? res.PrimaryRole ?? res.primaryRoleId ?? res.PrimaryRoleId ?? res.roleId ?? res.RoleId) ?? '',
            gender: (res.gender ?? res.Gender ?? res.sex ?? '') ?? '',
            birthday: normalizeBirthdayValue(res.birthday ?? res.Birthday ?? res.dateOfBirth ?? res.dob ?? ''),
            isActive: (typeof res.isActive !== 'undefined') ? !!res.isActive : ((res.status ?? res.Status ?? '').toString().toLowerCase() === 'active'),
            address: res.address ?? res.Address ?? res.addr ?? ''
          })
          setUserData(res)
        }
      }catch(e:any){ const err=e as any; if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')){ try{ logout() }catch{} navigate('/login'); return } }
      finally{ if (mounted) setLoading(false) }
    }
    load()
    return ()=>{ mounted = false }
  },[id])

  useEffect(()=>{
    if (!userData || rolesPopulated.current) return
    if (availableRoles.length === 0) return

    const rawRoles = userData.roles ?? userData.userRoles ?? userData.Roles ?? userData.roleIds ?? []
    if (!Array.isArray(rawRoles) || rawRoles.length === 0) { rolesPopulated.current = true; return }

    const availMap = new Map(availableRoles.map(a => [String(a.id), a.name]))
    const assigned: any[] = []
    for (const r of rawRoles){
      if (r == null) continue
      let rid: any = r
      let rname: any = undefined
      if (typeof r === 'object'){
        rid = r.id ?? r.Id ?? r.ID ?? r.roleId ?? r.RoleId ?? r.role ?? r.Role ?? rid
        rname = r.name ?? r.Name ?? r.roleName ?? r.RoleName ?? r.role ?? r.Role
      }
      const ridStr = String(rid ?? '')
      if (!rname) rname = availMap.get(ridStr) ?? (typeof rid === 'string' ? rid : ridStr)
      assigned.push({ id: rid, name: rname })
    }

    const primaryRoleIdRaw = userData.primaryRole ?? userData.PrimaryRole ?? userData.primaryRoleId ?? userData.PrimaryRoleId ?? userData.roleId ?? userData.RoleId
    if (primaryRoleIdRaw) {
      const primIdStr = String(primaryRoleIdRaw)
      if (!assigned.some(a => String(a.id) === primIdStr)) {
        assigned.push({ id: primaryRoleIdRaw, name: availMap.get(primIdStr) ?? primIdStr })
      }
    }

    const assignedIds = new Set(assigned.map(a => String(a.id)))
    setAvailableRoles(prev => prev.filter(a => !assignedIds.has(String(a.id))))
    setAssignedRoles(assigned)
    rolesPopulated.current = true
  },[userData, availableRoles])

  function onDragStart(e: React.DragEvent, item: any, source: 'available'|'assigned'){
    e.dataTransfer.setData('application/json', JSON.stringify({ item, source }))
  }

  function onDropToAssigned(e: React.DragEvent){
    e.preventDefault()
    try{
      const d = e.dataTransfer.getData('application/json')
      if (!d) return
      const { item, source } = JSON.parse(d)
      if (source === 'available'){
        setAvailableRoles(a=> a.filter(x=> (x.id ?? x.Id ?? x.ID) !== (item.id ?? item.Id ?? item.ID)))
        setAssignedRoles(a=> [ ...(a), { id: item.id ?? item.Id ?? item.ID, name: item.name ?? item.Name ?? item.roleName ?? '' } ])
      }
    }catch(e){ /* drag error */ }
  }

  function onDropToAvailable(e: React.DragEvent){
    e.preventDefault()
    try{
      const d = e.dataTransfer.getData('application/json')
      if (!d) return
      const { item, source } = JSON.parse(d)
      if (source === 'assigned'){
        const itemId = item.id ?? item.Id ?? item.ID
        setAssignedRoles(a=> a.filter(x=> x.id !== itemId))
        setAvailableRoles(a=> [ ...(a), { id: itemId, name: item.name ?? item.Name ?? item.roleName ?? '' } ])
        if (String(itemId) === String(form.primaryRole)) updateField('primaryRole', '')
      }
    }catch(e){ /* drag error */ }
  }

  function allowDrop(e: React.DragEvent){ e.preventDefault() }

  function updateField(key:string, value:any){ setForm(f=> ({ ...f, [key]: value })) }

  function updatePinField(key: 'pin' | 'confirmPin', value: string) {
    updateField(key, value.replace(/\D/g, '').slice(0, 6))
  }

  useEffect(() => {
    let mounted = true
    const pin = form.pin
    if (!pin) {
      setPinAvailability({ status: 'idle', message: '' })
      return () => { mounted = false }
    }
    if (pin.length < 6) {
      setPinAvailability({ status: 'idle', message: 'PIN must be exactly 6 numbers.' })
      return () => { mounted = false }
    }
    if (!/^\d{6}$/.test(pin)) {
      setPinAvailability({ status: 'error', message: 'PIN must be exactly 6 numbers.' })
      return () => { mounted = false }
    }

    setPinAvailability({ status: 'checking', message: 'Checking PIN availability...' })
    const timer = window.setTimeout(async () => {
      try {
        const available = await checkPinAvailability(pin, isAdd ? null : id)
        if (!mounted) return
        setPinAvailability(available
          ? { status: 'available', message: 'PIN is available.' }
          : { status: 'unavailable', message: 'PIN is not available. Please choose another 6-digit PIN.' })
      } catch (error: any) {
        if (!mounted) return
        setPinAvailability({ status: 'error', message: error?.message || 'Unable to check PIN availability.' })
      }
    }, 350)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [form.pin, id, isAdd])

  function normalizeBirthdayValue(value: any) {
    if (!value) return ''
    const raw = String(value)
    if (raw.startsWith('1753-01-01') || raw.startsWith('0001-01-01')) return ''
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return ''
    return raw.includes('T') ? raw.slice(0, 10) : raw
  }

  function handlePrimaryRoleChange(newRoleId: string){
    const oldRoleId = form.primaryRole
    let newAvailable = [...availableRoles]
    let newAssigned = [...assignedRoles]

    if (oldRoleId && String(oldRoleId) !== String(newRoleId)){
      const oldRole = newAssigned.find(r => String(r.id) === String(oldRoleId))
      if (oldRole){
        newAssigned = newAssigned.filter(r => String(r.id) !== String(oldRoleId))
        if (!newAvailable.some(r => String(r.id) === String(oldRoleId)))
          newAvailable = [...newAvailable, { id: oldRole.id, name: oldRole.name }]
      }
    }

    if (newRoleId){
      const newRole = newAvailable.find(r => String(r.id) === String(newRoleId))
      if (newRole){
        newAvailable = newAvailable.filter(r => String(r.id) !== String(newRoleId))
        if (!newAssigned.some(r => String(r.id) === String(newRoleId)))
          newAssigned = [...newAssigned, { id: newRole.id, name: newRole.name }]
      }
    }

    setAvailableRoles(newAvailable)
    setAssignedRoles(newAssigned)
    updateField('primaryRole', newRoleId)
  }

  function genderToInt(g: string): number | null {
    if (g === 'male') return 0
    if (g === 'female') return 1
    if (g === 'other') return 2
    return null
  }

  async function handleSave(){
    if (!form.firstName || !form.lastName || !form.email) { showToast('Please fill required fields','error'); return }
    if ((form.password || form.confirmPassword) && form.password !== form.confirmPassword){ showToast('Password and Confirm Password do not match','error'); return }
    if (form.pin || form.confirmPin) {
      if (form.pin !== form.confirmPin) { showToast('PIN and Confirm PIN do not match','error'); return }
      if (!/^\d{6}$/.test(form.pin)) { showToast('PIN must be exactly 6 numbers','error'); return }
      if (pinAvailability.status === 'unavailable') { showToast('PIN is not available. Please choose another 6-digit PIN.','error'); return }
      if (pinAvailability.status === 'checking') { showToast('Please wait while the PIN availability is checked.','error'); return }
    }
    setSaving(true)
    try{
      if (isAdd){
        const payload = {
          email: form.email,
          password: form.password,
          firstname: form.firstName,
          middleName: form.middleName || null,
          lastName: form.lastName,
          mobileNumber: form.mobile || null,
          gender: genderToInt(form.gender),
          birthday: form.birthday || null,
          address: form.address || null,
          isActive: form.isActive,
          roleId: form.primaryRole ? Number(form.primaryRole) : undefined,
          pin: form.pin || undefined,
        }
        await createUser(payload)
        showToast('User created','success')
      } else {
        const payload: Record<string, any> = {
          email: form.email,
          firstname: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          mobileNumber: form.mobile,
          gender: genderToInt(form.gender),
          birthday: form.birthday || null,
          address: form.address,
          isActive: form.isActive,
          roleId: form.primaryRole ? Number(form.primaryRole) : null,
          roles: assignedRoles.map(r => r.id),
        }
        if (form.password) payload.password = form.password
        if (form.pin) payload.pin = form.pin
        await updateUser(id!, payload)
        showToast('User updated','success')
      }
      navigate('/administrators/user-accounts')
    }catch(e:any){ showToast('Save failed: '+(e?.message||'Unknown'),'error') }
    finally{ setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add User' : 'Manage User'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        {/* User Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">User Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">First Name <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="First name" value={form.firstName} onChange={e=>updateField('firstName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Middle Name</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Middle name" value={form.middleName} onChange={e=>updateField('middleName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Last Name <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Last name" value={form.lastName} onChange={e=>updateField('lastName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mobile</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Phone className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="0917-123-4567" value={form.mobile} onChange={e=>updateField('mobile', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Mail className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="name@example.com" value={form.email} onChange={e=>updateField('email', e.target.value)} autoComplete="off" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Gender</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <select value={form.gender ?? ''} onChange={e=>updateField('gender', e.target.value)} className="w-full bg-transparent outline-none text-sm">
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Password {isAdd && <span className="text-rose-600">*</span>}</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Lock className="text-slate-400 shrink-0" size={16} />
                    <input type="password" placeholder="Password" value={form.password} onChange={e=>updateField('password', e.target.value)} autoComplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Lock className="text-slate-400 shrink-0" size={16} />
                    <input type="password" placeholder="Confirm password" value={form.confirmPassword ?? ''} onChange={e=>updateField('confirmPassword', e.target.value)} autoComplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">PIN {isAdd && <span className="text-rose-600">*</span>}</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Lock className="text-slate-400 shrink-0" size={16} />
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder={isAdd ? '111111' : 'Leave blank to keep PIN'}
                      value={form.pin ?? ''}
                      onChange={e=>updatePinField('pin', e.target.value)}
                      autoComplete="off"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </div>
                  {pinAvailability.message && (
                    <div
                      className={`mt-1 text-xs ${
                        pinAvailability.status === 'available'
                          ? 'text-emerald-600'
                          : pinAvailability.status === 'checking'
                            ? 'text-slate-500'
                            : 'text-rose-600'
                      }`}
                    >
                      {pinAvailability.message}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirm PIN {isAdd && <span className="text-rose-600">*</span>}</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Lock className="text-slate-400 shrink-0" size={16} />
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder={isAdd ? '111111' : 'Confirm new PIN'}
                      value={form.confirmPin ?? ''}
                      onChange={e=>updatePinField('confirmPin', e.target.value)}
                      autoComplete="off"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Primary User Role</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Shield className="text-slate-400 shrink-0" size={16} />
                    <select value={form.primaryRole ?? ''} onChange={e=>handlePrimaryRoleChange(e.target.value)} className="w-full bg-transparent outline-none text-sm">
                      <option value="">Select role</option>
                      {allRoles.map(r=> (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Birthday</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.birthday} onChange={e=>updateField('birthday', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700">Is Active?</div>
                  <div className="mt-2 flex items-center gap-2 h-[38px]">
                    <Toggle checked={!!form.isActive} onChange={v => updateField('isActive', v)} />
                    <span className="text-sm text-slate-500">{form.isActive ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Address</label>
                <div className="mt-2 flex items-start gap-2 bg-white border rounded px-3 py-2">
                  <MapPin className="text-slate-400 shrink-0 mt-0.5" size={16} />
                  <textarea placeholder="Street, city, country" value={form.address} onChange={e=>updateField('address', e.target.value)} className="w-full bg-transparent outline-none text-sm resize-none h-20" />
                </div>
              </div>

              {/* Notes removed per request */}

            </div>
          </div>
        </div>

        {/* Additional Roles */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Additional Roles</div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-amber-600 font-medium mb-2">AVAILABLE ROLES</div>
                <div onDragOver={allowDrop} onDrop={onDropToAvailable} className="min-h-[300px] p-3 bg-amber-50 rounded border border-amber-100">
                  {availableRoles.map(r => (
                    <div key={r.id} draggable onDragStart={e => onDragStart(e, r, 'available')} className="bg-white p-3 mb-3 rounded shadow-sm border border-slate-100 cursor-move text-sm text-slate-700">{r.name}</div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-emerald-600 font-medium mb-2">ASSIGNED ROLES</div>
                <div onDragOver={allowDrop} onDrop={onDropToAssigned} className="min-h-[300px] p-3 bg-emerald-50 rounded border border-emerald-100">
                  {assignedRoles.map(r => (
                    <div key={r.id} draggable onDragStart={e => onDragStart(e, r, 'assigned')} className="bg-white p-3 mb-3 rounded shadow-sm border border-slate-100 cursor-move text-sm text-slate-700">{r.name}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate('/administrators/user-accounts')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + (saving ? ' opacity-70 cursor-not-allowed' : '')}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  )
}
