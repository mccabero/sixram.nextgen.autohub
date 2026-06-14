// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Shield, Trash2, Users } from 'lucide-react'
import { useToast } from '../../contexts/toast'
import { useAuth } from '../../auth/useAuth'
import { deleteRole, getRoleById, createRole, updateRole } from '../../services/adminService'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useCanDeletePermission } from '../../hooks/useCanDeletePermission'

export default function ManageUserRoles(){
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const id = params.id
  const isAdd = !id || id === 'add' || location.pathname.endsWith('/add')
  const { showToast } = useToast()

  const [form, setForm] = useState({ name: '', description: '' })
  const [assignedUsers, setAssignedUsers] = useState<any[]>([])
  const [errors, setErrors] = useState<{ name?: string }>({})
  const { logout } = useAuth()
  const [, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'assigned-users'>('general')
  const canDelete = useCanDeletePermission()

  useEffect(()=>{
    if (!id || isAdd) return
    let mounted = true
    const load = async ()=>{
      setLoading(true)
      try{
        const res:any = await getRoleById(id!)
        if (!mounted) return
        const name = res?.name ?? res?.Name ?? res?.roleName ?? ''
        const description = res?.description ?? res?.Description ?? res?.desc ?? ''
        const users = Array.isArray(res?.assignedUsers ?? res?.AssignedUsers)
          ? (res?.assignedUsers ?? res?.AssignedUsers).map((user: any) => ({
              id: user?.id ?? user?.Id,
              name: user?.name ?? user?.Name ?? user?.email ?? user?.Email ?? '',
              email: user?.email ?? user?.Email ?? '',
              isActive: typeof (user?.isActive ?? user?.IsActive) === 'undefined' ? true : !!(user?.isActive ?? user?.IsActive),
              isPrimaryRole: !!(user?.isPrimaryRole ?? user?.IsPrimaryRole),
              isAssignedRole: !!(user?.isAssignedRole ?? user?.IsAssignedRole),
            }))
          : []
        setForm({ name, description })
        setAssignedUsers(users)
      }catch(e:any){
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')){
          try{ logout() }catch{}
          navigate('/login')
          return
        }
      }finally{
        if (mounted) setLoading(false)
      }
    }
    load()
    return ()=>{ mounted = false }
  },[id])

  function updateField(key: string, value: any){ setForm(f=> ({ ...f, [key]: value})); setErrors(e=> ({ ...e, [key]: '' })) }

  function validate(){ const e: any = {}; if (!form.name || !String(form.name).trim()) e.name = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  const primaryCount = assignedUsers.filter(user => user.isPrimaryRole).length
  const additionalCount = assignedUsers.filter(user => user.isAssignedRole && !user.isPrimaryRole).length

  function handleSave(){
    if (!validate()){ showToast('Please fill required fields', 'error'); return }
    if (isAdd) {
      setShowConfirm(true)
      return
    }
    setIsSaving(true)
    ;(async ()=>{
      try{
        await updateRole(id!, { name: form.name, description: form.description })
        showToast('Role updated', 'success')
        navigate('/administrators/user-roles')
      }catch(e:any){
        const err = e as any
        if (err && typeof err.message === 'string' && err.message.includes('Unauthorized')){ try{ logout() }catch{} navigate('/login'); return }
        showToast('Update failed: '+(e?.message||'Unknown'),'error')
      }finally{
        setIsSaving(false)
      }
    })()
  }

  async function confirmCreate(){
    setIsSaving(true)
    try{
      await createRole({ name: form.name, description: form.description })
      showToast('Role added','success')
      setShowConfirm(false)
      navigate('/administrators/user-roles')
    }catch(e:any){
      showToast('Create failed: '+(e?.message||'Unknown'),'error')
    }finally{
      setIsSaving(false)
    }
  }

  async function confirmDelete(){
    if (!id || isAdd) return
    if (!canDelete) {
      showToast('You are not allowed to delete records.', 'error')
      return
    }
    setIsDeleting(true)
    try{
      await deleteRole(id)
      showToast('Role deleted', 'success')
      setShowDeleteConfirm(false)
      navigate('/administrators/user-roles')
    }catch(e:any){
      showToast(`Delete failed: ${e?.message || 'Unknown'}`, 'error')
    }finally{
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{isAdd ? 'Add Role' : 'Manage Role'}</h2>
        {!isAdd && canDelete && (
          <button
            onClick={()=>setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-rose-200 rounded bg-white text-rose-600 hover:bg-rose-50 text-sm"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === 'general'
              ? 'border border-b-0 border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          General Information
        </button>
        {!isAdd && (
          <button
            type="button"
            onClick={() => setActiveTab('assigned-users')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'assigned-users'
                ? 'border border-b-0 border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Assigned Users
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">

        {activeTab === 'general' && (
          <div className="bg-white rounded shadow-sm">
            <div className="rounded border overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center">
                <div className="text-sm font-medium text-slate-700">General Information</div>
              </div>
              <div className="p-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span></label>
                  <div className="mt-2 flex items-center gap-2 bg-white border rounded px-3 py-2">
                    <Shield className="text-slate-400 shrink-0" size={16} />
                    <input placeholder="Name" value={form.name} onChange={e=>updateField('name', e.target.value)} className="w-full bg-transparent outline-none text-sm" />
                  </div>
                  {errors.name && <div className="text-rose-600 text-sm mt-1">{errors.name}</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <div className="mt-2 bg-white border rounded">
                    <textarea value={form.description} onChange={e=>updateField('description', e.target.value)} placeholder="Optional description" className="w-full p-3 bg-transparent outline-none text-sm resize-none h-24" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assigned-users' && !isAdd && (
          <div className="bg-white rounded shadow-sm">
            <div className="rounded border overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-700">Assigned Users</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 font-medium text-slate-700">{assignedUsers.length} total</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">{primaryCount} primary</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">{additionalCount} additional</span>
                </div>
              </div>
              <div className="p-4">
                {assignedUsers.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                    No users are currently linked to this role.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Role Link</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedUsers.map(user => (
                          <tr key={user.id} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => navigate(`/administrators/user-accounts/${user.id}`)}
                                className="text-left"
                              >
                                <div className="font-medium text-slate-900 hover:text-sky-700">{user.name || `User #${user.id}`}</div>
                              </button>
                              <div className="text-xs text-slate-400">ID #{user.id}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="inline-flex items-center gap-2 text-slate-600">
                                <Mail size={14} className="text-slate-400" />
                                <span>{user.email || '-'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {user.isPrimaryRole && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">Primary Role</span>}
                                {user.isAssignedRole && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">Assigned Role</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pb-4">
          <button onClick={()=>navigate('/administrators/user-roles')} className="px-4 py-2 border rounded bg-white text-slate-700 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-bosch-blue text-white rounded hover:opacity-90 text-sm">Save</button>
        </div>

      </div>

      <ConfirmModal isOpen={showConfirm} title="Confirm Create" message={`Are you sure you want to add role "${form.name}"?`} confirmLabel="Create" cancelLabel="Cancel" onConfirm={confirmCreate} onCancel={()=>setShowConfirm(false)} loading={isSaving} />
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirm Delete"
        message={`Are you sure you want to delete role "${form.name}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={()=>setShowDeleteConfirm(false)}
        loading={isDeleting}
      />
    </div>
  )
}
