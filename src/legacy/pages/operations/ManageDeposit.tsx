// @ts-nocheck
import React, { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { Hash, Calendar, File, User, DollarSign, Tag, CreditCard, Briefcase, FileText } from 'lucide-react'
import { saveDeposit, updateDeposit } from '../../services/operationService'
import { useToast } from '../../contexts/toast'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

type DepositForm = {
  isChangan: boolean
  isRefund: boolean
  referenceNo: string
  jobStatusId?: number | string
  transactionDate: string
  customer: string
  jobOrderId?: string
  paymentType: string
  depositAmount: number
  paymentReferenceNo: string
  description: string
  refundAmount: number
  refundDate?: string
  refundReason: string
}

function CurrencyInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  function handleFocus() { setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setInputVal(e.target.value) }
  function handleBlur() { setFocused(false); onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} className={className} />
}

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

export default function ManageDeposit(){
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeId } = useParams<{ id: string }>()
  const isAddMode = location.pathname.endsWith('/add') || !routeId
  const { showToast } = useToast()
  const showIsChanganOption = useShowIsChanganOption()

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<DepositForm>({
    isChangan: false,
    isRefund: false,
    referenceNo: '',
    jobStatusId: undefined,
    transactionDate: new Date().toISOString().slice(0,10),
    customer: '',
    jobOrderId: '',
    paymentType: '',
    depositAmount: 0,
    paymentReferenceNo: '',
    description: '',
    refundAmount: 0,
    refundDate: undefined,
    refundReason: ''
  })

  function updateField(key: string, value: any){ setForm(f => ({ ...f, [key]: value })) }

  async function handleSave(){
    if (saving) return
    setSaving(true)
    try{
      const payload: Record<string, unknown> = {
        IsChangan: form.isChangan,
        IsRefund: form.isRefund,
        ReferenceNo: form.referenceNo || undefined,
        JobStatusId: form.jobStatusId ? Number(form.jobStatusId) : undefined,
        TransactionDateTime: form.transactionDate ? new Date(form.transactionDate).toISOString() : undefined,
        CustomerId: undefined,
        JobOrderId: form.jobOrderId ? Number(form.jobOrderId) : undefined,
        PaymentTypeParameterId: undefined,
        DepositAmount: Number(form.depositAmount) || 0,
        PaymentReferenceNo: form.paymentReferenceNo || undefined,
        Description: form.description || undefined,
        RefundAmount: form.isRefund ? Number(form.refundAmount) || 0 : undefined,
        RefundDateTime: form.isRefund && form.refundDate ? new Date(form.refundDate).toISOString() : undefined,
        RefundReason: form.isRefund ? form.refundReason || undefined : undefined
      }

      if (isAddMode) {
        await saveDeposit(payload)
      } else {
        await updateDeposit(routeId!, payload)
      }
      showToast('Deposit saved successfully', 'success')
      navigate('/operations/deposit')
    }catch(err:any){
      showToast(err instanceof Error ? err.message : 'Failed to save deposit', 'error')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAddMode ? 'Add Deposit' : 'Manage Deposit'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        {/* Deposit Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Deposit Information</div>
            </div>
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
                  <div className="text-sm font-medium text-slate-700 mb-2">Is Refund?</div>
                  <div className="flex items-center gap-2">
                    <Toggle checked={!!form.isRefund} onChange={v => updateField('isRefund', v)} />
                    <span className="text-sm text-slate-500">{form.isRefund ? 'Refund' : 'Normal'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <select value={String(form.jobStatusId ?? '')} onChange={e=>updateField('jobStatusId', e.target.value)} className="w-full bg-transparent outline-none text-sm">
                      <option value="">OPEN</option>
                      <option value="1">COMPLETED</option>
                      <option value="2">CANCELLED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference No.</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="DEP000123" value={form.referenceNo} onChange={e=>updateField('referenceNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Transaction Date</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e=>updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment Type</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <CreditCard className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Payment Type" value={form.paymentType} onChange={e=>updateField('paymentType', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Customer</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Customer" value={form.customer} onChange={e=>updateField('customer', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Job Order Id</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Briefcase className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Job Order Id" value={form.jobOrderId} onChange={e=>updateField('jobOrderId', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Deposit Amount <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <DollarSign className="text-slate-400 shrink-0" size={16} />
                    <CurrencyInput value={Number(form.depositAmount)} onChange={v=>updateField('depositAmount', v)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment Reference No.</label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <File className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Payment Reference No." value={form.paymentReferenceNo} onChange={e=>updateField('paymentReferenceNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>
              </div>

              {form.isRefund && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Refund Amount</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <DollarSign className="text-slate-400 shrink-0" size={16} />
                      <CurrencyInput value={Number(form.refundAmount)} onChange={v=>updateField('refundAmount', v)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Refund Date</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <Calendar className="text-slate-400 shrink-0" size={16} />
                      <input type="date" value={form.refundDate || ''} onChange={e=>updateField('refundDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Refund Reason</label>
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                      <FileText className="text-slate-400 shrink-0" size={16} />
                      <input placeholder="Reason for refund" value={form.refundReason} onChange={e=>updateField('refundReason', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <div className="mt-2 bg-white border rounded">
                  <textarea value={form.description} onChange={e=>updateField('description', e.target.value)} placeholder="Optional description" className="w-full p-3 bg-transparent outline-none h-24 text-sm resize-none" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + (saving ? ' opacity-70 cursor-not-allowed' : '')}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  )
}
