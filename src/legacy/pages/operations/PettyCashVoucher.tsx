// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { Hash, Calendar, User, DollarSign, FileText } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import { getPettyCash, getPettyCashById, savePettyCash, updatePettyCash } from '../../services/operationService'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

function CurrencyInput({ value, onChange, className, readOnly }: { value: number; onChange?: (v: number) => void; className?: string; readOnly?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  function handleFocus() { if (readOnly) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setInputVal(e.target.value) }
  function handleBlur() { setFocused(false); onChange && onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} readOnly={readOnly} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} className={className} />
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

const PC_PREFIX = 'PCV'
const PC_PAD = 7

function parsePCNo(s: string): number {
  const m = String(s || '').match(/(\d+)\s*$/)
  return m ? Number(m[1]) : 0
}
function formatPCNo(n: number): string {
  return PC_PREFIX + String(n).padStart(PC_PAD, '0')
}

export default function PettyCashVoucher() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const id = params.id
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const showIsChanganOption = useShowIsChanganOption()

  const [form, setForm] = useState<any>({
    isChangan: false,
    isCashOut: true,
    pcNo: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    payTo: '',
    paymentReceivedBy: '',
    amount: 0,
    particulars: ''
  })
  const [errors, setErrors] = useState<any>({})
  const [prevBalance, setPrevBalance] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  function updateField(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }))
    setErrors((e: any) => ({ ...e, [key]: '' }))
  }

  useEffect(() => {
    (async () => {
      try {
        const list: any = await getPettyCash()
        const rows = Array.isArray(list) ? list : []
        if (isAdd) {
          const latest = rows.slice().sort((a: any, b: any) => {
            const ad = new Date(a.transactionDateTime ?? a.TransactionDateTime ?? 0).getTime()
            const bd = new Date(b.transactionDateTime ?? b.TransactionDateTime ?? 0).getTime()
            if (ad !== bd) return bd - ad
            return Number(b.id ?? 0) - Number(a.id ?? 0)
          })[0]
          setPrevBalance(Number(latest?.balance ?? latest?.Balance ?? 0))
          const maxNo = rows.reduce((m: number, r: any) => Math.max(m, parsePCNo(r.pcNo ?? r.PCNo ?? '')), 0)
          setForm((f: any) => ({ ...f, pcNo: formatPCNo(maxNo + 1) }))
        }
      } catch { /* ignore — form still usable */ }
    })()
  }, [isAdd])

  useEffect(() => {
    if (isAdd || !id) return
    (async () => {
      try {
        const data: any = await getPettyCashById(id)
        if (!data) return
        const cashIn = Number(data.cashIn ?? data.CashIn ?? 0)
        const cashOut = Number(data.cashOut ?? data.CashOut ?? 0)
        const bal = Number(data.balance ?? data.Balance ?? 0)
        const amt = cashOut > 0 ? cashOut : cashIn
        const txDate = String(data.transactionDateTime ?? data.TransactionDateTime ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
        setForm({
          isChangan: !!(data.isChangan ?? data.IsChangan),
          isCashOut: cashOut > 0 || cashIn === 0,
          pcNo: data.pcNo ?? data.PCNo ?? '',
          transactionDate: txDate,
          payTo: data.payTo ?? data.PayTo ?? '',
          paymentReceivedBy: data.paymentReceivedBy ?? data.PaymentReceivedBy ?? '',
          amount: amt,
          particulars: data.particulars ?? data.Particulars ?? ''
        })
        setPrevBalance(bal - cashIn + cashOut)
      } catch { showToast('Error loading Petty Cash Voucher', 'error') }
    })()
  }, [id, isAdd])

  const balance = useMemo(() => {
    const amt = Number(form.amount) || 0
    return prevBalance + (form.isCashOut ? -amt : amt)
  }, [prevBalance, form.amount, form.isCashOut])

  function validate() {
    const e: any = {}
    if (!form.pcNo || !String(form.pcNo).trim()) e.pcNo = 'Required'
    if (!form.transactionDate) e.transactionDate = 'Required'
    if (!form.payTo || !String(form.payTo).trim()) e.payTo = 'Required'
    if (!form.paymentReceivedBy || !String(form.paymentReceivedBy).trim()) e.paymentReceivedBy = 'Required'
    if (!(Number(form.amount) > 0)) e.amount = 'Must be greater than 0'
    if (!form.particulars || !String(form.particulars).trim()) e.particulars = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    setSaving(true)
    try {
      const amt = Number(form.amount) || 0
      const body: any = {
        isChangan: !!form.isChangan,
        pcNo: form.pcNo,
        transactionDateTime: new Date(form.transactionDate).toISOString(),
        payTo: form.payTo,
        particulars: form.particulars,
        cashIn: form.isCashOut ? 0 : amt,
        cashOut: form.isCashOut ? amt : 0,
        balance,
        paymentReceivedBy: form.paymentReceivedBy,
      }
      if (typeof currentUserId === 'number') {
        body.paidByUserId = currentUserId
        if (isAdd) body.createdById = currentUserId
        else body.updatedById = currentUserId
      }
      if (isAdd) await savePettyCash(body)
      else await updatePettyCash(id as string, body)
      showToast(isAdd ? 'Petty Cash Voucher added' : 'Petty Cash Voucher updated', 'success')
      navigate('/operations/petty-cash')
    } catch (e: any) {
      showToast(e?.message || 'Error saving Petty Cash Voucher', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Petty Cash Voucher' : 'Manage Petty Cash Voucher'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">

        {/* Petty Cash Information */}
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center">
              <div className="text-sm font-medium text-slate-700">Petty Cash Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {showIsChanganOption && (
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">Changan Transaction?</div>
                    <div className="flex items-center gap-2">
                      <Toggle checked={!!form.isChangan} onChange={v => updateField('isChangan', v)} />
                      <span className="text-sm text-slate-500">{form.isChangan ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Transaction Type: <span className="text-slate-900">{form.isCashOut ? 'Cash Out' : 'Cash In'}</span></div>
                  <div className="flex items-center gap-2">
                    <Toggle checked={!!form.isCashOut} onChange={v => updateField('isCashOut', v)} />
                    <span className="text-sm text-slate-500">{form.isCashOut ? 'Cash Out' : 'Cash In'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Petty Cash No. <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="PCV0000001" value={form.pcNo} onChange={e => updateField('pcNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.pcNo && <div className="text-rose-600 text-sm mt-1">{errors.pcNo}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Transaction Date <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e => updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.transactionDate && <div className="text-rose-600 text-sm mt-1">{errors.transactionDate}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Pay To <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Payee" value={form.payTo} onChange={e => updateField('payTo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.payTo && <div className="text-rose-600 text-sm mt-1">{errors.payTo}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment Received By <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Receiver" value={form.paymentReceivedBy} onChange={e => updateField('paymentReceivedBy', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.paymentReceivedBy && <div className="text-rose-600 text-sm mt-1">{errors.paymentReceivedBy}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <DollarSign className="text-slate-400 shrink-0" size={16} />
                    <CurrencyInput value={Number(form.amount)} onChange={v => updateField('amount', v)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.amount && <div className="text-rose-600 text-sm mt-1">{errors.amount}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Balance</label>
                  <div className="mt-2 flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                    <DollarSign className="text-slate-400 shrink-0" size={16} />
                    <CurrencyInput value={balance} readOnly className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Particulars <span className="text-rose-600">*</span></label>
                <div className="mt-2 flex items-start gap-2 bg-white border rounded px-3 py-2">
                  <FileText className="text-slate-400 shrink-0 mt-0.5" size={16} />
                  <textarea value={form.particulars} onChange={e => updateField('particulars', e.target.value)} placeholder="Description of transaction" className="w-full bg-transparent outline-none text-sm resize-none h-24" />
                </div>
                {errors.particulars && <div className="text-rose-600 text-sm mt-1">{errors.particulars}</div>}
              </div>

            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <button onClick={() => navigate('/operations/petty-cash')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm' + (saving ? ' opacity-70 cursor-not-allowed' : '')}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  )
}
