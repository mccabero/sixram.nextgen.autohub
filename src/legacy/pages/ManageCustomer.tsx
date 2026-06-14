// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VehicleListTable from '../components/tables/VehicleListTable'
import CustomerEstimateTable from '../components/tables/CustomerEstimateTable'
import CustomerJobOrderTable from '../components/tables/CustomerJobOrderTable'
import CustomerInvoiceTable from '../components/tables/CustomerInvoiceTable'
import { ChevronDown, ChevronUp, User, Hash, Calendar, Mail, Phone, Percent, Building, MapPin, FileText } from 'lucide-react'
import { fetchCustomerById, updateCustomerById, createCustomer } from '../services/customerService'
import { useToast } from '../contexts/toast'
import ConfirmModal from '../components/ui/ConfirmModal'
import { useAuth } from '../auth/useAuth'
import { useShowIsChanganOption } from '../hooks/useShowIsChanganOption'

const TABS = ['Customer', 'Vehicles', 'Estimates', 'Service History', 'Sales Invoice History']

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

function generateNextCode(codes: string[]): string {
  let bestPrefix = ''
  let bestNum = 0
  let bestDigits = 4
  for (const code of codes) {
    const m = code.match(/^(.*?)(\d+)$/)
    if (!m) continue
    const num = parseInt(m[2], 10)
    if (num > bestNum) {
      bestPrefix = m[1]
      bestNum = num
      bestDigits = m[2].length
    }
  }
  return bestPrefix + String(bestNum + 1).padStart(bestDigits, '0')
}

export default function ManageCustomer(){
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const isAdd = id === 'add' || window.location.pathname === '/customers/add'

  const [customerName, setCustomerName] = useState<string | null>(null)
  const [active, setActive] = useState<number>(0)

  const [form, setForm] = useState<any>({
    isChangan: false,
    isActive: true,
    firstName: '',
    middleName: '',
    lastName: '',
    customerCode: '',
    birthday: '',
    gender: '',
    email: '',
    mobile: '',
    homeAddress: '',
    companyName: '',
    companyNo: '',
    companyAddress: '',
    laborDiscount: '0',
    productDiscount: '0',
    isVatExcept: false,
    isWithholdingAllowed: false,
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string,string>>({})

  function normalizeGender(val: any) {
    if (val === null || val === undefined) return ''
    if (typeof val === 'number') {
      if (val === 0) return 'female'
      if (val === 1) return 'male'
      if (val === 2) return 'female'
      return ''
    }
    const s = String(val).toLowerCase().trim()
    if (s === '0') return 'female'
    if (s === '1') return 'male'
    if (s === '2') return 'female'
    if (s === 'm' || s === 'male') return 'male'
    if (s === 'f' || s === 'female') return 'female'
    return s
  }

  function normalizeBirthday(val: any) {
    if (!val && val !== 0) return ''
    try {
      const d = new Date(val)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
    } catch {}
    const s = String(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return ''
  }

  const [openPersonal, setOpenPersonal] = useState<boolean>(() => {
    try { const v = localStorage.getItem('mc_openPersonal'); return v ? JSON.parse(v) : true } catch { return true }
  })
  const [openContact, setOpenContact] = useState<boolean>(() => {
    try { const v = localStorage.getItem('mc_openContact'); return v ? JSON.parse(v) : true } catch { return true }
  })
  const [openOther, setOpenOther] = useState<boolean>(() => {
    try { const v = localStorage.getItem('mc_openOther'); return v ? JSON.parse(v) : true } catch { return true }
  })

  useEffect(()=>{ try { localStorage.setItem('mc_openPersonal', JSON.stringify(openPersonal)) } catch{} },[openPersonal])
  useEffect(()=>{ try { localStorage.setItem('mc_openContact', JSON.stringify(openContact)) } catch{} },[openContact])
  useEffect(()=>{ try { localStorage.setItem('mc_openOther', JSON.stringify(openOther)) } catch{} },[openOther])

  useEffect(()=>{
    if (!id || id === 'add') return
    const ac = new AbortController()
    fetchCustomerById(id, ac.signal)
      .then((d:any)=>{
        const first = d?.firstName ?? d?.firstname ?? d?.givenName ?? d?.given_name
        const last = d?.lastName ?? d?.lastname ?? d?.familyName ?? d?.family_name
        const full = d?.name || d?.fullName || d?.full_name || (first || last ? `${first ?? ''}${first && last ? ' ' : ''}${last ?? ''}`.trim() : undefined)
        if (full) setCustomerName(full)

        const src = d?.data ?? d?.customer ?? d

        const srcName = src?.name ?? src?.fullName ?? src?.full_name ?? undefined
        let computedFirst: string | undefined = first ?? undefined
        let computedLast: string | undefined = last ?? undefined
        if ((computedFirst === undefined || computedFirst === null) && (computedLast === undefined || computedLast === null) && srcName) {
          const parts = String(srcName).trim().split(/\s+/)
          if (parts.length > 0) {
            computedFirst = parts.shift() || ''
            computedLast = parts.join(' ') || ''
          }
        }
        setForm((f:any) => ({
          ...f,
          firstName: (typeof computedFirst !== 'undefined' ? computedFirst : (src?.firstName ?? src?.firstname ?? src?.givenName ?? src?.given_name ?? f.firstName)),
          middleName: src?.middleName ?? src?.middlename ?? src?.middle ?? f.middleName,
          lastName: (typeof computedLast !== 'undefined' ? computedLast : (src?.lastName ?? src?.lastname ?? src?.familyName ?? src?.family_name ?? f.lastName)),
          customerCode: src?.customerCode ?? src?.code ?? src?.customer_id ?? f.customerCode,
          birthday: normalizeBirthday(src?.birthday ?? src?.dateOfBirth ?? src?.dob ?? f.birthday),
          gender: normalizeGender((src?.gender ?? src?.sex ?? src?.genderIdentity) ?? f.gender),
          email: src?.email ?? src?.emailAddress ?? src?.email_address ?? f.email,
          mobile: src?.mobile ?? src?.mobileNumber ?? src?.mobile_number ?? f.mobile,
          homeAddress: src?.address ?? src?.homeAddress ?? src?.home_address ?? f.homeAddress,
          companyName: src?.companyName ?? src?.company_name ?? src?.company ?? f.companyName,
          companyAddress: src?.companyAddress ?? src?.company_address ?? f.companyAddress,
          laborDiscount: (
            typeof src?.laborDiscount !== 'undefined' ? String(src.laborDiscount) :
            typeof src?.laborDiscountRate !== 'undefined' ? String(src.laborDiscountRate) :
            typeof src?.LaborDiscountRate !== 'undefined' ? String(src.LaborDiscountRate) :
            typeof src?.labor_discount !== 'undefined' ? String(src.labor_discount) :
            typeof src?.LabourDiscountRate !== 'undefined' ? String(src.LabourDiscountRate) :
            typeof src?.labourDiscountRate !== 'undefined' ? String(src.labourDiscountRate) :
            typeof src?.laborDiscountRage !== 'undefined' ? String(src.laborDiscountRage) :
            f.laborDiscount
          ),
          productDiscount: (
            typeof src?.productDiscount !== 'undefined' ? String(src.productDiscount) :
            typeof src?.productDiscountRate !== 'undefined' ? String(src.productDiscountRate) :
            typeof src?.ProductDiscountRate !== 'undefined' ? String(src.ProductDiscountRate) :
            typeof src?.product_discount !== 'undefined' ? String(src.product_discount) :
            typeof src?.productDiscountRage !== 'undefined' ? String(src.productDiscountRage) :
            f.productDiscount
          ),
          companyNo: src?.CompanyNo ?? src?.companyNo ?? src?.CompanyContactNumber ?? src?.companyContact ?? src?.companyContactNumber ?? src?.company_contact ?? src?.companyNumber ?? f.companyNo,
          isVatExcept: typeof src?.isVatExcept !== 'undefined' ? Boolean(src.isVatExcept) : (typeof src?.is_vat_except !== 'undefined' ? Boolean(src.is_vat_except) : f.isVatExcept),
          isWithholdingAllowed: typeof src?.isWithholdingAllowed !== 'undefined' ? Boolean(src.isWithholdingAllowed) : (typeof src?.is_withholding_allowed !== 'undefined' ? Boolean(src.is_withholding_allowed) : f.isWithholdingAllowed),
          isChangan: typeof src?.isChangan !== 'undefined' ? Boolean(src.isChangan) : (typeof src?.is_changan !== 'undefined' ? Boolean(src.is_changan) : f.isChangan),
          isActive: typeof src?.isActive !== 'undefined' ? Boolean(src.isActive) : (typeof src?.is_active !== 'undefined' ? Boolean(src.is_active) : f.isActive),
          notes: src?.notes ?? src?.remarks ?? f.notes,
        }))
      })
      .catch(()=>{})
    return ()=> ac.abort()
  },[id])

  useEffect(() => {
    if (!isAdd) return
    const ac = new AbortController()
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    fetch('/api/customers', { signal: ac.signal, headers })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data) return
        const list: any[] = Array.isArray(data) ? data : (data.customers ?? data.items ?? data.data ?? [])
        const codes = list.map((c: any) => c.customerCode ?? c.CustomerCode ?? c.code ?? '').filter(Boolean)
        const nextCode = generateNextCode(codes)
        setForm((f: any) => ({ ...f, customerCode: nextCode }))
      })
      .catch(() => {})
    return () => ac.abort()
  }, [isAdd])

  function updateField(key:any, value:any){ setForm((f:any) => ({ ...f, [key]: value })); setErrors((e:any)=> ({ ...e, [String(key)]: '' })) }

  function validate(){
    const e: Record<string,string> = {}
    if (!form.firstName) e.firstName = 'Required'
    if (!form.lastName) e.lastName = 'Required'
    if (!form.customerCode) e.customerCode = 'Required'
    if (!form.birthday) e.birthday = 'Required'
    if (!form.gender) e.gender = 'Required'
    if (!form.mobile) e.mobile = 'Required'
    if (!form.laborDiscount) e.laborDiscount = 'Required'
    if (!form.productDiscount) e.productDiscount = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave(){
    if (!validate()) { try { showToast('Please fill required fields before saving.', 'error') } catch {} ; return }
    setShowConfirm(true)
  }

  const [showConfirm, setShowConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { showToast } = useToast()
  const { user: authUser } = useAuth()
  const showIsChanganOption = useShowIsChanganOption()

  async function proceedUpdate() {
    if (!id || id === 'add') {
      try {
        const createDto: Record<string, any> = {
          isChangan: !!form.isChangan,
          firstName: form.firstName ?? '',
          middleName: form.middleName ?? '',
          lastName: form.lastName ?? '',
          gender: (function(g:any){ if (g===null||g===undefined) return null; if (typeof g==='number') return g; const s=String(g).toLowerCase().trim(); if (s==='male'||s==='m'||s==='1') return 1; if (s==='female'||s==='f'||s==='0') return 0; const n=Number(s); return Number.isFinite(n)?n:null })(form.gender),
          birthday: form.birthday || null,
          customerCode: form.customerCode ?? '',
          mobileNumber: form.mobile ?? null,
          email: form.email ?? null,
          homeAddress: form.homeAddress ?? null,
          notes: form.notes ?? null,
          companyName: form.companyName ?? null,
          companyAddress: form.companyAddress ?? null,
          companyNo: form.companyNo ?? null,
          isActive: !!form.isActive,
          laborDiscountRate: (form.laborDiscount !== '' && form.laborDiscount != null) ? Number(form.laborDiscount) : 0,
          productDiscountRate: (form.productDiscount !== '' && form.productDiscount != null) ? Number(form.productDiscount) : 0,
          isVATExempt: !!form.isVatExcept,
          isAllowWithholidingTax: !!form.isWithholdingAllowed,
        }

        await createCustomer(createDto)
        setShowConfirm(false)
        try { showToast('Customer added successfully', 'success') } catch {}
        try { navigate('/customers') } catch {}
        return
      } catch (e:any) {
        try { showToast('Failed to add customer: ' + (e?.message ?? 'Unknown error'), 'error') } catch {}
        setShowConfirm(false)
        return
      }
    }
    setIsSaving(true)
    try {
      function genderToNumber(g: any) {
        if (g === null || g === undefined) return null
        if (typeof g === 'number') return g
        const s = String(g).toLowerCase().trim()
        if (s === 'male' || s === 'm' || s === '1') return 1
        if (s === 'female' || s === 'f' || s === '0') return 0
        const n = Number(s)
        return Number.isFinite(n) ? n : null
      }

      const dto: Record<string, any> = {
        isChangan: !!form.isChangan,
        firstName: form.firstName ?? '',
        middleName: form.middleName ?? '',
        lastName: form.lastName ?? '',
        gender: genderToNumber(form.gender),
        birthday: form.birthday || null,
        customerCode: form.customerCode ?? '',
        mobileNumber: form.mobile ?? null,
        email: form.email ?? null,
        homeAddress: form.homeAddress ?? null,
        notes: form.notes ?? null,
        companyName: form.companyName ?? null,
        companyAddress: form.companyAddress ?? null,
        companyNo: form.companyNo ?? null,
        isActive: !!form.isActive,
        laborDiscountRate: (form.laborDiscount !== '' && form.laborDiscount != null) ? Number(form.laborDiscount) : 0,
        productDiscountRate: (form.productDiscount !== '' && form.productDiscount != null) ? Number(form.productDiscount) : 0,
        isVATExempt: !!form.isVatExcept,
        isAllowWithholidingTax: !!form.isWithholdingAllowed,
        updatedById: 0
      }

      const resolvedUpdatedById = Number(
        authUser?.id ?? authUser?.userId ?? authUser?.Id ?? authUser?.createdById ?? authUser?.sub ?? 0
      )

      const payload: Record<string, any> = {
        ...dto,
        updatedById: Number.isFinite(resolvedUpdatedById) ? resolvedUpdatedById : 0,
      }

      await updateCustomerById(id, payload)
      setShowConfirm(false)
      try { showToast('Customer updated successfully', 'success') } catch {}
      try { navigate('/customers') } catch {}
    } catch (e:any) {
      try { showToast('Failed to update customer: ' + (e?.message ?? 'Unknown error'), 'error') } catch {}
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Customer' : 'Manage Customer'}</h2>
        {customerName && !isAdd && <div className="text-sm text-slate-500">{customerName}</div>}
      </div>

      <div className="mt-4">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px space-x-2">
            {TABS.map((t, idx) => {
              if (isAdd && idx !== 0) return null
              return (
                <button key={t} onClick={() => setActive(idx)} className={`px-4 py-2 ${active === idx ? 'border-b-2 border-bosch-blue text-bosch-blue' : 'text-slate-600 hover:text-bosch-blue'}`}>{t}</button>
              )
            })}
          </nav>
        </div>

        <div className="mt-6">
          {active === 0 ? (
            <div className="flex flex-col gap-4">

              {/* Personal Information */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700">Personal Information</div>
                    <button onClick={() => setOpenPersonal(s => !s)} className="p-1 text-slate-700">{openPersonal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  </div>
                  {openPersonal && (
                    <div className="p-4 grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {showIsChanganOption && (
                          <div>
                            <div className="text-sm font-medium text-slate-700 mb-2">Changan Client?</div>
                            <div className="flex items-center gap-2">
                              <Toggle checked={!!form.isChangan} onChange={v => updateField('isChangan', v)} />
                              <span className="text-sm text-slate-500">{form.isChangan ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-slate-700 mb-2">Is Active?</div>
                          <div className="flex items-center gap-2">
                            <Toggle checked={!!form.isActive} onChange={v => updateField('isActive', v)} />
                            <span className="text-sm text-slate-500">{form.isActive ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">First Name <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.firstName ? 'border-rose-500' : ''}`}>
                            <User className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="First name" value={form.firstName} onChange={e => updateField('firstName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                          {errors.firstName && <div className="text-rose-600 text-sm mt-1">{errors.firstName}</div>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Middle Name</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <User className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="Middle name" value={form.middleName} onChange={e => updateField('middleName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Last Name <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.lastName ? 'border-rose-500' : ''}`}>
                            <User className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="Last name" value={form.lastName} onChange={e => updateField('lastName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                          {errors.lastName && <div className="text-rose-600 text-sm mt-1">{errors.lastName}</div>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Customer Code <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2 ${errors.customerCode ? 'border-rose-500' : ''}`}>
                            <Hash className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="CUST-000" value={form.customerCode} onChange={e => updateField('customerCode', e.target.value)} disabled className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                          </div>
                          {errors.customerCode && <div className="text-rose-600 text-sm mt-1">{errors.customerCode}</div>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Birthday <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.birthday ? 'border-rose-500' : ''}`}>
                            <Calendar className="text-slate-400 shrink-0" size={16} />
                            <input type="date" value={form.birthday} onChange={e => updateField('birthday', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                          {errors.birthday && <div className="text-rose-600 text-sm mt-1">{errors.birthday}</div>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">Gender <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-6 h-[38px] px-3 border rounded ${errors.gender ? 'border-rose-500' : 'border-transparent'}`}>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" name="gender" value="male" checked={form.gender==='male'} onChange={e=>updateField('gender', e.target.value)} /> <span>Male</span></label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="radio" name="gender" value="female" checked={form.gender==='female'} onChange={e=>updateField('gender', e.target.value)} /> <span>Female</span></label>
                          </div>
                          {errors.gender && <div className="text-rose-600 text-sm mt-1">{errors.gender}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700">Contact Information</div>
                    <button onClick={() => setOpenContact(s => !s)} className="p-1 text-slate-700">{openContact ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  </div>
                  {openContact && (
                    <div className="p-4 grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Email Address</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <Mail className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="name@example.com" value={form.email} onChange={e => updateField('email', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Mobile Number <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.mobile ? 'border-rose-500' : ''}`}>
                            <Phone className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="0917-123-4567" value={form.mobile} onChange={e => updateField('mobile', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                          {errors.mobile && <div className="text-rose-600 text-sm mt-1">{errors.mobile}</div>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Home Address</label>
                        <div className="mt-2 flex items-start gap-2 bg-white border rounded px-3 py-2">
                          <MapPin className="text-slate-400 shrink-0 mt-0.5" size={16} />
                          <textarea placeholder="House no., street, barangay, city" value={form.homeAddress} onChange={e => updateField('homeAddress', e.target.value)} className="w-full bg-transparent outline-none text-sm resize-none h-20" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Company Name</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <Building className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="Company name (optional)" value={form.companyName} onChange={e => updateField('companyName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Company Contact Number</label>
                          <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                            <Phone className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="(02) 1234-5678" value={form.companyNo} onChange={e => updateField('companyNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Company Address</label>
                        <div className="mt-2 flex items-start gap-2 bg-white border rounded px-3 py-2">
                          <MapPin className="text-slate-400 shrink-0 mt-0.5" size={16} />
                          <textarea placeholder="Company address" value={form.companyAddress} onChange={e => updateField('companyAddress', e.target.value)} className="w-full bg-transparent outline-none text-sm resize-none h-20" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Other Information */}
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700">Other Information</div>
                    <button onClick={() => setOpenOther(s => !s)} className="p-1 text-slate-700">{openOther ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  </div>
                  {openOther && (
                    <div className="p-4 grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Labor Discount Rate <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.laborDiscount ? 'border-rose-500' : ''}`}>
                            <Percent className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="e.g. 10" value={form.laborDiscount} onChange={e => updateField('laborDiscount', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                          {errors.laborDiscount && <div className="text-rose-600 text-sm mt-1">{errors.laborDiscount}</div>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Product Discount Rate <span className="text-rose-600">*</span></label>
                          <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${errors.productDiscount ? 'border-rose-500' : ''}`}>
                            <Percent className="text-slate-400 shrink-0" size={16} />
                            <input placeholder="e.g. 5" value={form.productDiscount} onChange={e => updateField('productDiscount', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          </div>
                          {errors.productDiscount && <div className="text-rose-600 text-sm mt-1">{errors.productDiscount}</div>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        <div>
                          <div className="text-sm font-medium text-slate-700 mb-2">VAT Exempt?</div>
                          <div className="flex items-center gap-2">
                            <Toggle checked={!!form.isVatExcept} onChange={v => updateField('isVatExcept', v)} />
                            <span className="text-sm text-slate-500">{form.isVatExcept ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-700 mb-2">Allow Withholding Tax?</div>
                          <div className="flex items-center gap-2">
                            <Toggle checked={!!form.isWithholdingAllowed} onChange={v => updateField('isWithholdingAllowed', v)} />
                            <span className="text-sm text-slate-500">{form.isWithholdingAllowed ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">Customer Notes / Remarks</label>
                        <div className="mt-2 flex items-start gap-2 bg-white border rounded px-3 py-2">
                          <FileText className="text-slate-400 shrink-0 mt-0.5" size={16} />
                          <textarea placeholder="Optional notes about the customer" value={form.notes} onChange={e => updateField('notes', e.target.value)} className="w-full bg-transparent outline-none text-sm resize-none h-24" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pb-4">
                <button onClick={() => navigate('/customers')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white rounded shadow-sm">
              {active === 1 ? (
                <VehicleListTable customerId={id} />
              ) : active === 2 ? (
                <CustomerEstimateTable customerId={id} />
              ) : active === 3 ? (
                <CustomerJobOrderTable customerId={id} />
              ) : active === 4 ? (
                <CustomerInvoiceTable customerId={id} />
              ) : (
                <div className="text-sm text-slate-600">Content for "{TABS[active]}" will go here.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title={(!id || id === 'add') ? 'Confirm Add' : 'Confirm Update'}
        message={(!id || id === 'add') ? 'Are you sure you want to add this customer?' : "Do you really want to update this customer's information?"}
        confirmLabel={(!id || id === 'add') ? 'Add' : 'Proceed'}
        cancelLabel="Cancel"
        onConfirm={proceedUpdate}
        onCancel={() => setShowConfirm(false)}
        loading={isSaving}
      />
    </div>
  )
}
