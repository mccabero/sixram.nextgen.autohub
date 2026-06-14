// @ts-nocheck
import { Activity, Box, Calendar, ClipboardList, Cpu, CreditCard, DollarSign, Edit3, FileCheck, FileMinus, FilePlus, FileText, Grid, Hash, Search, Settings, ShieldCheck, ShoppingCart, Users } from 'lucide-react'

export type NavChild = { to: string; label: string; permissionKey: string }
export type NavItem = { to: string; label: string; icon: any; roles: string[]; permissionKey: string; children?: NavChild[] }

export const navigationItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: Grid, roles: ['ADMIN', 'STAFF'], permissionKey: 'page.dashboard.view' },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['ADMIN', 'STAFF'], permissionKey: 'page.customers.view' },
  { to: '/vehicles', label: 'Vehicles', icon: Box, roles: ['ADMIN', 'STAFF'], permissionKey: 'page.vehicles.view' },
  { to: '/operations', label: 'Operations', icon: Cpu, roles: ['ADMIN', 'STAFF'], permissionKey: 'page.operations.view', children: [
    { to: '/operations/inspection', label: 'Inspection', permissionKey: 'page.operations.inspection.view' },
    { to: '/operations/estimate', label: 'Estimate', permissionKey: 'page.operations.estimate.view' },
    { to: '/operations/job-order', label: 'Job Order', permissionKey: 'page.operations.job_order.view' },
    { to: '/operations/jobs-board', label: 'Jobs Board', permissionKey: 'page.operations.jobs_board.view' },
    { to: '/operations/invoice', label: 'Invoice', permissionKey: 'page.operations.invoice.view' },
    { to: '/operations/payment', label: 'Payment', permissionKey: 'page.operations.payment.view' },
    { to: '/operations/accounts-receivable', label: 'Accounts Receivable', permissionKey: 'page.operations.accounts_receivable.view' },
    { to: '/operations/deposit', label: 'Deposit', permissionKey: 'page.operations.deposit.view' },
    { to: '/operations/quick-sales', label: 'Quick Sales', permissionKey: 'page.operations.quick_sales.view' },
    { to: '/operations/expenses', label: 'Expenses', permissionKey: 'page.operations.expenses.view' },
    { to: '/operations/petty-cash', label: 'Petty Cash Voucher', permissionKey: 'page.operations.petty_cash.view' },
  ] },
  { to: '/management', label: 'Management', icon: FileText, roles: ['ADMIN', 'STAFF'], permissionKey: 'page.management.view', children: [
    { to: '/management/packages', label: 'Packages', permissionKey: 'page.management.packages.view' },
    { to: '/management/services', label: 'Services', permissionKey: 'page.management.services.view' },
    { to: '/management/inventory', label: 'Inventory', permissionKey: 'page.management.inventory.view' },
    { to: '/management/products', label: 'Products', permissionKey: 'page.management.products.view' },
    { to: '/management/suppliers', label: 'Suppliers', permissionKey: 'page.management.suppliers.view' },
    { to: '/management/manufacturers', label: 'Manufacturers', permissionKey: 'page.management.manufacturers.view' },
  ] },
  { to: '/configuration', label: 'Configuration', icon: Settings, roles: ['ADMIN'], permissionKey: 'page.configuration.view', children: [
    { to: '/configuration/service-categories', label: 'Service Categories', permissionKey: 'page.configuration.service_categories.view' },
    { to: '/configuration/service-groups', label: 'Service Groups', permissionKey: 'page.configuration.service_groups.view' },
    { to: '/configuration/vehicle-makes', label: 'Vehicle Makes', permissionKey: 'page.configuration.vehicle_makes.view' },
    { to: '/configuration/vehicle-models', label: 'Vehicle Models', permissionKey: 'page.configuration.vehicle_models.view' },
    { to: '/configuration/product-groups', label: 'Product Groups', permissionKey: 'page.configuration.product_groups.view' },
    { to: '/configuration/product-categories', label: 'Product Categories', permissionKey: 'page.configuration.product_categories.view' },
    { to: '/configuration/parameter-groups', label: 'Parameter Groups', permissionKey: 'page.configuration.parameter_groups.view' },
    { to: '/configuration/parameters', label: 'Parameters', permissionKey: 'page.configuration.parameters.view' },
    { to: '/configuration/unit-of-measures', label: 'Unit of Measures', permissionKey: 'page.configuration.unit_of_measures.view' },
    { to: '/configuration/job-statuses', label: 'Job Statuses', permissionKey: 'page.configuration.job_statuses.view' },
    { to: '/configuration/inspection-templates', label: 'Inspection Templates', permissionKey: 'page.configuration.inspection_templates.view' },
  ] },
  { to: '/reports', label: 'Reports', icon: FileText, roles: ['ADMIN', 'STAFF'], permissionKey: 'page.reports.view' },
  { to: '/administrators', label: 'Administrators', icon: Users, roles: ['ADMIN'], permissionKey: 'page.administrator.view', children: [
    { to: '/administrators/company-information', label: 'Company Information', permissionKey: 'page.administrator.company_information.view' },
    { to: '/administrators/user-accounts', label: 'User Accounts', permissionKey: 'page.administrator.user_accounts.view' },
    { to: '/administrators/user-roles', label: 'User Roles', permissionKey: 'page.administrator.user_roles.view' },
    { to: '/administrators/rbac', label: 'RBAC', permissionKey: 'page.administrator.rbac.view' },
    { to: '/administrators/camera-events', label: 'Camera Events', permissionKey: 'page.administrator.camera_events.view' },
    { to: '/administrators/void-codes', label: 'Void Codes', permissionKey: 'page.administrator.void_codes.view' },
    { to: '/administrators/settings', label: 'Settings', permissionKey: 'page.administrator.settings.view' },
    { to: '/administrators/legal-pages', label: 'ToC & Privacy', permissionKey: 'page.administrator.legal_pages.view' },
  ] },
]

export const childIconMap: Record<string, any> = {
  '/operations/appointments': Calendar,
  '/operations/inspection': Search,
  '/operations/estimate': FilePlus,
  '/operations/job-order': Edit3,
  '/operations/jobs-board': Grid,
  '/operations/invoice': FileCheck,
  '/operations/deposit': DollarSign,
  '/operations/payment': CreditCard,
  '/operations/accounts-receivable': DollarSign,
  '/operations/quick-sales': ShoppingCart,
  '/operations/expenses': FileText,
  '/operations/petty-cash': FileMinus,
  '/administrators/camera-events': Activity,
  '/management/packages': FilePlus,
  '/management/services': Edit3,
  '/management/inventory': Box,
  '/management/products': Box,
  '/management/suppliers': Users,
  '/management/manufacturers': Cpu,
  '/configuration/service-categories': FileText,
  '/configuration/service-groups': Edit3,
  '/configuration/vehicle-makes': Box,
  '/configuration/vehicle-models': Cpu,
  '/configuration/product-groups': FilePlus,
  '/configuration/product-categories': FileMinus,
  '/configuration/parameter-groups': FileText,
  '/configuration/parameters': FilePlus,
  '/configuration/unit-of-measures': DollarSign,
  '/configuration/job-statuses': FileCheck,
  '/configuration/inspection-templates': ClipboardList,
  '/administrators/settings': Settings,
  '/administrators/legal-pages': ShieldCheck,
  '/administrators/company-information': FileText,
  '/administrators/user-accounts': Users,
  '/administrators/user-roles': Edit3,
  '/administrators/rbac': ShieldCheck,
  '/administrators/void-codes': Hash,
}

export function filterNavigationByPermissions(
  items: NavItem[],
  permissionKeys: Iterable<string>,
  options?: { hiddenPermissionKeys?: Iterable<string> }
): NavItem[] {
  const allowed = new Set(Array.from(permissionKeys, key => String(key).toLowerCase()))
  const hidden = new Set(Array.from(options?.hiddenPermissionKeys ?? [], key => String(key).toLowerCase()))

  return items
    .map(item => {
      if (hidden.has(item.permissionKey.toLowerCase())) return null
      const children = item.children?.filter(child => {
        const permissionKey = child.permissionKey.toLowerCase()
        return allowed.has(permissionKey) && !hidden.has(permissionKey)
      })
      const itemAllowed = allowed.has(item.permissionKey.toLowerCase())
      if (item.children) {
        if (!itemAllowed && (!children || children.length === 0)) return null
        return { ...item, children: children ?? [] }
      }
      return itemAllowed ? item : null
    })
    .filter((item): item is NavItem => Boolean(item))
}

export function findFirstAccessiblePath(permissionKeys: Iterable<string>): string | null {
  const filtered = filterNavigationByPermissions(navigationItems, permissionKeys)

  for (const item of filtered) {
    if (item.children && item.children.length > 0) return item.children[0].to
    return item.to
  }

  return null
}
