// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCircle2 } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { getUsers } from '../../services/adminService'
import { formatPHMobile } from '../../utils/format'
import { ClientTypeFilter, EmptyState, ListPageHeader, ListPagination, ListSearchInput, ListToolbar, RowActions, StatusBadge } from '../lists'

export interface UserItem {
  id: number
  fullName: string
  email: string
  mobile: string
  primaryRole: string
  status: 'Active' | 'Inactive'
}

type UserStatusFilterKey = 'ALL' | 'Active' | 'Inactive'

export function resolveUserAccountStatus(user: any): UserItem['status'] {
  const activeValue = user?.isActive ?? user?.IsActive ?? user?.active ?? user?.Active
  if (typeof activeValue === 'boolean') return activeValue ? 'Active' : 'Inactive'
  if (typeof activeValue === 'number') return activeValue === 0 ? 'Inactive' : 'Active'
  if (typeof activeValue === 'string') {
    const normalized = activeValue.trim().toLowerCase()
    if (['false', '0', 'no', 'inactive', 'disabled'].includes(normalized)) return 'Inactive'
    if (['true', '1', 'yes', 'active', 'enabled'].includes(normalized)) return 'Active'
  }

  const statusValue = user?.status ?? user?.Status
  if (typeof statusValue === 'boolean') return statusValue ? 'Active' : 'Inactive'
  if (typeof statusValue === 'number') return statusValue === 0 ? 'Inactive' : 'Active'
  if (typeof statusValue === 'string') {
    const normalized = statusValue.trim().toLowerCase()
    if (['inactive', 'disabled', 'false', '0', 'no'].includes(normalized)) return 'Inactive'
    if (['active', 'enabled', 'true', '1', 'yes'].includes(normalized)) return 'Active'
  }

  return 'Active'
}

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function UserListTable({ users }: { users?: UserItem[] }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { role, logout } = useAuth()
  const [rows, setRows] = useState<UserItem[]>(users ?? [])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [statusFilter, setStatusFilter] = useState<UserStatusFilterKey>('ALL')

  useEffect(() => { setRows(users ?? []) }, [users])
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await getUsers()
        if (!mounted) return
        if (Array.isArray(res)) {
          const mapped = (res as any[]).map(user => ({
            id: user.id ?? user.userId ?? user.user_id,
            fullName: `${user.firstName ?? user.FirstName ?? user.firstname ?? user.first_name ?? user.first ?? ''}` + ((user.lastName || user.LastName || user.lastname || user.last_name || user.last) ? ` ${user.lastName ?? user.LastName ?? user.lastname ?? user.last_name ?? user.last}` : ''),
            email: user.email ?? user.emailAddress ?? user.email_address ?? '',
            mobile: user.mobile ?? user.mobileNumber ?? user.mobile_number ?? user.phone ?? '',
            primaryRole: (typeof user.role === 'object' && user.role !== null ? user.role.name : user.role) ?? (typeof user.primaryRole === 'object' && user.primaryRole !== null ? user.primaryRole.name : user.primaryRole) ?? user.roleName ?? '',
            status: resolveUserAccountStatus(user),
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

  const statusCounts = useMemo(() => {
    let active = 0
    let inactive = 0
    for (const row of rows) {
      if ((row.status || '').toUpperCase() === 'ACTIVE') active += 1
      else inactive += 1
    }
    return { all: rows.length, active, inactive }
  }, [rows])

  const statusFiltered = useMemo(() => {
    if (statusFilter === 'ALL') return rows
    return rows.filter(row => (row.status || '').toUpperCase() === statusFilter.toUpperCase())
  }, [rows, statusFilter])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return statusFiltered
    return statusFiltered.filter(row =>
      row.fullName.toLowerCase().includes(q)
      || row.email.toLowerCase().includes(q)
      || row.mobile.toLowerCase().includes(q)
      || row.primaryRole.toLowerCase().includes(q)
    )
  }, [searchTerm, statusFiltered])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage))
  const paged = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    if (page > Math.max(0, pageCount - 1)) setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  function handleAdd() { if (!(role === 'ADMIN' || role === 'STAFF')) { showToast('Permission denied', 'error'); return } navigate('/administrators/user-accounts/add') }
  function handleEdit(id: number) { navigate(`/administrators/user-accounts/${id}`) }
  function handleDelete(id: number) { setDeleteTargetId(id); setShowDeleteConfirm(true) }

  async function confirmDelete() {
    if (deleteTargetId == null) return
    setIsDeleting(true)
    setLoading(true)
    try {
      setRows(current => current.filter(item => item.id !== deleteTargetId))
      showToast('User deleted', 'success')
    } catch (e: any) {
      showToast(`Delete failed: ${e?.message || 'Unknown'}`, 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteTargetId(null)
      setLoading(false)
      setSearchTerm('')
      setPage(0)
    }
  }

  return (
    <div className="w-full">
      <ListPageHeader
        icon={UserCircle2}
        title="User Accounts"
        subtitle="System user accounts with assigned roles and status"
        addLabel="Add User"
        onAdd={handleAdd}
        stats={[{ label: 'Total', value: rows.length }]}
      />

      <ConfirmModal isOpen={showDeleteConfirm} title="Confirm Delete" message="Are you sure you want to delete this user?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => { setShowDeleteConfirm(false); setDeleteTargetId(null) }} loading={isDeleting} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-2xl shadow-card">
        <ListToolbar
          left={
            <ClientTypeFilter
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value as UserStatusFilterKey); setPage(0) }}
              options={[
                { key: 'ALL', label: 'All', count: statusCounts.all },
                { key: 'Active', label: 'Active', count: statusCounts.active, activeClass: 'bg-emerald-500 text-white' },
                { key: 'Inactive', label: 'Inactive', count: statusCounts.inactive, activeClass: 'bg-slate-500 text-white' },
              ]}
            />
          }
          right={<ListSearchInput value={searchTerm} onChange={(value) => { setSearchTerm(value); setPage(0) }} placeholder="Search name, email, role..." />}
        />

        <div className="hidden sm:block overflow-x-auto w-full">
          <table className="min-w-full w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 w-16">ID</th>
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email Address</th>
                <th className="px-5 py-3">Mobile Number</th>
                <th className="px-5 py-3">Primary Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <EmptyState icon={UserCircle2} title="No users found" colSpan={7} />}
              {paged.map(row => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700/60 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4 align-middle text-sm text-slate-500 dark:text-slate-400 font-mono">#{row.id}</td>
                  <td className="px-5 py-4 align-middle">
                    <button onClick={() => handleEdit(row.id)} className="group inline-flex items-center gap-3 text-left">
                      <span className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm bg-gradient-to-br from-sky-500 to-indigo-500">
                        {getInitials(row.fullName)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{row.fullName}</span>
                    </button>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300">{row.email}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-600 dark:text-slate-300 tabular-nums">{formatPHMobile(row.mobile)}</td>
                  <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-300 font-medium">{row.primaryRole}</td>
                  <td className="px-5 py-4 align-middle"><StatusBadge status={row.status} /></td>
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
          {paged.length === 0 && <EmptyState icon={UserCircle2} title="No users found" />}
          <div className="flex flex-col gap-3 p-3">
            {paged.map(row => (
              <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => handleEdit(row.id)} className="flex items-start gap-3 flex-1 text-left">
                    <span className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm bg-gradient-to-br from-sky-500 to-indigo-500">
                      {getInitials(row.fullName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{row.fullName}</span>
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{row.email}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.primaryRole} | {formatPHMobile(row.mobile)}</div>
                    </div>
                  </button>
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
