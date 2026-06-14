// @ts-nocheck
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Package2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { formatAmount } from '../../utils/format'
import { deleteProduct, getProducts } from '../../services/managementService'
import { useAuth } from '../../auth/useAuth'
import { ClientTypeFilter, EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions } from '../lists'

export interface Item { id:number; name:string; description?:string }

type StockFilterKey = 'ALL' | 'LOW' | 'MID' | 'HIGH'
type ProductRow = Item & {
  displayName?: string
  partNo?: string
  productGroupName?: string
  productCategoryName?: string
  manufacturerName?: string
  lowStockThreshold?: number
  stockOnHand?: number
  stockStatus?: string
  purchaseCost?: number
  sellingPrice?: number
  isQuickSalesProduct?: boolean
  applicableVehicleCount?: number
  applicableVehiclePreview?: string[]
  applicableVehicleSearch?: string
  searchableText?: string
}

function getStockOnHand(item: Item) {
  return Number((item as any).stockOnHand ?? (item as any).StockOnHand ?? 0) || 0
}

function buildSearchableText(row: Partial<ProductRow>) {
  return [
    row.name ?? '',
    row.displayName ?? '',
    row.partNo ?? '',
    row.productGroupName ?? '',
    row.productCategoryName ?? '',
    row.manufacturerName ?? '',
    row.description ?? '',
    row.applicableVehicleSearch ?? '',
    row.isQuickSalesProduct ? 'quick sales' : '',
  ].join(' ').toLowerCase()
}

function normalizeProductRow(product: any): ProductRow {
  const applicableVehiclePreview = Array.isArray(product?.applicableVehiclePreview ?? product?.ApplicableVehiclePreview)
    ? (product?.applicableVehiclePreview ?? product?.ApplicableVehiclePreview)
        .map((value: unknown) => String(value ?? '').trim())
        .filter(Boolean)
    : []

  const applicableVehicleSearch = String(
    product?.applicableVehicleSearch
    ?? product?.ApplicableVehicleSearch
    ?? applicableVehiclePreview.join(' ')
  )

  const row: ProductRow = {
    ...product,
    id: Number(product?.id ?? product?.Id ?? 0),
    name: String(product?.name ?? product?.Name ?? ''),
    description: product?.description ?? product?.Description ?? '',
    displayName: product?.displayName ?? product?.DisplayName ?? '',
    partNo: product?.partNo ?? product?.PartNo ?? '',
    productGroupName: product?.productGroup?.Name ?? product?.productGroup?.name ?? product?.group?.name ?? product?.group ?? product?.groupName ?? '',
    productCategoryName: product?.productCategory?.name ?? product?.productCategory?.Name ?? product?.category?.name ?? product?.category ?? product?.categoryName ?? '',
    manufacturerName: product?.manufacturer?.name ?? product?.manufacturer?.Name ?? product?.manufacturerName ?? '',
    lowStockThreshold: product?.lowStockThreshold ?? product?.LowStockThreshold ?? product?.reorderLevel ?? product?.ReorderLevel ?? 5,
    stockOnHand: Number(product?.stockOnHand ?? product?.StockOnHand ?? 0) || 0,
    stockStatus: String(product?.stockStatus ?? product?.StockStatus ?? ''),
    purchaseCost: Number(product?.purchaseCost ?? product?.PurchaseCost ?? product?.purchase_cost ?? product?.cost ?? 0) || 0,
    sellingPrice: Number(product?.sellingPrice ?? product?.SellingPrice ?? product?.selling_price ?? product?.price ?? 0) || 0,
    isQuickSalesProduct: Boolean(product?.isQuickSalesProduct ?? product?.IsQuickSalesProduct ?? false),
    applicableVehicleCount: Number(product?.applicableVehicleCount ?? product?.ApplicableVehicleCount ?? applicableVehiclePreview.length) || 0,
    applicableVehiclePreview,
    applicableVehicleSearch,
  }

  row.searchableText = buildSearchableText(row)
  return row
}

function StockPill({ status }: { status?: string }) {
  const normalized = String(status ?? '').toLowerCase()
  const classes = normalized.includes('out')
    ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
    : normalized.includes('low')
      ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
      : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'

  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${classes}`}>{status || 'In Stock'}</span>
}

export default function ProductsTable({ items }: { items?: Item[] }){
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role, logout } = useAuth()
  const [rows,setRows]=useState<ProductRow[]>([])
  const [searchTerm,setSearchTerm]=useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [stockFilter, setStockFilter] = useState<StockFilterKey>('ALL')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setRows(Array.isArray(items) ? items.map(normalizeProductRow) : []) }, [items])

  useEffect(()=>{
    if (typeof items !== 'undefined') return

    const ctl = new AbortController()
    const load = async () => {
      setLoading(true)
      try{
        const res = await getProducts({ includeApplicableVehicleSearch: true })
        if (Array.isArray(res)) {
          setRows((res as any[]).map(normalizeProductRow))
        } else {
          setRows([])
        }
      }catch(e:any){
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        setRows([])
      }finally{ setLoading(false) }
    }
    load()
    return () => ctl.abort()
  },[])

  const stockBands = useMemo(() => {
    const stockLevels = rows
      .map(getStockOnHand)
      .filter(stock => Number.isFinite(stock))
      .sort((a, b) => a - b)

    if (stockLevels.length === 0) {
      return { lowMax: 0, midMax: 0 }
    }

    const lowIndex = Math.max(0, Math.floor((stockLevels.length - 1) / 3))
    const midIndex = Math.max(lowIndex, Math.floor(((stockLevels.length - 1) * 2) / 3))

    return {
      lowMax: stockLevels[lowIndex],
      midMax: stockLevels[midIndex],
    }
  }, [rows])

  const stockFiltered = useMemo(() => {
    if (stockFilter === 'ALL') return rows

    return rows.filter(row => {
      const stock = getStockOnHand(row)
      if (stockFilter === 'LOW') return stock <= stockBands.lowMax
      if (stockFilter === 'MID') return stock > stockBands.lowMax && stock <= stockBands.midMax
      return stock > stockBands.midMax
    })
  }, [rows, stockBands, stockFilter])

  const stockFilterOptions = useMemo(() => {
    let low = 0
    let mid = 0
    let high = 0
    for (const row of rows) {
      const stock = getStockOnHand(row)
      if (stock <= stockBands.lowMax) low += 1
      else if (stock <= stockBands.midMax) mid += 1
      else high += 1
    }

    return [
      { key: 'ALL' as const, label: 'All', count: rows.length },
      { key: 'LOW' as const, label: 'Low', count: low, activeClass: 'bg-sky-500 text-white' },
      { key: 'MID' as const, label: 'Mid', count: mid, activeClass: 'bg-amber-500 text-white' },
      { key: 'HIGH' as const, label: 'High', count: high, activeClass: 'bg-emerald-500 text-white' },
    ]
  }, [rows, stockBands])

  const stockStats = useMemo(() => {
    let low = 0
    let out = 0
    for (const row of rows) {
      const status = String(row.stockStatus ?? '').toLowerCase()
      if (status.includes('out')) out += 1
      else if (status.includes('low')) low += 1
    }
    return { low, out }
  }, [rows])

  const filtered = useMemo(()=>{
    const q = deferredSearchTerm.trim().toLowerCase()
    if (!q) return stockFiltered
    return stockFiltered.filter(row => String(row.searchableText ?? '').includes(q))
  },[stockFiltered, deferredSearchTerm])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(()=>{ const start = page * rowsPerPage; return filtered.slice(start, start + rowsPerPage) },[filtered, page, rowsPerPage])
  useEffect(()=>{ if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) },[page, pageCount])

  function handleAdd(){ if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/management/products/add') }
  function handleEdit(id:number){ navigate(`/management/products/${id}`) }
  function handleDelete(id:number){ setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete(){
    if (deleteTargetId == null) return
    setIsDeleting(true); setLoading(true)
    try{ await deleteProduct(String(deleteTargetId)); setRows(r=>r.filter(x=>x.id!==deleteTargetId)); showToast('Record deleted','success') }
    catch(e:any){ showToast('Delete failed: '+(e?.message||'Unknown'),'error') }
    finally{ setIsDeleting(false); setShowDeleteConfirm(false); setDeleteTargetId(null); setSearchTerm(''); setPage(0); setLoading(false) }
  }

  const getApplicableVehicleSummary = (row: ProductRow) => {
    const preview = Array.isArray(row.applicableVehiclePreview) ? row.applicableVehiclePreview.filter(Boolean) : []
    if (preview.length === 0) return ''
    const remaining = Math.max(0, (row.applicableVehicleCount ?? preview.length) - preview.length)
    return remaining > 0 ? `${preview.join(', ')} +${remaining} more` : preview.join(', ')
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Boxes}
        title="Products"
        subtitle="Parts, supplies, and inventory items with pricing"
        addLabel="Add Product"
        onAdd={handleAdd}
        stats={[
          { label: 'Total', value: rows.length },
          { label: 'Quick Sales', value: rows.filter(row => row.isQuickSalesProduct).length, tone: 'sky' },
          { label: 'Low', value: stockStats.low, tone: 'amber' },
          { label: 'Out', value: stockStats.out, tone: 'rose' },
        ]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this record?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={stockFilter}
              onChange={(value) => { setStockFilter(value); setPage(0) }}
              label="On Hand"
              options={stockFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(v)=>{ setSearchTerm(v); setPage(0) }} placeholder="Search name, part no, group, manufacturer, vehicle..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Manufacturer</th>
                <th className="px-5 py-3 text-right">On Hand</th>
                <th className="px-5 py-3 text-right">Reorder</th>
                <th className="px-5 py-3">Stock</th>
                <th className="px-5 py-3">Quick Sales</th>
                <th className="px-5 py-3 text-right">Purchase Cost</th>
                <th className="px-5 py-3 text-right">Selling Price</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-10 text-center">
                    <span className="text-sm text-slate-500">Loading products...</span>
                  </td>
                </tr>
              ) : paged.length === 0 && <EmptyState icon={Boxes} colSpan={12} />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{row.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(row.id)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                          <Package2 size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {row.name}
                          </div>
                          {!!getApplicableVehicleSummary(row) && (
                            <div className="mt-1 max-w-[32rem] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                              Vehicles: {getApplicableVehicleSummary(row)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.productGroupName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.productCategoryName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.manufacturerName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{formatAmount(row.stockOnHand ?? 0)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-600 dark:text-slate-300 tabular-nums">{formatAmount(row.lowStockThreshold ?? 5)}</td>
                  <td className="px-5 py-4 align-middle whitespace-nowrap"><StockPill status={row.stockStatus} /></td>
                  <td className="px-5 py-4 align-middle whitespace-nowrap">
                    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${row.isQuickSalesProduct ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30' : 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600'}`}>
                      {row.isQuickSalesProduct ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-600 dark:text-slate-300 tabular-nums">{formatAmount(row.purchaseCost ?? 0)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{formatAmount(row.sellingPrice ?? 0)}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: ()=>handleEdit(row.id), label: `edit-${row.id}` },
                      { kind: 'delete', onClick: ()=>handleDelete(row.id), label: `delete-${row.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n)=>{ setRowsPerPage(n); setPage(0) }} />
      </div>
    </div>
  )
}
