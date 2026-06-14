// @ts-nocheck
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, Boxes, ChevronLeft, ChevronRight, ClipboardCheck, History, Package2, ShieldAlert, Warehouse, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import { useToast } from '../../contexts/toast'
import { login as loginService } from '../../services/authService'
import { createInventoryTransaction, getInventoryAudit, getInventorySummary, reconcileInventory } from '../../services/managementService'
import { formatAmount, formatShortDate } from '../../utils/format'
import { calculateInventoryVariance, inventoryVarianceLabel, inventoryVarianceTone } from '../../utils/inventoryReconciliation'
import { extractRoleNames, isActionAllowed, permissionDeniedMessage } from '../../utils/permissions'
import { ClientTypeFilter, EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions } from '../../components/lists'
import InventoryCheckPanel from '../../components/inventory/InventoryCheckPanel'

interface InventoryProductRow {
  id: number
  name: string
  displayName?: string
  partNo?: string
  storageLocation?: string
  purchaseCost: number
  sellingPrice: number
  lowStockThreshold: number
  stockOnHand: number
  stockValue: number
  stockStatus: string
  productGroupName?: string
  productCategoryName?: string
  manufacturerName?: string
  supplierName?: string
  unitOfMeasureName?: string
}

type InventoryStatusFilterKey = 'ALL' | 'In Stock' | 'Low Stock' | 'Out of Stock'
type InventoryTabKey = 'stock' | 'reconciliation' | 'daily-check' | 'month-check' | 'audit'

interface InventoryAuditRow {
  id: string
  productId: number
  productName: string
  unitOfMeasure?: string
  sourceType: string
  transactionType: string
  quantity: number
  transactionDateTime: string
  referenceNo?: string
  notes?: string
  isManual?: boolean
}

const today = () => new Date().toISOString().slice(0, 10)

function normalizeRow(item: any): InventoryProductRow {
  return {
    id: Number(item.id ?? item.Id ?? 0),
    name: String(item.name ?? item.Name ?? ''),
    displayName: String(item.displayName ?? item.DisplayName ?? ''),
    partNo: String(item.partNo ?? item.PartNo ?? ''),
    storageLocation: String(item.storageLocation ?? item.StorageLocation ?? ''),
    purchaseCost: Number(item.purchaseCost ?? item.PurchaseCost ?? 0),
    sellingPrice: Number(item.sellingPrice ?? item.SellingPrice ?? 0),
    lowStockThreshold: Number(item.lowStockThreshold ?? item.LowStockThreshold ?? item.reorderLevel ?? item.ReorderLevel ?? 5),
    stockOnHand: Number(item.stockOnHand ?? item.StockOnHand ?? 0),
    stockValue: Number(item.stockValue ?? item.StockValue ?? 0),
    stockStatus: String(item.stockStatus ?? item.StockStatus ?? ''),
    productGroupName: String(item.productGroup?.name ?? item.ProductGroup?.Name ?? item.productGroup?.Name ?? ''),
    productCategoryName: String(item.productCategory?.name ?? item.ProductCategory?.Name ?? item.productCategory?.Name ?? ''),
    manufacturerName: String(item.manufacturer?.name ?? item.Manufacturer?.Name ?? item.manufacturer?.Name ?? ''),
    supplierName: String(item.supplier?.name ?? item.Supplier?.Name ?? item.supplier?.Name ?? ''),
    unitOfMeasureName: String(item.unitOfMeasure?.name ?? item.UnitOfMeasure?.Name ?? item.unitOfMeasure?.Name ?? ''),
  }
}

function normalizeAuditRow(item: any): InventoryAuditRow {
  return {
    id: String(item.id ?? item.Id ?? ''),
    productId: Number(item.productId ?? item.ProductId ?? 0),
    productName: String(item.productName ?? item.ProductName ?? ''),
    unitOfMeasure: String(item.unitOfMeasure ?? item.UnitOfMeasure ?? ''),
    sourceType: String(item.sourceType ?? item.SourceType ?? ''),
    transactionType: String(item.transactionType ?? item.TransactionType ?? ''),
    quantity: Number(item.quantity ?? item.Quantity ?? 0),
    transactionDateTime: String(item.transactionDateTime ?? item.TransactionDateTime ?? ''),
    referenceNo: String(item.referenceNo ?? item.ReferenceNo ?? ''),
    notes: String(item.notes ?? item.Notes ?? ''),
    isManual: Boolean(item.isManual ?? item.IsManual ?? false),
  }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function extractRolesFromLoginResponse(data: any): string[] {
  const directRoles = extractRoleNames(data?.user)
  const token = data?.token ?? data?.accessToken ?? data?.access_token ?? null
  if (typeof token !== 'string' || token.split('.').length !== 3) return Array.from(new Set(directRoles))

  const payload = decodeJwtPayload(token)
  const tokenRoles = payload
    ? extractRoleNames([
        payload.role_name,
        payload.roleName,
        payload.userRoles,
        payload.UserRoles,
        payload.roles,
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
      ])
    : []

  return Array.from(new Set([...directRoles, ...tokenRoles]))
}

function getUserIdFromLoginResponse(data: any): number | undefined {
  const directCandidate = data?.user?.id ?? data?.user?.userId ?? data?.user?.user_id ?? data?.user?.Id ?? data?.user?.sub
  let parsed = Number(directCandidate)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  const token = data?.token ?? data?.accessToken ?? data?.access_token ?? null
  if (typeof token !== 'string' || token.split('.').length !== 3) return undefined
  const payload = decodeJwtPayload(token)
  const tokenCandidate = payload?.sub ?? payload?.userId ?? payload?.user_id ?? payload?.id ?? payload?.nameid ?? payload?.name_id
  parsed = Number(tokenCandidate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function hasReconciliationOverrideRole(roles: string[]): boolean {
  return extractRoleNames(roles).some(role =>
    role === 'OWNER'
    || /\bOWNER\b/.test(role)
    || role === 'ADMIN'
    || role === 'ADMINISTRATOR'
    || role === 'SYSTEM ADMINISTRATOR'
    || /\bADMIN\b/.test(role)
    || /\bADMINISTRATOR\b/.test(role)
  )
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const classes = normalized.includes('out')
    ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
    : normalized.includes('low')
      ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
      : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'

  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${classes}`}>{status || 'In Stock'}</span>
}

function SourcePill({ source }: { source: string }) {
  const normalized = source.toLowerCase()
  const classes = normalized.includes('manual')
    ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30'
    : normalized.includes('quick')
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
      : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'

  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${classes}`}>{source || '-'}</span>
}

function MovementModal({
  rows,
  productId,
  canRecordMovement,
  onClose,
  onSaved,
}: {
  rows: InventoryProductRow[]
  productId?: number | null
  canRecordMovement: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const { showToast } = useToast()
  const [form, setForm] = useState({
    productId: productId ? String(productId) : '',
    transactionType: 'Stock In',
    quantity: '1',
    transactionDateTime: today(),
    referenceNo: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const selectedProduct = rows.find(row => String(row.id) === String(form.productId))

  useEffect(() => {
    setForm(current => ({ ...current, productId: productId ? String(productId) : current.productId }))
  }, [productId])

  async function save() {
    if (!canRecordMovement) {
      showToast(permissionDeniedMessage('inventory.adjust'), 'error')
      return
    }
    const quantity = Number(form.quantity)
    if (!form.productId) { showToast('Select a product', 'error'); return }
    if (!Number.isFinite(quantity) || quantity === 0) { showToast('Enter a non-zero quantity', 'error'); return }
    if (selectedProduct) {
      const signedQuantity = form.transactionType === 'Stock Out'
        ? -Math.abs(quantity)
        : form.transactionType === 'Stock In'
          ? Math.abs(quantity)
          : quantity
      if (selectedProduct.stockOnHand + signedQuantity < 0) {
        showToast(`Insufficient stock. Available ${formatAmount(selectedProduct.stockOnHand)}, requested ${formatAmount(Math.abs(signedQuantity))}`, 'error')
        return
      }
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        productId: Number(form.productId),
        transactionType: form.transactionType,
        quantity,
        transactionDateTime: form.transactionDateTime ? new Date(form.transactionDateTime).toISOString() : undefined,
        referenceNo: form.referenceNo,
        notes: form.notes,
      }
      if (typeof currentUserId === 'number') {
        body.createdById = currentUserId
        body.updatedById = currentUserId
      }
      await createInventoryTransaction(body)
      showToast('Inventory transaction recorded', 'success')
      onSaved()
    } catch (error: any) {
      showToast('Save failed: ' + (error?.message || 'Unknown'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300 flex items-center justify-center">
              <Warehouse size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Record Stock Movement</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manual stock in, stock out, or adjustment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Product <span className="text-rose-600">*</span></label>
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none">
              <option value="">Select product</option>
              {rows.map(row => <option key={row.id} value={row.id}>{row.name}{row.partNo ? ` - ${row.partNo}` : ''} ({formatAmount(row.stockOnHand)} on hand)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Type</label>
            <select value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none">
              <option>Stock In</option>
              <option>Stock Out</option>
              <option>Adjustment</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Quantity <span className="text-rose-600">*</span></label>
            <input type="number" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Date</label>
            <input type="date" value={form.transactionDateTime} onChange={e => setForm(f => ({ ...f, transactionDateTime: e.target.value }))} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Reference</label>
            <input value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-700 px-5 py-4">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
          <button onClick={save} disabled={saving || !canRecordMovement} className="inline-flex items-center gap-2 px-4 py-2 bg-bosch-blue text-white rounded text-sm hover:opacity-90 disabled:opacity-70">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function ReconciliationPanel({
  rows,
  onSaved,
}: {
  rows: InventoryProductRow[]
  onSaved: () => void
}) {
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const { showToast } = useToast()
  const [productId, setProductId] = useState('')
  const [physicalQuantity, setPhysicalQuantity] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideUsername, setOverrideUsername] = useState('')
  const [overridePassword, setOverridePassword] = useState('')

  const selectedProduct = rows.find(row => String(row.id) === String(productId))
  const physical = Number(physicalQuantity)
  const hasPhysical = physicalQuantity.trim() !== '' && Number.isFinite(physical) && physical >= 0
  const variance = selectedProduct && hasPhysical
    ? calculateInventoryVariance(selectedProduct.stockOnHand, physical)
    : 0
  const tone = inventoryVarianceTone(variance)
  const toneClasses = tone === 'surplus'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : tone === 'shortage'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : 'bg-slate-50 text-slate-700 ring-slate-200'

  function requestReconciliationOverride() {
    if (!selectedProduct) { showToast('Select a product to reconcile', 'error'); return }
    if (!hasPhysical) { showToast('Enter a valid physical count', 'error'); return }
    setOverrideUsername('')
    setOverridePassword('')
    setShowOverrideModal(true)
  }

  async function save(overrideUserId?: number) {
    if (!selectedProduct) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        productId: selectedProduct.id,
        physicalQuantity: physical,
        referenceNo,
        notes,
        transactionDateTime: new Date().toISOString(),
      }
      const userId = typeof overrideUserId === 'number' ? overrideUserId : currentUserId
      if (typeof userId === 'number') {
        body.createdById = userId
        body.updatedById = userId
      }
      const result: any = await reconcileInventory(body)
      showToast(String(result?.message ?? result?.Message ?? 'Inventory reconciled'), 'success')
      setShowOverrideModal(false)
      setPhysicalQuantity('')
      setReferenceNo('')
      setNotes('')
      onSaved()
    } catch (error: any) {
      showToast('Reconciliation failed: ' + (error?.message || 'Unknown'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmOverrideAndSave() {
    if (!overrideUsername.trim() || !overridePassword) {
      showToast('Please enter administrator or owner credentials', 'error')
      return
    }

    setSaving(true)
    try {
      const loginResult = await loginService({ email: overrideUsername.trim(), password: overridePassword })
      const roles = extractRolesFromLoginResponse(loginResult)
      if (!hasReconciliationOverrideRole(roles)) {
        throw new Error('Only administrators and owners can override inventory reconciliation.')
      }
      await save(getUserIdFromLoginResponse(loginResult))
      setOverrideUsername('')
      setOverridePassword('')
    } catch (error: any) {
      showToast(error?.message || 'Failed to verify override credentials', 'error')
      setSaving(false)
    }
  }

  return (
    <>
    <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <ClipboardCheck size={18} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Inventory Reconciliation</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enter the physical count. The system will create an adjustment for the variance.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 py-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Product</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none">
              <option value="">Select product</option>
              {rows.map(row => (
                <option key={row.id} value={row.id}>
                  {row.name}{row.partNo ? ` - ${row.partNo}` : ''} ({formatAmount(row.stockOnHand)} {row.unitOfMeasureName || ''} on hand)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">System On Hand</label>
            <input readOnly value={selectedProduct ? formatAmount(selectedProduct.stockOnHand) : ''} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Physical Count</label>
            <input type="number" min="0" step="0.01" value={physicalQuantity} onChange={e => setPhysicalQuantity(e.target.value)} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Reference</label>
            <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Optional; auto-generated if blank" className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Variance</label>
            <div className={`mt-2 inline-flex w-full items-center justify-between rounded px-3 py-2 text-sm font-semibold ring-1 ${toneClasses}`}>
              <span>{inventoryVarianceLabel(variance)}</span>
              <span className="tabular-nums">{variance > 0 ? '+' : ''}{formatAmount(variance)}</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="mt-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none resize-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-sm text-amber-700">
            <ShieldAlert size={15} /> Administrator or owner verification is required.
          </div>
          <button onClick={requestReconciliationOverride} disabled={saving} className="ml-auto inline-flex items-center gap-2 rounded bg-bosch-blue px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60">
            Reconcile Stock
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
            <Activity size={18} />
          </span>
          <div>
            <h3 className="font-semibold">Reconciliation Rules</h3>
            <p className="text-sm text-white/70">A clean count creates a reliable audit trail.</p>
          </div>
        </div>
        <div className="mt-5 space-y-3 text-sm text-white/80">
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">Positive variance records a stock-in adjustment.</div>
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">Negative variance records a stock-out adjustment down to the physical count.</div>
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">Zero variance is saved as a checked result without changing stock.</div>
        </div>
      </div>
    </div>
    {showOverrideModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="inventory-reconciliation-override-title">
        <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setShowOverrideModal(false)} />
        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800">
          <div className="border-b bg-gray-100 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div id="inventory-reconciliation-override-title" className="text-sm font-semibold text-slate-700 dark:text-slate-100">Admin Verification Required</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Enter administrator or owner credentials to reconcile inventory.</div>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Username</label>
              <input
                type="text"
                value={overrideUsername}
                onChange={e => setOverrideUsername(e.target.value)}
                disabled={saving}
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                className="mt-2 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Enter username or email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
              <input
                type="password"
                value={overridePassword}
                onChange={e => setOverridePassword(e.target.value)}
                disabled={saving}
                autoComplete="new-password"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                className="mt-2 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-bosch-blue focus:ring-2 focus:ring-bosch-blue/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Enter password"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => setShowOverrideModal(false)}
              disabled={saving}
              className="rounded border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmOverrideAndSave}
              disabled={saving}
              className="rounded bg-bosch-blue px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-70"
            >
              {saving ? 'Verifying...' : 'Verify and Reconcile'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function InventoryAuditPanel({
  rows,
  loading,
  searchTerm,
  page,
  pageCount,
  rowsPerPage,
  total,
  hasMore,
  onSearchChange,
  onPageChange,
  onRowsPerPageChange,
  onRefresh,
}: {
  rows: InventoryAuditRow[]
  loading: boolean
  searchTerm: string
  page: number
  pageCount: number
  rowsPerPage: number
  total: number
  hasMore: boolean
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  onRowsPerPageChange: (rowsPerPage: number) => void
  onRefresh: () => void
}) {
  const start = rows.length === 0 ? 0 : page * rowsPerPage + 1
  const end = page * rowsPerPage + rows.length
  const rowsPerPageOptions = [10, 20, 50, 100]

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
      <ListToolbar
        left={<div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><History size={16} /> Inventory Audit Trail</div>}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <ListSearchInput value={searchTerm} onChange={onSearchChange} placeholder="Search product, source, reference..." />
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>
        }
      />

      <div className="overflow-x-auto w-full">
        <table className="min-w-full w-full">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3 text-right">Qty Impact</th>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyState icon={History} colSpan={7} title={loading ? 'Loading audit trail...' : 'No audit records found'} hint="Manual movements, job orders, and quick sales will appear here." />}
            {rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatShortDate(row.transactionDateTime)}</td>
                <td className="px-5 py-4 align-middle">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.productName || `Product #${row.productId}`}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{row.unitOfMeasure || '-'}</div>
                </td>
                <td className="px-5 py-4 align-middle"><SourcePill source={row.sourceType} /></td>
                <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-200">{row.transactionType}</td>
                <td className={`px-5 py-4 align-middle text-right text-sm font-semibold tabular-nums ${row.quantity < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {row.quantity > 0 ? '+' : ''}{formatAmount(row.quantity)}
                </td>
                <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.referenceNo || '-'}</td>
                <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 max-w-md truncate">{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-slate-500 dark:text-slate-400">Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={e => onRowsPerPageChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            {rowsPerPageOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="hidden sm:block text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{start}-{end}</span>
            {!hasMore && total > 0 && <> of <span className="font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString()}</span></>}
            {hasMore && <span className="ml-1 text-slate-400">more available</span>}
          </div>
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900/40">
            <button
              aria-label="Previous audit page"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="inline-flex items-center gap-1 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="px-3 text-xs font-medium text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-700">
              {page + 1}{hasMore ? '+' : ` / ${pageCount}`}
            </span>
            <button
              aria-label="Next audit page"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore || loading}
              className="inline-flex items-center gap-1 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Inventory() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { role, userRoles } = useAuth()
  const { showToast } = useToast()
  const [rows, setRows] = useState<InventoryProductRow[]>([])
  const [auditRows, setAuditRows] = useState<InventoryAuditRow[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(false)
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilterKey>('ALL')
  const [activeTab, setActiveTabState] = useState<InventoryTabKey>(() => {
    const tab = searchParams.get('tab')
    return tab === 'reconciliation' || tab === 'daily-check' || tab === 'month-check' || tab === 'audit' ? tab : 'stock'
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [auditPage, setAuditPage] = useState(0)
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(10)
  const [auditSearchInput, setAuditSearchInput] = useState('')
  const [auditSearchTerm, setAuditSearchTerm] = useState('')
  const [auditLoaded, setAuditLoaded] = useState(false)
  const auditRequestId = useRef(0)
  const [modalProductId, setModalProductId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const permissionRoles = [role, ...userRoles]
  const canRecordMovement = isActionAllowed(permissionRoles, 'inventory.adjust')

  async function loadSummary() {
    setLoading(true)
    try {
      const data: any = await getInventorySummary()
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.Items) ? data.Items : []
      setRows(items.map(normalizeRow))
      setSummary(data?.summary ?? data?.Summary ?? {})
    } catch {
      setRows([])
      setSummary({})
      showToast('Failed to load inventory', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadAudit(options?: { page?: number; pageSize?: number; search?: string }) {
    const nextPage = options?.page ?? auditPage
    const nextPageSize = options?.pageSize ?? auditRowsPerPage
    const nextSearch = options?.search ?? auditSearchTerm
    const requestId = ++auditRequestId.current
    setAuditLoading(true)
    try {
      const data: any = await getInventoryAudit({ page: nextPage, pageSize: nextPageSize, search: nextSearch })
      if (requestId !== auditRequestId.current) return
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.Items)
            ? data.Items
            : []
      setAuditRows(items.map(normalizeAuditRow))
      setAuditTotal(Array.isArray(data) ? items.length : Number(data?.total ?? data?.Total ?? items.length))
      setAuditHasMore(Boolean(data?.hasMore ?? data?.HasMore ?? false))
      setAuditLoaded(true)
    } catch {
      if (requestId !== auditRequestId.current) return
      setAuditRows([])
      setAuditTotal(0)
      setAuditHasMore(false)
      showToast('Failed to load inventory audit trail', 'error')
    } finally {
      if (requestId === auditRequestId.current) setAuditLoading(false)
    }
  }

  useEffect(() => { loadSummary() }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    setActiveTabState(tab === 'reconciliation' || tab === 'daily-check' || tab === 'month-check' || tab === 'audit' ? tab : 'stock')
    const status = searchParams.get('status')
    if (status === 'In Stock' || status === 'Low Stock' || status === 'Out of Stock') {
      setStatusFilter(status)
    }
  }, [searchParams])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAuditPage(0)
      setAuditSearchTerm(auditSearchInput.trim())
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [auditSearchInput])

  useEffect(() => {
    if (activeTab !== 'audit') return
    loadAudit({ page: auditPage, pageSize: auditRowsPerPage, search: auditSearchTerm })
  }, [activeTab, auditPage, auditRowsPerPage, auditSearchTerm])

  function setActiveTab(tab: InventoryTabKey) {
    setActiveTabState(tab)
    const next = new URLSearchParams(searchParams)
    if (tab === 'stock') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = deferredSearchTerm.trim().toLowerCase()
    return rows.filter(row => {
      if (statusFilter !== 'ALL' && row.stockStatus !== statusFilter) return false
      if (!q) return true
      return row.name.toLowerCase().includes(q)
        || String(row.partNo ?? '').toLowerCase().includes(q)
        || String(row.productGroupName ?? '').toLowerCase().includes(q)
        || String(row.manufacturerName ?? '').toLowerCase().includes(q)
        || String(row.storageLocation ?? '').toLowerCase().includes(q)
    })
  }, [rows, deferredSearchTerm, statusFilter])

  const statusFilterOptions = useMemo(() => {
    let inStock = 0
    let lowStock = 0
    let outOfStock = 0
    rows.forEach(row => {
      if (row.stockStatus === 'Low Stock') lowStock += 1
      else if (row.stockStatus === 'Out of Stock') outOfStock += 1
      else inStock += 1
    })
    return [
      { key: 'ALL' as const, label: 'All', count: rows.length },
      { key: 'In Stock' as const, label: 'In Stock', count: inStock, activeClass: 'bg-emerald-500 text-white' },
      { key: 'Low Stock' as const, label: 'Low Stock', count: lowStock, activeClass: 'bg-amber-500 text-white' },
      { key: 'Out of Stock' as const, label: 'Out of Stock', count: outOfStock, activeClass: 'bg-rose-500 text-white' },
    ]
  }, [rows])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [filtered, page, rowsPerPage])
  useEffect(() => { if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) }, [page, pageCount])
  const auditPageCount = Math.max(1, Math.ceil(auditTotal / auditRowsPerPage))
  useEffect(() => { if (auditPage > Math.max(0, auditPageCount - 1)) setAuditPage(Math.max(0, auditPageCount - 1)) }, [auditPage, auditPageCount])

  function openMovement(productId?: number) {
    if (!canRecordMovement) {
      showToast(permissionDeniedMessage('inventory.adjust'), 'error')
      return
    }
    setModalProductId(productId ?? null)
    setShowModal(true)
  }

  function closeAndReload() {
    setShowModal(false)
    setModalProductId(null)
    loadSummary()
    if (auditLoaded || activeTab === 'audit') {
      loadAudit({ page: auditPage, pageSize: auditRowsPerPage, search: auditSearchTerm })
    }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Warehouse}
        title="Inventory"
        subtitle="Stock levels, inventory value, and manual movements"
        addLabel="Record Movement"
        onAdd={() => openMovement()}
        stats={[
          { label: 'Products', value: summary.totalProducts ?? summary.TotalProducts ?? rows.length },
          { label: 'Low', value: summary.lowStockCount ?? summary.LowStockCount ?? 0, tone: 'amber' },
          { label: 'Out', value: summary.outOfStockCount ?? summary.OutOfStockCount ?? 0, tone: 'rose' },
          { label: 'Value', value: formatAmount(summary.stockValue ?? summary.StockValue ?? 0), tone: 'emerald' },
        ]}
      />

      {showModal && <MovementModal rows={rows} productId={modalProductId} canRecordMovement={canRecordMovement} onClose={() => setShowModal(false)} onSaved={closeAndReload} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: 'stock' as const, label: 'Stock Status', icon: Warehouse },
          { key: 'reconciliation' as const, label: 'Reconciliation', icon: ClipboardCheck },
          { key: 'daily-check' as const, label: 'End of Day Check', icon: ClipboardCheck },
          { key: 'month-check' as const, label: 'Month End Check', icon: ClipboardCheck },
          { key: 'audit' as const, label: 'Audit Trail', icon: History },
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${active ? 'bg-bosch-blue text-white ring-bosch-blue' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700'}`}
            >
              <Icon size={15} /> {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'stock' ? (
      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value as InventoryStatusFilterKey); setPage(0) }}
              label="Status"
              options={statusFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search product, part no, group, location..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3 text-right">On Hand</th>
                <th className="px-5 py-3 text-right">Reorder</th>
                <th className="px-5 py-3">UoM</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Stock Value</th>
                <th className="px-5 py-3 text-right"><span className="inline-flex items-center gap-2 justify-end">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Boxes} colSpan={9} title="No inventory records found" hint="Add products or record stock movement to build inventory." />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => navigate(`/management/products/${row.id}`)} className="group text-left">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">
                          <Package2 size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{row.name}</div>
                          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{row.partNo || row.manufacturerName || '-'}</div>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.productGroupName || '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.storageLocation || '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{formatAmount(row.stockOnHand)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-600 dark:text-slate-300 tabular-nums">{formatAmount(row.lowStockThreshold)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.unitOfMeasureName || '-'}</td>
                  <td className="px-5 py-4 align-middle whitespace-nowrap"><StatusPill status={row.stockStatus} /></td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-700 dark:text-slate-200 tabular-nums">{formatAmount(row.stockValue)}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => openMovement(row.id), label: `movement-${row.id}` },
                      { kind: 'view', onClick: () => navigate(`/management/products/${row.id}`), label: `view-${row.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0) }} />
      </div>
      ) : activeTab === 'reconciliation' ? (
        <ReconciliationPanel rows={rows} onSaved={closeAndReload} />
      ) : activeTab === 'daily-check' ? (
        <InventoryCheckPanel type="end-of-day" rows={rows} onSaved={closeAndReload} />
      ) : activeTab === 'month-check' ? (
        <InventoryCheckPanel type="month-end" rows={rows} onSaved={closeAndReload} />
      ) : (
        <InventoryAuditPanel
          rows={auditRows}
          loading={auditLoading}
          searchTerm={auditSearchInput}
          page={auditPage}
          pageCount={auditPageCount}
          rowsPerPage={auditRowsPerPage}
          total={auditTotal}
          hasMore={auditHasMore}
          onSearchChange={setAuditSearchInput}
          onPageChange={setAuditPage}
          onRowsPerPageChange={(n) => { setAuditRowsPerPage(n); setAuditPage(0) }}
          onRefresh={() => loadAudit({ page: auditPage, pageSize: auditRowsPerPage, search: auditSearchTerm })}
        />
      )}
    </div>
  )
}
