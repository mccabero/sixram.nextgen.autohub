// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteRole, getRoles } from '../../services/adminService'
import { buildCompletenessFilterOptions, filterByCompleteness, hasValue, type CompletenessFilterKey } from '../../utils/completenessFilter'
import { ClientTypeFilter, EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions } from '../lists'

export interface RoleItem {
  id: number
  name: string
  description?: string
}

export default function RoleListTable({ roles }: { roles?: RoleItem[] }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role, logout } = useAuth()
  const [rows, setRows] = useState<RoleItem[]>(roles ?? [])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilterKey>('ALL')

  function isRoleComplete(item: RoleItem) {
    return hasValue(item.name) && hasValue(item.description)
  }

  useEffect(() => { setRows(roles ?? []) }, [roles])
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await getRoles()
        if (!mounted) return
        if (Array.isArray(res)) {
          const mapped = (res as any[]).map(roleItem => ({
            id: roleItem.id ?? roleItem.Id ?? roleItem.ID ?? roleItem.roleId ?? roleItem.role_id,
            name: roleItem.name ?? roleItem.Name ?? roleItem.roleName ?? roleItem.role_name ?? '',
            description: roleItem.description ?? roleItem.Description ?? roleItem.desc ?? '',
          }))
          setRows(mapped)
        } else {
          setRows([])
        }
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

  const completenessFiltered = useMemo(() => filterByCompleteness(rows, completenessFilter, isRoleComplete), [rows, completenessFilter])
  const completenessFilterOptions = useMemo(() => buildCompletenessFilterOptions(rows, isRoleComplete), [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return completenessFiltered
    return completenessFiltered.filter(row => row.name.toLowerCase().includes(q) || (row.description || '').toLowerCase().includes(q))
  }, [completenessFiltered, searchTerm])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  function handleAdd() { if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/administrators/user-roles/add') }
  function handleEdit(id: number) { navigate(`/administrators/user-roles/${id}`) }
  function handleDelete(id: number) { setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    setLoading(true)
    const idToDelete = deleteTargetId
    try {
      await deleteRole(idToDelete)
      setRows(current => current.filter(item => item.id !== idToDelete))
      showToast('Role deleted', 'success')
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
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={ShieldCheck}
        title="User Roles"
        subtitle="Define permission sets and access levels for users"
        addLabel="Add Role"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: rows.length }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this role?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={completenessFilter}
              onChange={(value) => { setCompletenessFilter(value as CompletenessFilterKey); setPage(0) }}
              options={completenessFilterOptions}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search name, description..." />}
        />

        <div className="hidden sm:block overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={ShieldCheck} title="No roles found" colSpan={4} />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{row.id}</td>
                  <td className="px-5 py-4 align-middle text-sm">
                    <button onClick={() => handleEdit(row.id)} className="text-sky-600 dark:text-sky-400 hover:underline transition-colors font-semibold">{row.name}</button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.description}</td>
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

        <div className="sm:hidden">
          {paged.length === 0 && <EmptyState icon={ShieldCheck} title="No roles found" />}
          <div className="flex flex-col gap-3 p-3">
            {paged.map(row => (
              <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] text-slate-400 font-mono">#{row.id}</span>
                      <button onClick={() => handleEdit(row.id)} className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline">{row.name}</button>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">{row.description}</div>
                  </div>
                  <RowActions actions={[
                    { kind: 'edit', onClick: () => handleEdit(row.id), label: `edit-${row.id}` },
                    { kind: 'delete', onClick: () => handleDelete(row.id), label: `delete-${row.id}` },
                  ]} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ListPagination page={page} pageCount={pageCount} rowsPerPage={rowsPerPage} total={total} onPageChange={setPage} onRowsPerPageChange={(count) => { setRowsPerPage(count); setPage(0) }} />
      </div>
    </div>
  )
}
