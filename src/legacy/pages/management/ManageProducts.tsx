// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, Info, Hash, Search, X, List, Calendar, Banknote, Boxes, AlertTriangle, PackageCheck, ArrowRight } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import managementService from '../../services/managementService'
import configService from '../../services/configService'
import { useAuth } from '../../auth/useAuth'
import getCurrentUserId from '../../auth/getCurrentUserId'
import PriceEditLockedBadge from '../../components/rbac/PriceEditLockedBadge'
import ProductInventoryTransactionsTable from '../../components/tables/ProductInventoryTransactionsTable'
import ProductJobOrderTable from '../../components/tables/ProductJobOrderTable'
import { useCanEditPricePermission } from '../../hooks/useCanEditPricePermission'
import useDebouncedValue from '../../hooks/useDebouncedValue'

function CurrencyInput({ value, onChange, className, disabled }: { value: number; onChange: (v: number) => void; className?: string; disabled?: boolean }) {
  const [focused, setFocused] = useState(false)
  const [inputVal, setInputVal] = useState('')
  function handleFocus() { if (disabled) return; setFocused(true); setInputVal(value === 0 ? '' : String(value)) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) { if (disabled) return; setInputVal(e.target.value) }
  function handleBlur() { if (disabled) return; setFocused(false); onChange(parseFloat(inputVal.replace(/,/g, '')) || 0) }
  const display = focused ? inputVal : new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return <input value={display} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} disabled={disabled} className={className} />
}

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

function SearchCombo({ label, required, searchVal, onSearchChange, onSelect, onClear, options, placeholder, error }: {
  label: string; required?: boolean; searchVal: string
  onSearchChange: (q: string) => void; onSelect: (item: any) => void; onClear: () => void
  options: any[]; placeholder?: string; error?: string
}) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showDrop, setShowDrop] = useState(false)
  function handleChange(q: string) {
    onSearchChange(q)
    const f = q.trim() ? options.filter(o => (o.name ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 10) : options.slice(0, 10)
    setSuggestions(f); setShowDrop(true)
  }
  function openDrop() {
    const f = searchVal.trim() ? options.filter(o => (o.name ?? '').toLowerCase().includes(searchVal.toLowerCase())).slice(0, 10) : options.slice(0, 10)
    setSuggestions(f); setShowDrop(true)
  }
  return (
    <div className="relative w-full">
      <label className="block text-sm font-medium text-slate-700">{label} {required && <span className="text-rose-600">*</span>}</label>
      <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2${error ? ' border-rose-400' : ''}`}>
        <Search className="text-slate-400 shrink-0" size={16} />
        <input value={searchVal} onChange={e => handleChange(e.target.value)} onFocus={openDrop} onBlur={() => setTimeout(() => setShowDrop(false), 150)} placeholder={placeholder ?? 'Search...'} className="w-full bg-transparent outline-none text-sm" />
        {searchVal && <button type="button" onMouseDown={e => { e.preventDefault(); setSuggestions([]); setShowDrop(false); onClear() }} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
      </div>
      {error && <div className="text-rose-600 text-sm mt-1">{error}</div>}
      {showDrop && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border rounded shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
          {suggestions.map((o: any) => (
            <div key={o.id} onClick={() => { setSuggestions([]); setShowDrop(false); onSelect(o) }} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">{o.name}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function normalizeOptions(items: any[]): any[] {
  return items.map(item => {
    const id = item.id !== undefined ? item.id : (Object.entries(item).find(([k, v]) => k !== 'id' && /id$/i.test(k) && v !== undefined)?.[1])
    const name = item.name !== undefined ? item.name : (Object.entries(item).find(([k]) => /name/i.test(k))?.[1] ?? '')
    return { ...item, id, name }
  })
}

const fmtQty = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0)
const stockOnHandOf = (product: any) => Number(product?.stockOnHand ?? product?.StockOnHand ?? 0) || 0

function productStockFields(product: any, fallback: any = {}) {
  return {
    stockOnHand: stockOnHandOf(product ?? fallback),
    stockStatus: String(product?.stockStatus ?? product?.StockStatus ?? fallback?.stockStatus ?? fallback?.StockStatus ?? ''),
    unitOfMeasureName: String(product?.unitOfMeasure?.name ?? product?.UnitOfMeasure?.Name ?? product?.unitOfMeasureName ?? product?.UnitOfMeasureName ?? fallback?.unitOfMeasureName ?? fallback?.UnitOfMeasureName ?? ''),
  }
}

const TABS = ['General Information', 'Applicable Vehicles', 'Inventory', 'Job Orders']
const APPLICABLE_VEHICLES_TAB_INDEX = 1
const INVENTORY_TAB_INDEX = 2
const JOB_ORDERS_TAB_INDEX = 3

type ApplicableVehicleOption = {
  id: number
  name: string
  makeName: string
  description: string
  label: string
}

export default function ManageProducts() {
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id
  const location = useLocation()
  const isAdd = id === 'add' || (!id && location.pathname?.endsWith('/add'))
  const { showToast } = useToast()
  const { user } = useAuth()
  const currentUserId = getCurrentUserId(user)
  const canEditPrice = useCanEditPricePermission()

  const [form, setForm] = useState<any>({ name: '', displayName: '', description: '', partNo: '', productGroupId: '', productCategoryId: '', unitOfMeasureId: '', manufacturerId: '', supplierId: '', expirationDateTime: '', purchaseCost: 0, markupRate: 0, sellingPrice: 0, incentiveSA: 0, incentiveTech: 0, storageLocation: '', lowStockThreshold: 5, stockOnHand: 0, stockStatus: '', unitOfMeasureName: '', isQuickSalesProduct: false })
  const [errors, setErrors] = useState<any>({})
  const [groups, setGroups] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [uoms, setUoms] = useState<any[]>([])
  const [manufacturers, setManufacturers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [groupSearch, setGroupSearch] = useState('')
  const [catSearch, setCatSearch] = useState('')
  const [uomSearch, setUomSearch] = useState('')
  const [mfrSearch, setMfrSearch] = useState('')
  const [supSearch, setSupSearch] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [applicableVehicleOptions, setApplicableVehicleOptions] = useState<ApplicableVehicleOption[]>([])
  const [selectedVehicleModelIds, setSelectedVehicleModelIds] = useState<number[]>([])
  const [initialVehicleModelIds, setInitialVehicleModelIds] = useState<number[]>([])
  const [applicableVehicleSearch, setApplicableVehicleSearch] = useState('')
  const debouncedApplicableVehicleSearch = useDebouncedValue(applicableVehicleSearch)
  const [applicableVehiclesLoading, setApplicableVehiclesLoading] = useState(false)
  const [applicableVehiclesSaving, setApplicableVehiclesSaving] = useState(false)

  function normalizeVehicleModelIds(source: any): number[] {
    return Array.from(
      new Set(
        [
          ...(Array.isArray(source?.vehicleModelIds) ? source.vehicleModelIds : []),
          ...(Array.isArray(source?.VehicleModelIds) ? source.VehicleModelIds : []),
          ...(Array.isArray(source?.items) ? source.items.map((item: any) => item.vehicleModelId ?? item.VehicleModelId) : []),
          ...(Array.isArray(source?.Items) ? source.Items.map((item: any) => item.vehicleModelId ?? item.VehicleModelId) : []),
        ]
          .map((value: any) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    ).sort((left, right) => left - right)
  }

  async function loadApplicableVehicles(productId: string | number, options?: { showLoading?: boolean }) {
    if (options?.showLoading ?? true) setApplicableVehiclesLoading(true)
    try {
      const [vehicleModels, vehicleMakes, savedAssignments] = await Promise.all([
        configService.getVehicleModels(),
        configService.getVehicleMakes(),
        managementService.getProductApplicableVehicles(productId),
      ])

      const makeNameById = new Map<number, string>(
        (Array.isArray(vehicleMakes) ? vehicleMakes : []).map((make: any) => [
          Number(make.id ?? make.Id ?? 0),
          String(make.name ?? make.Name ?? ''),
        ])
      )

      const vehicleOptions = (Array.isArray(vehicleModels) ? vehicleModels : [])
        .map((vehicleModel: any) => {
          const vehicleModelId = Number(vehicleModel.id ?? vehicleModel.Id ?? 0)
          const vehicleMakeId = Number(vehicleModel.vehicleMakeId ?? vehicleModel.VehicleMakeId ?? vehicleModel.vehicleMake?.id ?? vehicleModel.VehicleMake?.Id ?? 0)
          const makeName = String(
            vehicleModel.vehicleMake?.name
            ?? vehicleModel.vehicleMake?.Name
            ?? vehicleModel.VehicleMake?.name
            ?? vehicleModel.VehicleMake?.Name
            ?? makeNameById.get(vehicleMakeId)
            ?? ''
          ).trim()
          const name = String(vehicleModel.name ?? vehicleModel.Name ?? '').trim()
          const description = String(vehicleModel.description ?? vehicleModel.Description ?? '').trim()
          return {
            id: vehicleModelId,
            name,
            makeName,
            description,
            label: `${makeName ? `${makeName} ` : ''}${name}`.trim(),
          }
        })
        .filter(option => option.id > 0 && option.name)
        .sort((left, right) => {
          const makeCompare = left.makeName.localeCompare(right.makeName)
          if (makeCompare !== 0) return makeCompare
          return left.name.localeCompare(right.name)
        })

      const vehicleModelIds = normalizeVehicleModelIds(savedAssignments)

      setApplicableVehicleOptions(vehicleOptions)
      setSelectedVehicleModelIds(vehicleModelIds)
      setInitialVehicleModelIds(vehicleModelIds)
    } finally {
      if (options?.showLoading ?? true) setApplicableVehiclesLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const [g, c, u, m, s] = await Promise.all([configService.getProductGroups(), configService.getProductCategories(), configService.getUnitOfMeasures(), managementService.getManufacturers(), managementService.getSuppliers()])
      setGroups(normalizeOptions(Array.isArray(g) ? g : []))
      setCategories(normalizeOptions(Array.isArray(c) ? c : []))
      setUoms(normalizeOptions(Array.isArray(u) ? u : []))
      setManufacturers(normalizeOptions(Array.isArray(m) ? m : []))
      setSuppliers(normalizeOptions(Array.isArray(s) ? s : []))
    })()
  }, [])

  useEffect(() => {
    if (!id || isAdd) return
    ;(async () => {
      try {
        const data: any = await managementService.getProduct(id as string)
        if (data) {
          setForm((previous: any) => ({
            name: data.name ?? '',
            displayName: data.displayName ?? '',
            description: data.description ?? '',
            partNo: data.partNo ?? '',
            productGroupId: data.productGroupId ?? '',
            productCategoryId: data.productCategoryId ?? '',
            unitOfMeasureId: data.unitOfMeasureId ?? '',
            manufacturerId: data.manufacturerId ?? '',
            supplierId: data.supplierId ?? '',
            expirationDateTime: data.expirationDateTime ? String(data.expirationDateTime).slice(0, 10) : '',
            purchaseCost: data.purchaseCost ?? 0,
            markupRate: data.markupRate ?? 0,
            sellingPrice: data.sellingPrice ?? 0,
            incentiveSA: data.incentiveSA ?? 0,
            incentiveTech: data.incentiveTech ?? 0,
            storageLocation: data.storageLocation ?? '',
            lowStockThreshold: data.lowStockThreshold ?? data.reorderLevel ?? previous.lowStockThreshold ?? 5,
            stockOnHand: Number(data.stockOnHand ?? data.StockOnHand ?? previous.stockOnHand ?? 0) || 0,
            stockStatus: String(data.stockStatus ?? data.StockStatus ?? previous.stockStatus ?? ''),
            unitOfMeasureName: String(data.unitOfMeasure?.name ?? data.UnitOfMeasure?.Name ?? data.unitOfMeasureName ?? data.UnitOfMeasureName ?? previous.unitOfMeasureName ?? ''),
            isQuickSalesProduct: Boolean(data.isQuickSalesProduct ?? data.IsQuickSalesProduct ?? previous.isQuickSalesProduct ?? false),
          }))
          const resolve = (list: any[], pid: any, fallback: string) => list.find((x: any) => String(x.id) === String(pid))?.name ?? fallback
          if (data.productGroupId) setGroupSearch(resolve(groups, data.productGroupId, data.productGroupName ?? ''))
          if (data.productCategoryId) setCatSearch(resolve(categories, data.productCategoryId, data.productCategoryName ?? ''))
          if (data.unitOfMeasureId) setUomSearch(resolve(uoms, data.unitOfMeasureId, data.unitOfMeasureName ?? ''))
          if (data.manufacturerId) setMfrSearch(resolve(manufacturers, data.manufacturerId, data.manufacturerName ?? ''))
          if (data.supplierId) setSupSearch(resolve(suppliers, data.supplierId, data.supplierName ?? ''))
        }
      } catch { showToast('Error loading Product', 'error') }
    })()
  }, [id, isAdd, location.pathname, groups, categories, uoms, manufacturers, suppliers, showToast])

  useEffect(() => {
    if (!id || isAdd) return
    let mounted = true
    ;(async () => {
      const products = await managementService.getProducts()
      if (!mounted || !Array.isArray(products)) return
      const product = products.find((item: any) => String(item.id ?? item.Id) === String(id))
      if (!product) return
      setForm((previous: any) => ({
        ...previous,
        ...productStockFields(product, previous),
        lowStockThreshold: product.lowStockThreshold ?? product.LowStockThreshold ?? product.reorderLevel ?? product.ReorderLevel ?? previous.lowStockThreshold ?? 5,
        isQuickSalesProduct: Boolean(product.isQuickSalesProduct ?? product.IsQuickSalesProduct ?? previous.isQuickSalesProduct ?? false),
      }))
    })()
    return () => { mounted = false }
  }, [id, isAdd])

  useEffect(() => {
    if (!id || isAdd) return
    let mounted = true

    ;(async () => {
      try {
        await loadApplicableVehicles(id as string)
      } catch {
        if (mounted) showToast('Error loading applicable vehicles', 'error')
      }
    })()

    return () => { mounted = false }
  }, [id, isAdd, showToast])

  function updateField(key: string, value: any) { setForm((f: any) => ({ ...f, [key]: value })); setErrors((e: any) => ({ ...e, [key]: '' })) }
  function setVehicleSelection(vehicleModelId: number, checked: boolean) {
    setSelectedVehicleModelIds(previous => {
      const next = new Set(previous)
      if (checked) next.add(vehicleModelId)
      else next.delete(vehicleModelId)
      return Array.from(next).sort((left, right) => left - right)
    })
  }
  function setVehicleSelections(vehicleModelIds: number[], checked: boolean) {
    setSelectedVehicleModelIds(previous => {
      const next = new Set(previous)
      for (const vehicleModelId of vehicleModelIds) {
        if (checked) next.add(vehicleModelId)
        else next.delete(vehicleModelId)
      }
      return Array.from(next).sort((left, right) => left - right)
    })
  }
  function validate() {
    const e: any = {}
    if (!form.name?.trim()) e.name = 'Required'
    if (!form.productGroupId) e.productGroupId = 'Required'
    if (!form.productCategoryId) e.productCategoryId = 'Required'
    if (!form.manufacturerId) e.manufacturerId = 'Required'
    if (!form.unitOfMeasureId) e.unitOfMeasureId = 'Required'
    if (!form.supplierId) e.supplierId = 'Required'
    if (Number(form.lowStockThreshold) < 0) e.lowStockThreshold = 'Must be zero or greater'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (saving) return
    if (!validate()) { showToast('Please fill required fields', 'error'); return }
    setSaving(true)
    try {
      const body: any = { name: form.name, displayName: form.displayName, description: form.description, partNo: form.partNo, productGroupId: form.productGroupId || null, productCategoryId: form.productCategoryId || null, unitOfMeasureId: form.unitOfMeasureId || null, manufacturerId: form.manufacturerId || null, supplierId: form.supplierId || null, expirationDateTime: form.expirationDateTime || null, purchaseCost: Number(form.purchaseCost) || 0, markupRate: Number(form.markupRate) || 0, sellingPrice: Number(form.sellingPrice) || 0, incentiveSA: Number(form.incentiveSA) || 0, incentiveTech: Number(form.incentiveTech) || 0, storageLocation: form.storageLocation, lowStockThreshold: Number(form.lowStockThreshold) || 0, reorderLevel: Number(form.lowStockThreshold) || 0, isQuickSalesProduct: !!form.isQuickSalesProduct }
      if (isAdd && typeof currentUserId === 'number') body.createdById = currentUserId
      if (!isAdd && typeof currentUserId === 'number') body.updatedById = currentUserId
      if (isAdd) await managementService.createProduct(body)
      else await managementService.updateProduct(id as string, body)
      showToast(isAdd ? 'Product added' : 'Product updated', 'success')
      navigate('/management/products')
    } catch (error: any) {
      showToast(error?.message || 'Error saving Product', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveApplicableVehicles() {
    if (!id || applicableVehiclesSaving) return

    const vehicleModelIds = selectedVehicleModelIds
      .filter(vehicleModelId => vehicleModelId > 0)
      .sort((left, right) => left - right)

    setApplicableVehiclesSaving(true)
    try {
      const savedAssignments: any = await managementService.updateProductApplicableVehicles(id as string, {
        vehicleModelIds,
        updatedById: typeof currentUserId === 'number' ? currentUserId : 0,
      })
      const savedVehicleModelIds = normalizeVehicleModelIds(savedAssignments)
      if (savedVehicleModelIds.length > 0 || vehicleModelIds.length === 0) {
        setSelectedVehicleModelIds(savedVehicleModelIds)
        setInitialVehicleModelIds(savedVehicleModelIds)
      } else {
        setSelectedVehicleModelIds(vehicleModelIds)
        setInitialVehicleModelIds(vehicleModelIds)
      }
      await loadApplicableVehicles(id as string, { showLoading: false })
      showToast('Applicable vehicles updated', 'success')
    } catch (error: any) {
      showToast(error?.message || 'Error saving applicable vehicles', 'error')
    } finally {
      setApplicableVehiclesSaving(false)
    }
  }

  const stockOnHand = Number(form.stockOnHand ?? 0) || 0
  const reorderLevel = Number(form.lowStockThreshold ?? 0) || 0
  const unitLabel = String(form.unitOfMeasureName || uomSearch || 'units')
  const isOutOfStock = !isAdd && stockOnHand <= 0
  const isSoonOut = !isAdd && !isOutOfStock && reorderLevel > 0 && stockOnHand <= reorderLevel
  const isWatchStock = !isAdd && !isOutOfStock && !isSoonOut && reorderLevel > 0 && stockOnHand <= reorderLevel * 1.5
  const InventoryStatusIcon = isAdd ? Boxes : (isOutOfStock || isSoonOut || isWatchStock ? AlertTriangle : PackageCheck)
  const inventoryTone = isAdd
    ? 'border-slate-200 bg-slate-50 text-slate-700'
    : isOutOfStock
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : isSoonOut
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : isWatchStock
          ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  const inventoryStatusLabel = isAdd
    ? 'Stock appears after save'
    : isOutOfStock
      ? 'Out of stock'
      : isSoonOut
        ? 'Soon to be out of stock'
        : isWatchStock
          ? 'Watch stock'
          : 'Healthy stock'
  const inventoryStatusMessage = isAdd
    ? 'Create the product first, then use the Inventory tab to record opening stock.'
    : isOutOfStock
      ? 'This product cannot be used until stock is added.'
      : isSoonOut
        ? `Current stock is at or below the reorder level of ${fmtQty(reorderLevel)} ${unitLabel}.`
        : isWatchStock
          ? `Only ${fmtQty(stockOnHand - reorderLevel)} ${unitLabel} above reorder level. Consider restocking soon.`
          : `Stock is above the reorder level by ${fmtQty(stockOnHand - reorderLevel)} ${unitLabel}.`
  const selectedVehicleModelIdSet = useMemo(() => new Set(selectedVehicleModelIds), [selectedVehicleModelIds])
  const filteredApplicableVehicles = useMemo(() => {
    const query = debouncedApplicableVehicleSearch.trim().toLowerCase()
    if (!query) return applicableVehicleOptions
    return applicableVehicleOptions.filter(option =>
      option.label.toLowerCase().includes(query)
      || option.name.toLowerCase().includes(query)
      || option.makeName.toLowerCase().includes(query)
      || option.description.toLowerCase().includes(query)
    )
  }, [applicableVehicleOptions, debouncedApplicableVehicleSearch])
  const selectedApplicableVehicles = useMemo(
    () => applicableVehicleOptions.filter(option => selectedVehicleModelIdSet.has(option.id)),
    [applicableVehicleOptions, selectedVehicleModelIdSet]
  )
  const availableApplicableVehicles = useMemo(
    () => filteredApplicableVehicles.filter(option => !selectedVehicleModelIdSet.has(option.id)),
    [filteredApplicableVehicles, selectedVehicleModelIdSet]
  )
  const hasVehicleSelectionChanges = useMemo(() => {
    if (selectedVehicleModelIds.length !== initialVehicleModelIds.length) return true
    return selectedVehicleModelIds.some((vehicleModelId, index) => vehicleModelId !== initialVehicleModelIds[index])
  }, [initialVehicleModelIds, selectedVehicleModelIds])

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Product' : 'Manage Product'}</h2>
      </div>

      <div className="mt-4">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px space-x-2">
            {(isAdd ? [TABS[0]] : TABS).map((tab, index) => (
              <button key={tab} onClick={() => setActiveTab(index)} className={`px-4 py-2 ${activeTab === index ? 'border-b-2 border-bosch-blue text-bosch-blue' : 'text-slate-600 hover:text-bosch-blue'}`}>
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === 0 && (
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-visible">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Product Information</div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4">
                    <div className={`rounded-2xl border p-4 ${inventoryTone}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-white/80 p-2 shadow-sm">
                            <InventoryStatusIcon size={22} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">Inventory Status</h3>
                              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold shadow-sm">{inventoryStatusLabel}</span>
                            </div>
                            <p className="mt-1 text-sm opacity-90">{inventoryStatusMessage}</p>
                          </div>
                        </div>
                        {!isAdd && (
                          <button
                            type="button"
                            onClick={() => setActiveTab(INVENTORY_TAB_INDEX)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-black/5 hover:bg-slate-50"
                          >
                            Manage inventory <ArrowRight size={14} />
                          </button>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-white/85 p-4 shadow-sm ring-1 ring-black/5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current stock on hand</div>
                          <div className="mt-2 flex items-end gap-2">
                            <span className="text-3xl font-bold tabular-nums text-slate-900">{isAdd ? '-' : fmtQty(stockOnHand)}</span>
                            <span className="pb-1 text-sm text-slate-500">{unitLabel}</span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-white/85 p-4 shadow-sm ring-1 ring-black/5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reorder level</div>
                          <div className="mt-2 flex items-end gap-2">
                            <span className="text-3xl font-bold tabular-nums text-slate-900">{fmtQty(reorderLevel)}</span>
                            <span className="pb-1 text-sm text-slate-500">{unitLabel}</span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-white/85 p-4 shadow-sm ring-1 ring-black/5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restock guidance</div>
                          <div className="mt-2 text-sm font-medium text-slate-800">
                            {isAdd ? 'Record opening stock after saving.' : isOutOfStock ? 'Stock in immediately.' : isSoonOut ? 'Reorder soon to avoid blocking sales/jobs.' : isWatchStock ? 'Monitor closely.' : 'No action needed right now.'}
                          </div>
                          {!isAdd && form.stockStatus && <div className="mt-1 text-xs text-slate-500">System status: {form.stockStatus}</div>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <SearchCombo label="Product Group" required searchVal={groupSearch} onSearchChange={q => { setGroupSearch(q); updateField('productGroupId', '') }} onSelect={g => { setGroupSearch(g.name ?? ''); updateField('productGroupId', g.id) }} onClear={() => { setGroupSearch(''); updateField('productGroupId', '') }} options={groups} placeholder="Search group..." error={errors.productGroupId} />
                      <SearchCombo label="Product Category" required searchVal={catSearch} onSearchChange={q => { setCatSearch(q); updateField('productCategoryId', '') }} onSelect={c => { setCatSearch(c.name ?? ''); updateField('productCategoryId', c.id) }} onClear={() => { setCatSearch(''); updateField('productCategoryId', '') }} options={categories} placeholder="Search category..." error={errors.productCategoryId} />
                      <SearchCombo label="Manufacturer" required searchVal={mfrSearch} onSearchChange={q => { setMfrSearch(q); updateField('manufacturerId', '') }} onSelect={m => { setMfrSearch(m.name ?? ''); updateField('manufacturerId', m.id) }} onClear={() => { setMfrSearch(''); updateField('manufacturerId', '') }} options={manufacturers} placeholder="Search manufacturer..." error={errors.manufacturerId} />
                      <SearchCombo label="Unit of Measure" required searchVal={uomSearch} onSearchChange={q => { setUomSearch(q); updateField('unitOfMeasureId', ''); updateField('unitOfMeasureName', q) }} onSelect={u => { setUomSearch(u.name ?? ''); updateField('unitOfMeasureId', u.id); updateField('unitOfMeasureName', u.name ?? '') }} onClear={() => { setUomSearch(''); updateField('unitOfMeasureId', ''); updateField('unitOfMeasureName', '') }} options={uoms} placeholder="Search UoM..." error={errors.unitOfMeasureId} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Product Name <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <ShoppingCart className="text-slate-400 shrink-0" size={16} />
                          <input placeholder="Product Name" value={form.name} onChange={e => updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          {form.name && <button type="button" onClick={() => updateField('name', '')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                        </div>
                        {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Displayed Product Name <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Info className="text-slate-400 shrink-0" size={16} />
                          <input placeholder="Display Name" value={form.displayName} onChange={e => updateField('displayName', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          {form.displayName && <button type="button" onClick={() => updateField('displayName', '')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Part No.</label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Hash className="text-slate-400 shrink-0" size={16} />
                          <input placeholder="Part No." value={form.partNo} onChange={e => updateField('partNo', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          {form.partNo && <button type="button" onClick={() => updateField('partNo', '')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <SearchCombo label="Supplier" required searchVal={supSearch} onSearchChange={q => { setSupSearch(q); updateField('supplierId', '') }} onSelect={s => { setSupSearch(s.name ?? ''); updateField('supplierId', s.id) }} onClear={() => { setSupSearch(''); updateField('supplierId', '') }} options={suppliers} placeholder="Search supplier..." error={errors.supplierId} />
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Reorder Level</label>
                        <div className={`mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2${errors.lowStockThreshold ? ' border-rose-400' : ''}`}>
                          <Hash className="text-slate-400 shrink-0" size={16} />
                          <input type="number" step="0.01" min="0" placeholder="5" value={form.lowStockThreshold} onChange={e => updateField('lowStockThreshold', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                        {errors.lowStockThreshold && <div className="text-rose-600 text-sm mt-1">{errors.lowStockThreshold}</div>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Storage Location</label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <List className="text-slate-400 shrink-0" size={16} />
                          <input placeholder="Storage Location" value={form.storageLocation} onChange={e => updateField('storageLocation', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                          {form.storageLocation && <button type="button" onClick={() => updateField('storageLocation', '')} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Expiration Date</label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Calendar className="text-slate-400 shrink-0" size={16} />
                          <input type="date" value={form.expirationDateTime} onChange={e => updateField('expirationDateTime', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Quick Sales</label>
                        <div className="mt-2 flex h-[42px] items-center justify-between rounded border bg-white px-3 py-2">
                          <span className="text-sm text-slate-700">{form.isQuickSalesProduct ? 'On' : 'Off'}</span>
                          <Toggle checked={!!form.isQuickSalesProduct} onChange={checked => updateField('isQuickSalesProduct', checked)} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">Description</label>
                      <div className="mt-2 bg-white border rounded">
                        <textarea rows={4} value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Product description" className="w-full p-3 bg-transparent outline-none text-sm resize-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded shadow-sm">
                <div className="rounded border overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center">
                    <div className="text-sm font-medium text-slate-700">Price Information</div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Purchase Cost <span className="text-rose-600">*</span></label>
                        <div className={`relative mt-2 flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                          <Hash className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.purchaseCost)} onChange={v => updateField('purchaseCost', v)} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-14' : ''}`} />
                          {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Markup Rate <span className="text-rose-600">*</span></label>
                        <div className={`relative mt-2 flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                          <Hash className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.markupRate)} onChange={v => updateField('markupRate', v)} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-14' : ''}`} />
                          {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Selling Price <span className="text-rose-600">*</span></label>
                        <div className={`relative mt-2 flex items-center gap-2 border rounded px-3 py-2 ${canEditPrice ? 'bg-white' : 'bg-slate-50 border-slate-200'}`}>
                          <Hash className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.sellingPrice)} onChange={v => updateField('sellingPrice', v)} disabled={!canEditPrice} className={`min-w-0 flex-1 bg-transparent outline-none text-sm disabled:cursor-not-allowed disabled:text-slate-400 ${!canEditPrice ? 'pr-14' : ''}`} />
                          {!canEditPrice && <PriceEditLockedBadge className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Incentive (SA) <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Banknote className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.incentiveSA)} onChange={v => updateField('incentiveSA', v)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Incentive (Technician) <span className="text-rose-600">*</span></label>
                        <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                          <Banknote className="text-slate-400 shrink-0" size={16} />
                          <CurrencyInput value={Number(form.incentiveTech)} onChange={v => updateField('incentiveTech', v)} className="w-full bg-transparent outline-none text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pb-4">
                <button onClick={() => navigate('/management/products')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
                <button onClick={handleSave} disabled={saving} className={'px-4 py-2 bg-bosch-blue text-white rounded text-sm ' + (saving ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90')}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}

          {!isAdd && activeTab === APPLICABLE_VEHICLES_TAB_INDEX && (
            <div className="flex flex-col gap-4">
              <div className="rounded border bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b bg-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-700">Applicable Vehicles</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Select the vehicle models that this product can be used for.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                    <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
                      {selectedVehicleModelIds.length} selected
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
                      {applicableVehicleOptions.length} total vehicles
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex w-full max-w-xl items-center gap-2 rounded border bg-white px-3 py-2">
                      <Search className="shrink-0 text-slate-400" size={16} />
                      <input
                        value={applicableVehicleSearch}
                        onChange={e => setApplicableVehicleSearch(e.target.value)}
                        placeholder="Search available vehicles..."
                        className="w-full bg-transparent text-sm outline-none"
                      />
                      {applicableVehicleSearch && (
                        <button type="button" onClick={() => setApplicableVehicleSearch('')} className="shrink-0 text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVehicleSelections(availableApplicableVehicles.map(option => option.id), true)}
                        disabled={availableApplicableVehicles.length === 0}
                        className="rounded border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Add Visible
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleModelIds([])}
                        disabled={selectedApplicableVehicles.length === 0}
                        className="rounded border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Clear Selected
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleModelIds(initialVehicleModelIds)}
                        disabled={!hasVehicleSelectionChanges}
                        className="rounded border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveApplicableVehicles}
                        disabled={applicableVehiclesSaving || applicableVehiclesLoading || !hasVehicleSelectionChanges}
                        className="inline-flex items-center gap-2 rounded bg-bosch-blue px-3 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <span>{applicableVehiclesSaving ? 'Saving...' : 'Save Vehicles'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">Available Vehicles</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Search and add from the configured vehicle models.
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                          {availableApplicableVehicles.length} available
                        </span>
                      </div>

                      {applicableVehiclesLoading ? (
                        <div className="px-4 py-8 text-sm text-slate-500">
                          Loading applicable vehicles...
                        </div>
                      ) : availableApplicableVehicles.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-slate-500">
                          {applicableVehicleOptions.length === 0
                            ? 'No vehicle models are configured yet.'
                            : filteredApplicableVehicles.length === 0
                              ? 'No vehicle models match the current search.'
                              : 'All matching vehicle models are already selected.'}
                        </div>
                      ) : (
                        <div className="max-h-[28rem] divide-y divide-slate-200 overflow-y-auto bg-white">
                          {availableApplicableVehicles.map(option => (
                            <div key={option.id} className="flex items-start justify-between gap-3 px-4 py-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800">{option.label}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {option.description || (option.makeName ? `${option.makeName} vehicle model` : 'Vehicle model')}
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-label={`Add ${option.label}`}
                                onClick={() => setVehicleSelection(option.id, true)}
                                className="shrink-0 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-bosch-blue/40 hover:bg-slate-50 hover:text-bosch-blue"
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">Selected Vehicles</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Vehicles currently linked to this product.
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                          {selectedApplicableVehicles.length} linked
                        </span>
                      </div>

                      {selectedApplicableVehicles.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-slate-500">
                          No vehicles selected for this product yet.
                        </div>
                      ) : (
                        <div className="max-h-[28rem] divide-y divide-slate-200 overflow-y-auto bg-white">
                          {selectedApplicableVehicles.map(option => (
                            <div key={option.id} className="flex items-start justify-between gap-3 px-4 py-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800">{option.label}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {option.description || (option.makeName ? `${option.makeName} vehicle model` : 'Vehicle model')}
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-label={`Remove ${option.label}`}
                                onClick={() => setVehicleSelection(option.id, false)}
                                className="shrink-0 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isAdd && activeTab === INVENTORY_TAB_INDEX && (
            <ProductInventoryTransactionsTable productId={id} />
          )}

          {!isAdd && activeTab === JOB_ORDERS_TAB_INDEX && (
            <ProductJobOrderTable productId={id} />
          )}
        </div>
      </div>
    </div>
  )
}
