// @ts-nocheck
import React, { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useNavigate } from 'react-router-dom'

export default function ProfileMenu() {
  const { role, logout, user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const getDisplayName = () => {
    if (!user) return role
    const first = user.given_name || (typeof user.name === 'string' ? user.name.split(' ')[0] : null)
    const last = user.family_name || (typeof user.name === 'string' ? user.name.split(' ').slice(-1)[0] : null)
    const combined = [first, last].filter(Boolean).join(' ')
    return combined || user.name || role
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/5">
        <div className="w-8 h-8 rounded-full bg-bosch-blue/10 dark:bg-bosch-yellow flex items-center justify-center text-bosch-blue dark:text-black font-bold">B</div>
        <div className="hidden sm:block text-sm text-slate-700 dark:text-slate-200">{getDisplayName()}</div>
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-md shadow-lg py-3">
          <div className="px-4 pb-3">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">{getDisplayName() || 'User'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-300">{user?.email || ''}</div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700" />

          <div className="border-t border-gray-100 dark:border-slate-700 my-2" />

          <div className="px-2">
            <button onClick={() => { logout(); setOpen(false); navigate('/login') }} className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 text-sm">
              <LogOut size={16} className="text-slate-600 dark:text-slate-200" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
