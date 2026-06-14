// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { formatPHMobile } from '../../utils/format'
import { buildCompletenessFilterOptions, filterByCompleteness, hasValue, type CompletenessFilterKey } from '../../utils/completenessFilter'
import { deleteCompany, getCompanyInfo } from '../../services/adminService'
import { useAuth } from '../../auth/useAuth'
import { ClientTypeFilter, EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions } from '../lists'

export interface CompanyItem {
  id: number
  name: string
  address?: string
  email?: string
  mobileNumber?: string
  tin?: string
  gCash?: string
  bankNo?: string
  isPrimaryCompany?: boolean
  primaryCompany?: boolean
  createdById?: number
  createdDateTime?: string
  updatedById?: number
  updatedDateTime?: string
}

function normalizeCompanyId(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase())
  return false
}

function normalizeCompanyItem(item: any): CompanyItem {
  const id = normalizeCompanyId(item?.id ?? item?.Id ?? item?.companyId ?? item?.CompanyId)

  return {
    ...item,
    id,
    name: item?.name ?? item?.Name ?? item?.companyName ?? item?.CompanyName ?? '',
    address: item?.address ?? item?.Address ?? '',
    email: item?.email ?? item?.Email ?? '',
    mobileNumber: item?.mobileNumber ?? item?.MobileNumber ?? item?.mobile ?? item?.Mobile ?? '',
    tin: item?.tin ?? item?.TIN ?? item?.tinNumber ?? '',
    gCash: item?.gCash ?? item?.GCash ?? item?.gcash ?? item?.Gcash ?? '',
    bankNo: item?.bankNo ?? item?.BankNo ?? item?.bankAccount ?? item?.BankAccount ?? '',
    isPrimaryCompany: readBoolean(item?.isPrimaryCompany ?? item?.IsPrimaryCompany ?? item?.primaryCompany ?? item?.PrimaryCompany),
    primaryCompany: readBoolean(item?.primaryCompany ?? item?.PrimaryCompany ?? item?.isPrimaryCompany ?? item?.IsPrimaryCompany),
    createdById: item?.createdById ?? item?.CreatedById,
    createdDateTime: item?.createdDateTime ?? item?.CreatedDateTime,
    updatedById: item?.updatedById ?? item?.UpdatedById,
    updatedDateTime: item?.updatedDateTime ?? item?.UpdatedDateTime,
  }
}

export default function CompanyInfoTable({ items = [] }: { items?: CompanyItem[] }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { logout } = useAuth()
  const [rows, setRows] = useState<CompanyItem[]>(() => items.map(normalizeCompanyItem))
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilterKey>('ALL')

  function isCompanyComplete(company: CompanyItem) {
    return hasValue(company.name) && hasValue(company.email) && hasValue(company.mobileNumber)
  }

  function isPrimaryCompany(company: CompanyItem) {
    return Boolean(company.isPrimaryCompany ?? company.primaryCompany)
  }

  const completenessFiltered = useMemo(() => filterByCompleteness(rows, completenessFilter, isCompanyComplete), [rows, completenessFilter])
  const completenessFilterOptions = useMemo(() => buildCompletenessFilterOptions(rows, isCompanyComplete), [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return completenessFiltered
    return completenessFiltered.filter(row => (
      (row.name || '').toLowerCase().includes(q)
      || (row.email || '').toLowerCase().includes(q)
      || (row.mobileNumber || '').includes(q)
    ))
  }, [completenessFiltered, searchTerm])

  const filteredTotal = filtered.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [pageCount, page])

  function handleAdd() { navigate('/administrators/company/add') }
  function handleEdit(id: number) {
    const companyId = normalizeCompanyId(id)
    if (!companyId) {
      showToast('Cannot edit this company because its ID is missing.', 'error')
      return
    }
    navigate(`/administrators/company/${companyId}`)
  }
  function handleDelete(id: number) {
    const companyId = normalizeCompanyId(id)
    if (!companyId) {
      showToast('Cannot delete this company because its ID is missing.', 'error')
      return
    }
    setDeleteTargetId(companyId); setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    try {
      await deleteCompany(deleteTargetId)
      setRows(current => current.filter(item => normalizeCompanyId(item.id) !== deleteTargetId))
      showToast('Record deleted', 'success')
    } catch (e: any) {
      const err = e as any
      if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) { try { logout() } catch {}; navigate('/login'); return }
      showToast(`Delete failed: ${e?.message || 'Unknown'}`, 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
      setSearchTerm('')
      setPage(0)
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await getCompanyInfo()
        if (!mounted) return
        if (Array.isArray(res)) setRows(res.map(normalizeCompanyItem))
        else setRows([])
      } catch (e: any) {
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')) { try { logout() } catch {}; navigate('/login'); return }
        setRows([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [logout, navigate])

  return (
    <div className="w-full">
      <ListPageHeader
        icon={Building2}
        title="Company Information"
        subtitle="Registered company profiles and contact details"
        addLabel="Add Company"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: rows.length }, { label: 'Primary', value: rows.filter(isPrimaryCompany).length }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this record?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={completenessFilter}
              onChange={(value) => { setCompletenessFilter(value as CompletenessFilterKey); setPage(0) }}
              options={completenessFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search name, email, mobile..." />}
        />

        <div className="overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Company Name</th>
                <th className="px-5 py-3">Primary Company</th>
                <th className="px-5 py-3">Email Address</th>
                <th className="px-5 py-3">Mobile Number</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={Building2} colSpan={6} />}
              {paged.map((row, index) => (
                <tr key={row.id || `${row.name}-${index}`} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">{row.id ? `#${row.id}` : '-'}</td>
                  <td className="px-5 py-4 align-middle text-sm">
                    <button onClick={() => handleEdit(row.id)} className="text-sky-600 dark:text-sky-400 hover:underline transition-colors font-semibold">{row.name}</button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm">
                    {isPrimaryCompany(row) ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Primary
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.email ?? ''}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 tabular-nums">{formatPHMobile(row.mobileNumber)}</td>
                  <td className="px-5 py-4 align-middle text-right">
                    <RowActions actions={[
                      { kind: 'edit', onClick: () => handleEdit(row.id), label: `edit-${row.id}` },
                      { kind: 'delete', onClick: () => handleDelete(row.id), label: `delete-${row.id}` },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={filteredTotal} onPageChange={setPage} onRowsPerPageChange={(count) => { setRowsPerPage(count); setPage(0) }} />
      </div>
    </div>
  )
}
