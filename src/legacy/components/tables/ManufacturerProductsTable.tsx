// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Package2 } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { formatAmount } from '../../utils/format'
import { useAuth } from '../../auth/useAuth'
import { getProductsByManufacturerId } from '../../services/managementService'
import { ListPageHeader, ListSearchInput, ListToolbar, ListPagination, RowActions, EmptyState } from '../lists'

interface ProductRow {
  id: number
  name: string
  description?: string
  displayName?: string
  partNo?: string
  purchaseCost?: number
  sellingPrice?: number
  productGroupName?: string
  productCategoryName?: string
  supplierName?: string
}

function normalizeProduct(row: any): ProductRow {
  return {
    ...row,
    id: Number(row?.id ?? row?.Id ?? 0),
    name: String(row?.name ?? row?.Name ?? ''),
    description: row?.description ?? row?.Description ?? '',
    displayName: row?.displayName ?? row?.DisplayName ?? '',
    partNo: row?.partNo ?? row?.PartNo ?? '',
    purchaseCost: row?.purchaseCost ?? row?.PurchaseCost ?? 0,
    sellingPrice: row?.sellingPrice ?? row?.SellingPrice ?? 0,
    productGroupName: row?.productGroup?.name ?? row?.productGroup?.Name ?? row?.productGroupName ?? '',
    productCategoryName: row?.productCategory?.name ?? row?.productCategory?.Name ?? row?.productCategoryName ?? '',
    supplierName: row?.supplier?.name ?? row?.supplier?.Name ?? row?.supplierName ?? '',
  }
}

export default function ManufacturerProductsTable({ manufacturerId }: { manufacturerId?: string | number }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { logout } = useAuth()
  const [rows, setRows] = useState<ProductRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!manufacturerId) { setRows([]); return }
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await getProductsByManufacturerId(manufacturerId)
        const list = Array.isArray(data) ? data : []
        if (mounted) setRows(list.map(normalizeProduct))
      } catch (error: any) {
        if (!mounted) return
        const message = String(error?.message ?? '')
        if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('unauthorized')) {
          try { logout() } catch {}
          navigate('/login')
          return
        }
        setRows([])
        showToast('Failed to load manufacturer products', 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [manufacturerId, logout, navigate, showToast])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      String(row.name || '').toLowerCase().includes(q)
      || String(row.description || '').toLowerCase().includes(q)
      || String(row.partNo || '').toLowerCase().includes(q)
      || String(row.productGroupName || '').toLowerCase().includes(q)
      || String(row.supplierName || '').toLowerCase().includes(q)
    )
  }, [rows, searchTerm])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [filtered, page, rowsPerPage])
  useEffect(() => { if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1)) }, [pageCount, page])

  const getProductSubtitle = (row: ProductRow) => {
    if (row.description?.trim()) return row.description.replace(/\s+/g, ' ').trim()

    const fallback = [
      row.partNo ? `Part No. ${row.partNo}` : '',
      row.productGroupName ?? '',
      row.supplierName ?? ''
    ].filter(Boolean)

    return fallback.join(' • ')
  }

  return (
    <div className="w-full">
      <ListPageHeader icon={Boxes} title="Manufacturer Products" subtitle="Products currently linked to the selected manufacturer" stats={[{ label: 'Total', value: rows.length }]} />
      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search name, part no, group, supplier..." />} />
        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Group</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3 text-right">Purchase Cost</th>
                <th className="px-5 py-3 text-right">Selling Price</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Boxes} colSpan={8} title="No products found" description="This manufacturer does not have any related products yet." />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-xs text-slate-400 dark:text-slate-500 font-mono">#{row.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => navigate(`/management/products/${row.id}`)} className="group text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                          <Package2 size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {row.name}
                          </div>
                          {!!getProductSubtitle(row) && (
                            <div className="mt-0.5 max-w-[32rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              {getProductSubtitle(row)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.productGroupName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.productCategoryName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.supplierName ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-600 dark:text-slate-300 tabular-nums">{formatAmount(row.purchaseCost ?? 0)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">{formatAmount(row.sellingPrice ?? 0)}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => navigate(`/management/products/${row.id}`), label: `edit-${row.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0) }} />
      </div>
    </div>
  )
}
