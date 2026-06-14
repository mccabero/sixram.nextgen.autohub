// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { Calendar, CreditCard, DollarSign, File, Hash, Loader2, Search, Tag, User, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import { getUsers } from '../../services/adminService'
import { getJobStatuses, getParametersByGroup } from '../../services/configService'
import { getExpenseById, getNextExpenseReferenceNo, saveExpense, updateExpense } from '../../services/operationService'
import { useToast } from '../../contexts/toast'
import { useShowIsChanganOption } from '../../hooks/useShowIsChanganOption'

type ExpensesForm = {
  isChangan: boolean
  isSettled: boolean
  jobStatusId: string
  referenceNo: string
  transactionDate: string
  paymentTypeParameterId: string
  expenseByUserId: string
  paymentTo: string
  expensesAmount: number
  paymentReferenceNo: string
  remarks: string
}

type SelectOption = {
  value: string
  label: string
  subtitle?: string
}

type JobStatusOption = {
  id: string
  name: string
  code: string
}

type PaymentTypeOption = {
  id: string
  name: string
  groupName: string
}

function todayInputDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function toDateInput(value: unknown) {
  if (!value) return ''
  return String(value).slice(0, 10)
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

function SearchableSelect({
  options,
  value,
  onChange,
  onClear,
  placeholder,
  noResultsText,
}: {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  noResultsText?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)
  const filtered = query.trim()
    ? options.filter(option =>
        option.label.toLowerCase().includes(query.toLowerCase())
        || String(option.subtitle ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
        <Search className="text-slate-400 shrink-0" size={16} />
        <input
          type="text"
          value={open ? query : (selected?.label ?? '')}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-sm"
        />
        {value && onClear && (
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              onClear()
              setQuery('')
              setOpen(false)
            }}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-64 overflow-y-auto"
          onMouseDown={e => e.preventDefault()}
        >
          {filtered.length > 0 ? filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setQuery('')
                setOpen(false)
              }}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${option.value === value ? 'bg-sky-50' : ''}`}
            >
              <div className="text-sm text-slate-700">{option.label}</div>
              {option.subtitle && <div className="text-xs text-slate-500">{option.subtitle}</div>}
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-500">{noResultsText ?? 'No results found.'}</div>
          )}
        </div>
      )}
    </div>
  )
}

function normalizeUsers(items: any[]): SelectOption[] {
  return items.map(item => {
    const id = item.id ?? item.userId ?? item.Id ?? item.UserId ?? ''
    const firstName = String(item.firstName ?? item.FirstName ?? item.firstname ?? item.Firstname ?? '')
    const lastName = String(item.lastName ?? item.LastName ?? item.lastname ?? '')
    const label = String(item.name ?? item.fullName ?? '').trim()
      || [firstName, lastName].filter(Boolean).join(' ').trim()
      || String(item.username ?? item.email ?? '').trim()
    const subtitle = String(
      item.position
      ?? item.Position
      ?? item.jobTitle
      ?? item.JobTitle
      ?? item.roleName
      ?? item.RoleName
      ?? item.email
      ?? ''
    ).trim()
    return { value: String(id), label, subtitle }
  }).filter(item => item.value && item.label)
}

function normalizePaymentTypes(items: any[]): PaymentTypeOption[] {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    groupName: String(
      item.parameterGroup?.name
      ?? item.parameterGroup?.Name
      ?? item.group?.name
      ?? item.group?.Name
      ?? item.parameterGroupName
      ?? item.ParameterGroupName
      ?? item.groupName
      ?? item.GroupName
      ?? ''
    ),
  })).filter(item => item.id && item.name)
}

function normalizeJobStatuses(items: any[]): JobStatusOption[] {
  return items.map(item => ({
    id: String(item.id ?? item.Id ?? ''),
    name: String(item.name ?? item.Name ?? ''),
    code: String(item.code ?? item.Code ?? item.name ?? item.Name ?? '').trim().toUpperCase(),
  })).filter(item => item.id)
}

function findOpenStatus(statuses: JobStatusOption[]) {
  return statuses.find(status => status.code.includes('OPEN') || status.name.toUpperCase().includes('OPEN')) ?? null
}

function findSettledStatus(statuses: JobStatusOption[]) {
  return statuses.find(status =>
    status.code.includes('SETTLED')
    || status.code.includes('PAID')
    || status.code.includes('COMPLETED')
    || status.name.toUpperCase().includes('SETTLED')
    || status.name.toUpperCase().includes('PAID')
    || status.name.toUpperCase().includes('COMPLETED')
  ) ?? null
}

export default function ManageExpenses(){
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeId } = useParams<{ id: string }>()
  const isAddMode = location.pathname.endsWith('/add') || !routeId
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const { showToast } = useToast()
  const showIsChanganOption = useShowIsChanganOption()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<SelectOption[]>([])
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([])
  const [jobStatuses, setJobStatuses] = useState<JobStatusOption[]>([])
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [form, setForm] = useState<ExpensesForm>({
    isChangan: false,
    isSettled: false,
    jobStatusId: '',
    referenceNo: '',
    transactionDate: todayInputDate(),
    paymentTypeParameterId: '',
    expenseByUserId: '',
    paymentTo: '',
    expensesAmount: 0,
    paymentReferenceNo: '',
    remarks: ''
  })

  function updateField<K extends keyof ExpensesForm>(key: K, value: ExpensesForm[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const [usersResult, paymentTypesResult, jobStatusesResult, nextReferenceResult, expenseResult] = await Promise.all([
          getUsers(),
          getParametersByGroup('PAYMENT TYPE'),
          getJobStatuses(),
          isAddMode ? getNextExpenseReferenceNo().catch(() => null) : Promise.resolve(null),
          !isAddMode && routeId ? getExpenseById(routeId) : Promise.resolve(null),
        ])
        if (!mounted) return

        const normalizedStatuses = normalizeJobStatuses(Array.isArray(jobStatusesResult) ? jobStatusesResult : [])
        const openStatus = findOpenStatus(normalizedStatuses)

        setUsers(normalizeUsers(Array.isArray(usersResult) ? usersResult : []))
        setPaymentTypes(normalizePaymentTypes(Array.isArray(paymentTypesResult) ? paymentTypesResult : []))
        setJobStatuses(normalizedStatuses)

        if (isAddMode) {
          setForm(current => ({
            ...current,
            jobStatusId: current.jobStatusId || String(openStatus?.id ?? ''),
            referenceNo: String(nextReferenceResult?.referenceNo ?? nextReferenceResult?.ReferenceNo ?? current.referenceNo ?? ''),
            transactionDate: current.transactionDate || todayInputDate(),
          }))
        } else if (expenseResult) {
          const expense: any = expenseResult
          setForm({
            isChangan: Boolean(expense.isChangan ?? expense.IsChangan ?? false),
            isSettled: Boolean(expense.isPaid ?? expense.IsPaid ?? expense.isSettled ?? expense.IsSettled ?? false),
            jobStatusId: String(expense.jobStatusId ?? expense.JobStatusId ?? ''),
            referenceNo: String(expense.referenceNo ?? expense.ReferenceNo ?? ''),
            transactionDate: toDateInput(expense.expenseDateTime ?? expense.ExpenseDateTime ?? expense.transactionDate ?? expense.TransactionDate) || todayInputDate(),
            paymentTypeParameterId: String(expense.paymentTypeParameterId ?? expense.PaymentTypeParameterId ?? ''),
            expenseByUserId: String(expense.expenseByUserId ?? expense.ExpenseByUserId ?? ''),
            paymentTo: String(expense.payTo ?? expense.PayTo ?? expense.paymentTo ?? expense.PaymentTo ?? ''),
            expensesAmount: Number(expense.amount ?? expense.Amount ?? expense.expensesAmount ?? expense.ExpensesAmount ?? 0) || 0,
            paymentReferenceNo: String(expense.paymentReferenceNo ?? expense.PaymentReferenceNo ?? ''),
            remarks: String(expense.remarks ?? expense.Remarks ?? ''),
          })
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to load expense form', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [isAddMode, routeId, showToast])

  const openStatus = useMemo(() => findOpenStatus(jobStatuses), [jobStatuses])
  const settledStatus = useMemo(() => findSettledStatus(jobStatuses), [jobStatuses])
  const selectedStatus = useMemo(
    () => jobStatuses.find(status => status.id === String(form.jobStatusId)) ?? null,
    [jobStatuses, form.jobStatusId]
  )
  const statusOptions = useMemo(
    () => jobStatuses.map(status => ({ value: status.id, label: status.name })),
    [jobStatuses]
  )
  const paymentTypeOptions = useMemo(
    () => paymentTypes.map(type => ({ value: type.id, label: type.name, subtitle: type.groupName })),
    [paymentTypes]
  )

  function handleSettledChange(value: boolean) {
    setForm(current => ({
      ...current,
      isSettled: value,
      jobStatusId: String((value ? settledStatus?.id : openStatus?.id) ?? current.jobStatusId),
    }))
  }

  async function handleSave(){
    if (saving) return
    setShowValidationErrors(true)

    if (typeof currentUserId !== 'number' || currentUserId <= 0) {
      showToast('Unable to identify the current user', 'error')
      return
    }
    if (!form.jobStatusId) {
      showToast('Expense status is not configured', 'error')
      return
    }
    if (!form.referenceNo.trim()) {
      showToast('Reference number is required', 'error')
      return
    }
    if (!form.transactionDate) {
      showToast('Transaction date is required', 'error')
      return
    }
    if (!form.paymentTypeParameterId) {
      showToast('Select a payment type', 'error')
      return
    }
    if (!form.expenseByUserId) {
      showToast('Select the employee who recorded the expense', 'error')
      return
    }
    if (!form.paymentTo.trim()) {
      showToast('Payment To is required', 'error')
      return
    }
    if (Number(form.expensesAmount || 0) <= 0) {
      showToast('Enter a valid expense amount', 'error')
      return
    }

    const payload: Record<string, unknown> = {
      IsChangan: form.isChangan,
      IsPaid: form.isSettled,
      ReferenceNo: form.referenceNo.trim(),
      ExpenseDateTime: new Date(`${form.transactionDate}T00:00:00`).toISOString(),
      Amount: Number(form.expensesAmount || 0),
      VAT12: 0,
      PayTo: form.paymentTo.trim(),
      PaymentReferenceNo: form.paymentReferenceNo.trim(),
      PaymentTypeParameterId: Number(form.paymentTypeParameterId),
      JobStatusId: Number(form.jobStatusId),
      ExpenseByUserId: Number(form.expenseByUserId),
      Remarks: form.remarks.trim(),
      UpdatedById: currentUserId,
    }

    if (isAddMode) {
      payload.CreatedById = currentUserId
    }

    setSaving(true)
    try{
      if (isAddMode) {
        await saveExpense(payload)
      } else if (routeId) {
        await updateExpense(routeId, payload)
      }
      setShowValidationErrors(false)
      showToast('Expense saved successfully', 'success')
      navigate('/operations/expenses')
    }catch(err){
      showToast(err instanceof Error ? err.message : 'Failed to save expense', 'error')
    }finally{
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading expense form...
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAddMode ? 'Add Expense' : 'Manage Expense'}</h2>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="bg-white rounded shadow-sm">
          <div className="rounded border overflow-visible">
            <div className="bg-gray-100 px-4 py-2 flex items-center rounded-t">
              <div className="text-sm font-medium text-slate-700">Expenses Information</div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4 rounded-b">
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
                  <div className="text-sm font-medium text-slate-700 mb-2">Is Settled? <span className="text-rose-600">*</span></div>
                  <div className="flex items-center gap-2">
                    <Toggle checked={!!form.isSettled} onChange={handleSettledChange} />
                    <span className="text-sm text-slate-500">{form.isSettled ? 'Paid' : 'Unpaid'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
                    <Tag className="text-slate-400 shrink-0" size={16} />
                    <select value={form.jobStatusId} disabled className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed">
                      <option value="">{selectedStatus?.name ?? 'Select status'}</option>
                      {statusOptions.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference No. <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
                    <Hash className="text-slate-400 shrink-0" size={16} />
                    <input value={form.referenceNo} disabled placeholder="EXP0000001" className="w-full bg-transparent outline-none text-sm text-slate-500 cursor-not-allowed" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Transaction Date <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${showValidationErrors && !form.transactionDate ? 'border-rose-500' : ''}`}>
                    <Calendar className="text-slate-400 shrink-0" size={16} />
                    <input type="date" value={form.transactionDate} onChange={e=>updateField('transactionDate', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Expenses Payment Type <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${showValidationErrors && !form.paymentTypeParameterId ? 'border-rose-500' : ''}`}>
                    <CreditCard className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={paymentTypeOptions}
                      value={form.paymentTypeParameterId}
                      onChange={value => updateField('paymentTypeParameterId', value)}
                      onClear={() => updateField('paymentTypeParameterId', '')}
                      placeholder="Search payment type..."
                      noResultsText="No payment types found."
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expenses By Employee <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${showValidationErrors && !form.expenseByUserId ? 'border-rose-500' : ''}`}>
                    <User className="text-slate-400 shrink-0" size={16} />
                    <SearchableSelect
                      options={users}
                      value={form.expenseByUserId}
                      onChange={value => updateField('expenseByUserId', value)}
                      onClear={() => updateField('expenseByUserId', '')}
                      placeholder="Search employee..."
                      noResultsText="No users found."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment To <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${showValidationErrors && !form.paymentTo.trim() ? 'border-rose-500' : ''}`}>
                    <User className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Payee" value={form.paymentTo} onChange={e=>updateField('paymentTo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Expenses Amount <span className="text-rose-600">*</span></label>
                  <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2 ${showValidationErrors && Number(form.expensesAmount || 0) <= 0 ? 'border-rose-500' : ''}`}>
                    <DollarSign className="text-slate-400 shrink-0" size={16} />
                    <CurrencyInput value={Number(form.expensesAmount)} onChange={v=>updateField('expensesAmount', v)} className="w-full bg-transparent outline-none text-sm" />
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

              <div>
                <label className="block text-sm font-medium text-slate-700">Remarks</label>
                <div className="mt-2 bg-white border rounded">
                  <textarea value={form.remarks} onChange={e=>updateField('remarks', e.target.value)} placeholder="Optional remarks" className="w-full p-3 bg-transparent outline-none h-24 text-sm resize-none" />
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-4">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={'px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm inline-flex items-center gap-2' + (saving ? ' opacity-70 cursor-not-allowed' : '')}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
