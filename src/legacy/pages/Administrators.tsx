// @ts-nocheck
import React from 'react'
import { Link } from 'react-router-dom'
import { Building2, FileText, Hash, Settings, ShieldCheck, Users } from 'lucide-react'
import DataTable from '../components/tables/DataTable'
import CompanyInfoTable from '../components/tables/CompanyInfoTable'

export default function Administrators(){
  const menuItems = [
    { to: '/administrators/company-information', label: 'Company Information', description: 'Business profile and branch details', icon: Building2 },
    { to: '/administrators/user-accounts', label: 'User Accounts', description: 'Application users and access', icon: Users },
    { to: '/administrators/user-roles', label: 'User Roles', description: 'Role records and permissions', icon: ShieldCheck },
    { to: '/administrators/rbac', label: 'RBAC', description: 'Role-based page and login access', icon: ShieldCheck },
    { to: '/administrators/void-codes', label: 'Void Codes', description: 'Generate one-time expiring override codes', icon: Hash },
    { to: '/administrators/settings', label: 'Settings', description: 'Login branding, logo, and background', icon: Settings },
    { to: '/administrators/legal-pages', label: 'ToC & Privacy', description: 'Terms and privacy page content', icon: FileText },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Administrators</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {menuItems.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100 transition group-hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-300">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</span>
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <DataTable columns={[{key:'id', title:'ID'},{key:'name', title:'Name'},{key:'role', title:'Role'}]} data={[]} />
      <div>
        <h3 className="text-md font-semibold mb-3">Company Information</h3>
        <CompanyInfoTable />
      </div>
    </div>
  )
}
