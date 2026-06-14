import { prisma } from "@/server/db/prisma";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RoutePermissionRule = {
  path: string;
  permission: string;
  prefix?: boolean;
};

export const canLoginPermission = "auth.can_login";
export const canDeletePermission = "auth.can_delete";
export const canVoidPermission = "operations.can_void";
export const canUseChatbotPermission = "chatbot.can_use";
export const rbacViewPermission = "administrator.rbac.view";
export const rbacManagePermission = "administrator.rbac.manage";

const pageRoutes: RoutePermissionRule[] = [
  { path: "/dashboard", permission: "page.dashboard.view" },
  { path: "/help-center", permission: "page.help_center.view" },
  { path: "/customers", permission: "page.customers.view", prefix: true },
  { path: "/customer", permission: "page.customers.view", prefix: true },
  { path: "/vehicles", permission: "page.vehicles.view", prefix: true },
  {
    path: "/operations/inspection",
    permission: "page.operations.inspection.view",
    prefix: true,
  },
  {
    path: "/operations/estimate",
    permission: "page.operations.estimate.view",
    prefix: true,
  },
  {
    path: "/operations/job-order",
    permission: "page.operations.job_order.view",
    prefix: true,
  },
  {
    path: "/operations/jobs-board",
    permission: "page.operations.jobs_board.view",
    prefix: true,
  },
  {
    path: "/operations/invoice",
    permission: "page.operations.invoice.view",
    prefix: true,
  },
  {
    path: "/operations/deposit",
    permission: "page.operations.deposit.view",
    prefix: true,
  },
  {
    path: "/operations/payment",
    permission: "page.operations.payment.view",
    prefix: true,
  },
  {
    path: "/operations/accounts-receivable",
    permission: "page.operations.accounts_receivable.view",
    prefix: true,
  },
  {
    path: "/operations/quick-sales",
    permission: "page.operations.quick_sales.view",
    prefix: true,
  },
  {
    path: "/operations/expenses",
    permission: "page.operations.expenses.view",
    prefix: true,
  },
  {
    path: "/operations/petty-cash",
    permission: "page.operations.petty_cash.view",
    prefix: true,
  },
  {
    path: "/operations/camera-events",
    permission: "page.administrator.camera_events.view",
    prefix: true,
  },
  { path: "/operations", permission: "page.operations.view" },
  {
    path: "/management/packages",
    permission: "page.management.packages.view",
    prefix: true,
  },
  {
    path: "/management/services",
    permission: "page.management.services.view",
    prefix: true,
  },
  {
    path: "/management/inventory",
    permission: "page.management.inventory.view",
    prefix: true,
  },
  {
    path: "/management/products",
    permission: "page.management.products.view",
    prefix: true,
  },
  {
    path: "/management/suppliers",
    permission: "page.management.suppliers.view",
    prefix: true,
  },
  {
    path: "/management/manufacturers",
    permission: "page.management.manufacturers.view",
    prefix: true,
  },
  { path: "/management", permission: "page.management.view" },
  {
    path: "/configuration/service-categories",
    permission: "page.configuration.service_categories.view",
    prefix: true,
  },
  {
    path: "/configuration/service-groups",
    permission: "page.configuration.service_groups.view",
    prefix: true,
  },
  {
    path: "/configuration/vehicle-makes",
    permission: "page.configuration.vehicle_makes.view",
    prefix: true,
  },
  {
    path: "/configuration/vehicle-models",
    permission: "page.configuration.vehicle_models.view",
    prefix: true,
  },
  {
    path: "/configuration/product-groups",
    permission: "page.configuration.product_groups.view",
    prefix: true,
  },
  {
    path: "/configuration/product-categories",
    permission: "page.configuration.product_categories.view",
    prefix: true,
  },
  {
    path: "/configuration/parameter-groups",
    permission: "page.configuration.parameter_groups.view",
    prefix: true,
  },
  {
    path: "/configuration/parameters",
    permission: "page.configuration.parameters.view",
    prefix: true,
  },
  {
    path: "/configuration/unit-of-measures",
    permission: "page.configuration.unit_of_measures.view",
    prefix: true,
  },
  {
    path: "/configuration/job-statuses",
    permission: "page.configuration.job_statuses.view",
    prefix: true,
  },
  {
    path: "/configuration/inspection-templates",
    permission: "page.configuration.inspection_templates.view",
    prefix: true,
  },
  { path: "/configuration", permission: "page.configuration.view" },
  {
    path: "/reports/daily-sales",
    permission: "page.reports.daily_sales.view",
    prefix: true,
  },
  {
    path: "/reports/monthly-sales-summary",
    permission: "page.reports.monthly_sales_summary.view",
    prefix: true,
  },
  {
    path: "/reports/incentives-tech",
    permission: "page.reports.incentives_tech.view",
    prefix: true,
  },
  {
    path: "/reports/incentives-sa",
    permission: "page.reports.incentives_sa.view",
    prefix: true,
  },
  {
    path: "/reports/commissions-tech",
    permission: "page.reports.commissions_tech.view",
    prefix: true,
  },
  {
    path: "/reports/commissions-sa",
    permission: "page.reports.commissions_sa.view",
    prefix: true,
  },
  {
    path: "/reports/credit-card-payment",
    permission: "page.reports.credit_card_payment.view",
    prefix: true,
  },
  {
    path: "/reports/accounts-receivable-daily",
    permission: "page.reports.accounts_receivable_daily.view",
    prefix: true,
  },
  {
    path: "/reports/accounts-receivable-monthly",
    permission: "page.reports.accounts_receivable_monthly.view",
    prefix: true,
  },
  { path: "/reports/payment-type", permission: "page.reports.view", prefix: true },
  {
    path: "/reports/petty-cash-voucher",
    permission: "page.reports.petty_cash_voucher.view",
    prefix: true,
  },
  {
    path: "/reports/inventory-products",
    permission: "page.reports.inventory_products.view",
    prefix: true,
  },
  {
    path: "/reports/inventory-checks",
    permission: "page.reports.inventory_check.view",
    prefix: true,
  },
  { path: "/reports", permission: "page.reports.view" },
  {
    path: "/administrators/company-information",
    permission: "page.administrator.company_information.view",
    prefix: true,
  },
  {
    path: "/administrators/company",
    permission: "page.administrator.company_information.view",
    prefix: true,
  },
  {
    path: "/administrators/user-accounts",
    permission: "page.administrator.user_accounts.view",
    prefix: true,
  },
  {
    path: "/administrators/user-roles",
    permission: "page.administrator.user_roles.view",
    prefix: true,
  },
  {
    path: "/administrators/settings",
    permission: "page.administrator.settings.view",
    prefix: true,
  },
  {
    path: "/administrators/legal-pages",
    permission: "page.administrator.legal_pages.view",
    prefix: true,
  },
  {
    path: "/administrators/rbac",
    permission: "page.administrator.rbac.view",
    prefix: true,
  },
  {
    path: "/administrators/camera-events",
    permission: "page.administrator.camera_events.view",
    prefix: true,
  },
  {
    path: "/administrators/void-codes",
    permission: "page.administrator.void_codes.view",
    prefix: true,
  },
  { path: "/administrators", permission: "page.administrator.view" },
];

export const routePermissionRules: RoutePermissionRule[] = [
  { path: "/api/rbac", permission: "page.administrator.rbac.view", prefix: true },
  { path: "/api/chat", permission: canUseChatbotPermission, prefix: true },
  {
    path: "/api/users",
    permission: "page.administrator.user_accounts.view",
    prefix: true,
  },
  {
    path: "/api/roles",
    permission: "page.administrator.user_roles.view",
    prefix: true,
  },
  {
    path: "/api/companyinfo",
    permission: "page.administrator.company_information.view",
    prefix: true,
  },
  {
    path: "/api/login-settings",
    permission: "page.administrator.settings.view",
    prefix: true,
  },
  {
    path: "/api/administrators/void-codes",
    permission: "page.administrator.void_codes.view",
    prefix: true,
  },
  {
    path: "/api/camera/hikvision/settings",
    permission: "page.administrator.settings.view",
    prefix: true,
  },
  {
    path: "/api/config/inspection-templates",
    permission: "page.configuration.inspection_templates.view",
    prefix: true,
  },
  { path: "/api/config", permission: "page.configuration.view", prefix: true },
  {
    path: "/api/servicecategories",
    permission: "page.configuration.service_categories.view",
    prefix: true,
  },
  { path: "/api/customers", permission: "page.customers.view", prefix: true },
  { path: "/api/vehicles", permission: "page.vehicles.view", prefix: true },
  {
    path: "/api/management/reports/inventory-products",
    permission: "page.reports.inventory_products.view",
    prefix: true,
  },
  {
    path: "/api/management/reports/inventory-checks",
    permission: "page.reports.inventory_check.view",
    prefix: true,
  },
  {
    path: "/api/management/inventory",
    permission: "page.management.inventory.view",
    prefix: true,
  },
  {
    path: "/api/management/packages",
    permission: "page.management.packages.view",
    prefix: true,
  },
  {
    path: "/api/management/services",
    permission: "page.management.services.view",
    prefix: true,
  },
  {
    path: "/api/management/products",
    permission: "page.management.products.view",
    prefix: true,
  },
  {
    path: "/api/management/suppliers",
    permission: "page.management.suppliers.view",
    prefix: true,
  },
  {
    path: "/api/management/manufacturers",
    permission: "page.management.manufacturers.view",
    prefix: true,
  },
  { path: "/api/management", permission: "page.management.view", prefix: true },
  {
    path: "/api/operations/reports/daily-sales",
    permission: "page.reports.daily_sales.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/monthly-sales-summary",
    permission: "page.reports.monthly_sales_summary.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/incentives-tech",
    permission: "page.reports.incentives_tech.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/incentives-sa",
    permission: "page.reports.incentives_sa.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/commissions-tech",
    permission: "page.reports.commissions_tech.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/commissions-sa",
    permission: "page.reports.commissions_sa.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/credit-card-payment",
    permission: "page.reports.credit_card_payment.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/accounts-receivable-daily",
    permission: "page.reports.accounts_receivable_daily.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/accounts-receivable-monthly",
    permission: "page.reports.accounts_receivable_monthly.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/payment-type",
    permission: "page.reports.view",
    prefix: true,
  },
  {
    path: "/api/operations/reports/petty-cash-voucher",
    permission: "page.reports.petty_cash_voucher.view",
    prefix: true,
  },
  {
    path: "/api/operations/inspections",
    permission: "page.operations.inspection.view",
    prefix: true,
  },
  {
    path: "/api/operations/estimates",
    permission: "page.operations.estimate.view",
    prefix: true,
  },
  {
    path: "/api/operations/joborders",
    permission: "page.operations.job_order.view",
    prefix: true,
  },
  {
    path: "/api/operations/invoices",
    permission: "page.operations.invoice.view",
    prefix: true,
  },
  {
    path: "/api/operations/deposits",
    permission: "page.operations.deposit.view",
    prefix: true,
  },
  {
    path: "/api/operations/payments",
    permission: "page.operations.payment.view",
    prefix: true,
  },
  {
    path: "/api/operations/accounts-receivable",
    permission: "page.operations.accounts_receivable.view",
    prefix: true,
  },
  {
    path: "/api/operations/quicksales",
    permission: "page.operations.quick_sales.view",
    prefix: true,
  },
  {
    path: "/api/operations/expenses",
    permission: "page.operations.expenses.view",
    prefix: true,
  },
  {
    path: "/api/operations/pettycashvouchers",
    permission: "page.operations.petty_cash.view",
    prefix: true,
  },
  { path: "/api/operations", permission: "page.operations.view", prefix: true },
  {
    path: "/api/camera/hikvision",
    permission: "page.administrator.camera_events.view",
    prefix: true,
  },
];

export function normalizePath(path: string | null | undefined) {
  let value = (path ?? "").trim();

  if (!value) {
    return "/";
  }

  const queryIndex = value.indexOf("?");
  if (queryIndex >= 0) {
    value = value.slice(0, queryIndex);
  }

  if (!value.startsWith("/")) {
    value = `/${value}`;
  }

  value = value.replaceAll("\\", "/").toLowerCase();
  while (value.includes("//")) {
    value = value.replaceAll("//", "/");
  }

  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function isGet(method: string) {
  return method.toUpperCase() === "GET";
}

function isDelete(method: string) {
  return method.toUpperCase() === "DELETE";
}

function isPost(method: string) {
  return method.toUpperCase() === "POST";
}

function resolve(path: string, routes: RoutePermissionRule[]) {
  for (const route of routes) {
    if (route.prefix) {
      if (path === route.path || path.startsWith(`${route.path}/`)) {
        return route.permission;
      }

      continue;
    }

    if (path === route.path) {
      return route.permission;
    }
  }

  return null;
}

export function isPublicPage(pathname: string | null | undefined) {
  const path = normalizePath(pathname);
  return [
    "/",
    "/login",
    "/forgot-password",
    "/forgot-pin",
    "/terms-and-conditions",
    "/privacy-policy",
  ].includes(path);
}

export function isPublicApiRequest(
  pathname: string | null | undefined,
  method: string,
) {
  const path = normalizePath(pathname);

  if (path === "/api/auth/login") return true;
  if (path === "/api/auth/forgot-pin") return true;
  if (path === "/api/users/change-password-by-email") return true;
  if (isGet(method) && path.startsWith("/api/companyinfo")) return true;
  if (isGet(method) && path.startsWith("/api/login-settings")) return true;
  if (
    isGet(method) &&
    path.startsWith("/api/operations/inspections/") &&
    path.includes("/photos")
  ) {
    return true;
  }

  return false;
}

export function resolvePagePermission(pathname: string | null | undefined) {
  const path = normalizePath(pathname);
  return isPublicPage(path) ? null : resolve(path, pageRoutes);
}

export function resolveRoutePermission(pathname: string) {
  return resolve(normalizePath(pathname), routePermissionRules);
}

export function resolveMethodPermission(method: HttpMethod) {
  return method === "DELETE" ? canDeletePermission : null;
}

export function getApiPermissionKeys(
  pathname: string | null | undefined,
  method: string,
) {
  const path = normalizePath(pathname);

  if (path === "/api/rbac/effective-permissions" || path === "/api/rbac/page-access") {
    return [];
  }

  if (path === "/api/rbac/save") {
    return [rbacManagePermission];
  }

  if (path === "/api/rbac" && !isGet(method)) {
    return [rbacManagePermission];
  }

  if (path === "/api/rbac" || path.startsWith("/api/rbac/")) {
    return [];
  }

  const permissions = new Set<string>();
  const routePermission = resolve(path, routePermissionRules);

  if (routePermission) {
    permissions.add(routePermission);
  }

  if (isDelete(method)) {
    permissions.add(canDeletePermission);
  }

  if (
    isPost(method) &&
    path.startsWith("/api/operations/") &&
    path.endsWith("/void")
  ) {
    permissions.add(canVoidPermission);
  }

  return [...permissions];
}

export async function getEffectiveRoleIds(userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) {
    return new Set<number>();
  }

  const user = await prisma.user.findUnique({
    where: { Id: userId },
    select: { RoleId: true },
  });

  if (!user) {
    return new Set<number>();
  }

  const userRoles = await prisma.userRole.findMany({
    where: { UserId: userId },
    select: { RoleId: true },
  });

  return new Set(
    [user.RoleId, ...userRoles.map((userRole) => userRole.RoleId)].filter(
      (roleId) => roleId > 0,
    ),
  );
}

export async function getEffectivePermissionKeys(userId: number) {
  const roleIds = [...(await getEffectiveRoleIds(userId))];

  if (roleIds.length === 0) {
    return new Set<string>();
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      RoleId: { in: roleIds },
      Allowed: true,
    },
    select: {
      Permission: {
        select: {
          Key: true,
        },
      },
    },
  });

  return new Set(
    rolePermissions
      .map((rolePermission) => rolePermission.Permission.Key)
      .filter(Boolean),
  );
}

export async function hasPermission(userId: number, permissionKey: string) {
  if (!Number.isInteger(userId) || userId <= 0 || !permissionKey.trim()) {
    return false;
  }

  const permissions = await getEffectivePermissionKeys(userId);
  return permissions.has(permissionKey);
}

export async function hasAllPermissions(
  userId: number,
  permissionKeys: string[],
) {
  const permissions = await getEffectivePermissionKeys(userId);
  return permissionKeys.every((permissionKey) => permissions.has(permissionKey));
}

export async function hasAnyPermission(
  userId: number,
  permissionKeys: string[],
) {
  const permissions = await getEffectivePermissionKeys(userId);
  return permissionKeys.some((permissionKey) => permissions.has(permissionKey));
}

export async function canSignIn(userId: number) {
  return hasPermission(userId, canLoginPermission);
}
