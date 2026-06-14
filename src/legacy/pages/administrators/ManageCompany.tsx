// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Building, Mail, Smartphone, MapPin, CreditCard, DollarSign, Hash, UploadCloud, RefreshCw, Image as ImageIcon, X } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { getCompanyById, createCompany, updateCompany, uploadCompanyLogo } from '../../services/adminService'

type CompanyForm = {
  id: number
  name: string
  email: string
  mobile: string
  address: string
  gcashAccount: string
  bankAccount: string
  tinNumber: string
  createdById: number
  createdDateTime: string
  updatedById: number
  updatedDateTime: string
  logoData: string
  logoFile: File | null
  isPrimaryCompany: boolean
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return Boolean(value)
}

function normalizeCompanyId(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

export default function ManageCompany(){
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const id = params.id
  const isAdd = !id || id === 'add' || location.pathname.endsWith('/add')
  const routeCompanyId = normalizeCompanyId(id)
  const { showToast } = useToast()
  const { logout } = useAuth()
  const [, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savedLogoData, setSavedLogoData] = useState('')
  const [form, setForm] = useState<CompanyForm>({ id: 0, name: '', email: '', mobile: '', address: '', gcashAccount: '', bankAccount: '', tinNumber: '', createdById: 0, createdDateTime: '', updatedById: 0, updatedDateTime: '', logoData: '', logoFile: null, isPrimaryCompany: false })

  useEffect(() => {
    if (isAdd) return
    if (!routeCompanyId) {
      showToast('Company record was not found. Please select a company again.', 'error')
      navigate('/administrators/company-information', { replace: true })
      return
    }

    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const res: any = await getCompanyById(routeCompanyId)
        if (!mounted) return
        if (res) {
          const logoPath = res.logo ?? res.logoUrl ?? res.Logo ?? ''
          setSavedLogoData(logoPath)
          setForm(f => ({
            ...f,
            id: normalizeCompanyId(res.id ?? res.Id ?? res.companyId ?? res.CompanyId) || routeCompanyId,
            name: res.name ?? res.Name ?? res.companyName ?? res.CompanyName ?? '',
            email: res.email ?? res.Email ?? '',
            mobile: res.mobileNumber ?? res.MobileNumber ?? res.mobile ?? res.Mobile ?? '',
            address: res.address ?? res.Address ?? '',
            gcashAccount: res.gCash ?? res.gcash ?? res.GCash ?? res.Gcash ?? '',
            bankAccount: res.bankNo ?? res.BankNo ?? res.bankAccount ?? res.BankAccount ?? '',
            tinNumber: res.tin ?? res.TIN ?? res.tinNumber ?? '',
            isPrimaryCompany: readBoolean(res.isPrimaryCompany ?? res.primaryCompany ?? res.IsPrimaryCompany ?? res.PrimaryCompany ?? false),
            logoData: logoPath || f.logoData,
            createdById: res.createdById ?? res.CreatedById ?? f.createdById ?? 0,
            createdDateTime: res.createdDateTime ?? res.CreatedDateTime ?? f.createdDateTime ?? '',
            updatedById: res.updatedById ?? res.UpdatedById ?? f.updatedById ?? 0,
            updatedDateTime: res.updatedDateTime ?? res.UpdatedDateTime ?? f.updatedDateTime ?? ''
          }))
        } else {
          showToast('Company record was not found. Please select a company again.', 'error')
          navigate('/administrators/company-information', { replace: true })
        }
      } catch (e: any) {
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        showToast('Company record was not found. Please select a company again.', 'error')
        navigate('/administrators/company-information', { replace: true })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [isAdd, routeCompanyId, logout, navigate, showToast])

  function updateField<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) { setForm(f => ({ ...f, [key]: value })) }

  function selectLogo(file: File | null) {
    if (!file) {
      updateField('logoFile', null)
      return
    }

    if (!file.type.startsWith('image/')) {
      showToast(`"${file.name}" is not an image`, 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(`"${file.name}" exceeds the 10 MB limit`, 'error')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setForm(f => ({
      ...f,
      logoData: previewUrl,
      logoFile: file
    }))
  }

  function clearSelectedLogo() {
    setForm(f => ({
      ...f,
      logoData: savedLogoData,
      logoFile: null
    }))
  }

  function validate(){
    const missing: string[] = []
    if (!form.name || !String(form.name).trim()) missing.push('Company Name')
    if (!form.email || !String(form.email).trim()) missing.push('Email')
    if (!form.mobile || !String(form.mobile).trim()) missing.push('Mobile')
    if (!form.address || !String(form.address).trim()) missing.push('Address')
    if (!form.tinNumber || !String(form.tinNumber).trim()) missing.push('TIN Number')

    if (missing.length > 0) {
      showToast('Please fill required fields: ' + missing.join(', '), 'error')
      return false
    }
    return true
  }

  async function handleSave(){
    if (!validate()) return
    if (isAdd) { setShowConfirm(true); return }
    await saveCompany(false)
  }

  async function confirmCreate(){
    setShowConfirm(false)
    await saveCompany(true)
  }

  async function saveCompany(addMode: boolean){
    if (!validate()) return
    const existingCompanyId = normalizeCompanyId(form.id) || routeCompanyId

    if (!addMode && !existingCompanyId) {
      showToast('Cannot update this company because its ID is missing.', 'error')
      navigate('/administrators/company-information', { replace: true })
      return
    }

    setSaving(true)
    try{
      showToast(addMode ? 'Creating company...' : 'Updating company...', 'info')

      const payload: any = {
        id: addMode ? 0 : existingCompanyId,
        name: form.name,
        address: form.address,
        email: form.email,
        mobileNumber: form.mobile,
        tin: form.tinNumber,
        gCash: form.gcashAccount,
        bankNo: form.bankAccount,
        isPrimaryCompany: form.isPrimaryCompany,
        createdById: form.createdById || undefined,
        createdDateTime: form.createdDateTime || undefined,
        updatedById: form.updatedById || undefined,
        updatedDateTime: new Date().toISOString()
      }
      let savedCompanyId = addMode ? 0 : existingCompanyId
      if (addMode) {
        const created: any = await createCompany(payload)
        savedCompanyId = Number(created?.id ?? created?.Id ?? created?.companyId ?? created?.CompanyId ?? 0)
        if (!savedCompanyId) throw new Error('Company was created but no company id was returned')
        showToast('Company added','success')
      } else {
        const updated: any = await updateCompany(existingCompanyId, payload)
        savedCompanyId = Number(updated?.id ?? updated?.Id ?? updated?.companyId ?? updated?.CompanyId ?? savedCompanyId)
        showToast('Company updated','success')
      }

      if (form.logoFile) {
        setLogoUploading(true)
        try {
          const res = await uploadCompanyLogo(savedCompanyId, form.logoFile)
          const url = res && (res.path || res.url || res['path'] || res['url'])
          if (url) {
            setSavedLogoData(url)
            setForm(f => ({ ...f, logoData: url, logoFile: null, id: savedCompanyId || f.id }))
          }
        } catch (e: any) {
          showToast('Logo upload failed: ' + (e?.message || 'Unknown'), 'error')
          if (addMode && savedCompanyId) {
            navigate(`/administrators/company/${savedCompanyId}`)
          }
          return
        } finally {
          setLogoUploading(false)
        }
      }

      navigate('/administrators/company-information')
    }catch(e:any){
      const err = e as any
      if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')){ try{ logout() }catch{} navigate('/login'); return }
      showToast((addMode ? 'Create failed: ' : 'Update failed: ') + (e?.message||'Unknown'),'error')
    }finally{
      setSaving(false)
      setLogoUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Company' : 'Manage Company'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Company Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Company Name <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Building className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Company name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Mail className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="name@example.com" value={form.email} onChange={e=>updateField('email', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              <label className="inline-flex w-fit items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isPrimaryCompany}
                  onChange={e => updateField('isPrimaryCompany', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-bosch-blue focus:ring-bosch-blue"
                />
                Primary Company
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mobile <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Smartphone className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="0917-123-4567" value={form.mobile} onChange={e=>updateField('mobile', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">TIN Number <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="TIN Number" value={form.tinNumber} onChange={e=>updateField('tinNumber', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">GCash Account No.</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <CreditCard className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="GCash account number" value={form.gcashAccount} onChange={e=>updateField('gcashAccount', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Bank Account No.</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <DollarSign className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Bank account number" value={form.bankAccount} onChange={e=>updateField('bankAccount', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Address <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-start gap-2 bg-white border rounded px-3 py-2">
                  <MapPin className="text-slate-400 shrink-0 mt-0.5" size={16} />
                  <textarea placeholder="Street, city, country" value={form.address} onChange={e=>updateField('address', e.target.value)} className="w-full bg-transparent outline-none text-sm resize-none h-20" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-700">Company Logo</label>
                      {form.logoData && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-medium border border-violet-100">
                          1 logo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {form.logoData && form.logoFile && (
                        <button
                          type="button"
                          onClick={clearSelectedLogo}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X size={13} /> Revert
                        </button>
                      )}
                      <input
                        id="company-logo-input"
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files ? e.target.files[0] : null
                          selectLogo(file)
                          e.currentTarget.value = ''
                        }}
                        disabled={saving}
                        className="hidden"
                      />
                      <label
                        htmlFor="company-logo-input"
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold shadow-sm tracking-wide ${saving ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer hover:bg-violet-700 transition-colors'}`}
                      >
                        <UploadCloud size={13} /> {form.logoData ? 'Replace Logo' : 'Upload Logo'}
                      </label>
                    </div>
                  </div>

                  {logoUploading ? (
                    <div className="border rounded-xl bg-slate-50 h-52 flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw size={16} className="animate-spin" />
                      <span className="text-sm">Uploading logo...</span>
                    </div>
                  ) : form.logoData ? (
                    <div className="flex flex-col gap-3">
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 shadow-lg h-52">
                        <img
                          src={form.logoData}
                          alt="Company logo preview"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
                          <p className="text-white text-xs truncate opacity-80 font-medium">
                            {form.logoFile ? form.logoFile.name : 'company logo'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <ImageIcon size={13} className="text-slate-400" />
                        <span>{form.logoFile ? 'New logo selected. Save to upload and replace the current logo.' : 'Current company logo loaded from the saved path.'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 h-52 flex flex-col items-center justify-center gap-2">
                      <UploadCloud size={32} className="text-slate-300" />
                      <p className="text-sm text-slate-400 font-medium">No logo yet</p>
                      <p className="text-xs text-slate-400">Click <span className="font-semibold">Upload Logo</span> to add a company logo</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-4">
          <button onClick={()=>navigate('/administrators/company-information')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || logoUploading} className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + ((saving || logoUploading) ? ' opacity-70 cursor-not-allowed' : '')}>
            {saving || logoUploading ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>

      <ConfirmModal isOpen={showConfirm} title="Confirm Create" message={`Are you sure you want to add company "${form.name}"?`} confirmLabel="Create" cancelLabel="Cancel" onConfirm={confirmCreate} onCancel={()=>setShowConfirm(false)} loading={saving} />
    </div>
  )
}
