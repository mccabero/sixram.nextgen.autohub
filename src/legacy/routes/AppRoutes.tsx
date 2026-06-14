// @ts-nocheck
import React, { Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import ProtectedRoute from './ProtectedRoute'
import ErrorBoundary from '../components/ErrorBoundary'
import { lazyWithReload as lazy } from '../utils/chunkLoadRecovery'
import { getLoginSettings } from '../services/adminService'

const Dashboard = lazy(() => import('../pages/Dashboard'))
const HelpCenter = lazy(() => import('../pages/HelpCenter'))
const Login = lazy(() => import('../pages/Login'))
const TermsAndConditions = lazy(() => import('../pages/TermsAndConditions'))
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'))
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'))
const ForgotPin = lazy(() => import('../pages/ForgotPin'))
const Customers = lazy(() => import('../pages/Customers'))
const ManageCustomer = lazy(() => import('../pages/ManageCustomer'))
const Vehicles = lazy(() => import('../pages/Vehicles'))
const ManageVehicle = lazy(() => import('../pages/ManageVehicle'))
const ManageInspection = lazy(() => import('../pages/ManageInspection'))
const ManageEstimate = lazy(() => import('../pages/ManageEstimate'))
const ManageJobOrder = lazy(() => import('../pages/ManageJobOrder'))
const ManageInvoice = lazy(() => import('../pages/ManageInvoice'))
const Inspection = lazy(() => import('../pages/operations/Inspection'))
const Estimate = lazy(() => import('../pages/operations/Estimate'))
const JobOrder = lazy(() => import('../pages/operations/JobOrder'))
const JobsBoard = lazy(() => import('../pages/operations/JobsBoard'))
const Appointments = lazy(() => import('../pages/operations/Appointments'))
const AddAppointment = lazy(() => import('../pages/operations/AddAppointment'))
const ManageAppointment = lazy(() => import('../pages/operations/ManageAppointment'))
const Invoice = lazy(() => import('../pages/operations/Invoice'))
const Deposit = lazy(() => import('../pages/operations/Deposit'))
const Payment = lazy(() => import('../pages/operations/Payment'))
const AccountsReceivable = lazy(() => import('../pages/operations/AccountsReceivable'))
const ManagePayment = lazy(() => import('../pages/operations/ManagePayment'))
const QuickSales = lazy(() => import('../pages/operations/QuickSales'))
const Expenses = lazy(() => import('../pages/operations/Expenses'))
const ManageExpenses = lazy(() => import('../pages/operations/ManageExpenses'))
const ManageQuickSales = lazy(() => import('../pages/operations/ManageQuickSales'))
const ManageDeposit = lazy(() => import('../pages/operations/ManageDeposit'))
const PettyCash = lazy(() => import('../pages/operations/PettyCash'))
const PettyCashVoucher = lazy(() => import('../pages/operations/PettyCashVoucher'))
const CameraEvents = lazy(() => import('../pages/administrators/CameraEvents'))
const Packages = lazy(() => import('../pages/management/Packages'))
const Services = lazy(() => import('../pages/management/Services'))
const Products = lazy(() => import('../pages/management/Products'))
const Inventory = lazy(() => import('../pages/management/Inventory'))
const Suppliers = lazy(() => import('../pages/management/Suppliers'))
const Manufacturers = lazy(() => import('../pages/management/Manufacturers'))
const ManagePackages = lazy(() => import('../pages/management/ManagePackages'))
const ManageServices = lazy(() => import('../pages/management/ManageServices'))
const ManageProducts = lazy(() => import('../pages/management/ManageProducts'))
const ManageSuppliers = lazy(() => import('../pages/management/ManageSuppliers'))
const ManageManufacturers = lazy(() => import('../pages/management/ManageManufacturers'))
const Management = lazy(() => import('../pages/Management'))
const ServiceCategories = lazy(() => import('../pages/configuration/ServiceCategories'))
const ServiceGroups = lazy(() => import('../pages/configuration/ServiceGroups'))
const VehicleMakes = lazy(() => import('../pages/configuration/VehicleMakes'))
const VehicleModels = lazy(() => import('../pages/configuration/VehicleModels'))
const ProductGroups = lazy(() => import('../pages/configuration/ProductGroups'))
const ProductCategories = lazy(() => import('../pages/configuration/ProductCategories'))
const ParameterGroups = lazy(() => import('../pages/configuration/ParameterGroups'))
const Parameters = lazy(() => import('../pages/configuration/Parameters'))
const UnitOfMeasures = lazy(() => import('../pages/configuration/UnitOfMeasures'))
const JobStatuses = lazy(() => import('../pages/configuration/JobStatuses'))
const InspectionTemplates = lazy(() => import('../pages/configuration/InspectionTemplates'))
const ManageServiceCategories = lazy(() => import('../pages/configuration/ManageServiceCategories'))
const ManageServiceGroups = lazy(() => import('../pages/configuration/ManageServiceGroups'))
const ManageVehicleMakes = lazy(() => import('../pages/configuration/ManageVehicleMakes'))
const ManageVehicleModels = lazy(() => import('../pages/configuration/ManageVehicleModels'))
const ManageProductGroups = lazy(() => import('../pages/configuration/ManageProductGroups'))
const ManageProductCategories = lazy(() => import('../pages/configuration/ManageProductCategories'))
const ManageParameterGroups = lazy(() => import('../pages/configuration/ManageParameterGroups'))
const ManageParameters = lazy(() => import('../pages/configuration/ManageParameters'))
const ManageUnitOfMeasures = lazy(() => import('../pages/configuration/ManageUnitOfMeasures'))
const ManageJobStatuses = lazy(() => import('../pages/configuration/ManageJobStatuses'))
const ManageInspectionTemplate = lazy(() => import('../pages/configuration/ManageInspectionTemplate'))
const Configuration = lazy(() => import('../pages/Configuration'))
const Reports = lazy(() => import('../pages/Reports'))
const DailySales = lazy(() => import('../pages/reports/DailySales'))
const MonthlySalesSummary = lazy(() => import('../pages/reports/MonthlySalesSummary'))
const IncentivesTech = lazy(() => import('../pages/reports/IncentivesTech'))
const IncentivesSA = lazy(() => import('../pages/reports/IncentivesSA'))
const CommissionsTech = lazy(() => import('../pages/reports/CommissionsTech'))
const CommissionsSA = lazy(() => import('../pages/reports/CommissionsSA'))
const CreditCardPayment = lazy(() => import('../pages/reports/CreditCardPayment'))
const AccountsReceivableDailyReport = lazy(() => import('../pages/reports/AccountsReceivableDaily'))
const AccountsReceivableMonthlyReport = lazy(() => import('../pages/reports/AccountsReceivableMonthly'))
const PaymentTypeReport = lazy(() => import('../pages/reports/PaymentType'))
const PettyCashVoucherReport = lazy(() => import('../pages/reports/PettyCashVoucher'))
const InventoryProductsReport = lazy(() => import('../pages/reports/InventoryProducts'))
const InventoryCheckReport = lazy(() => import('../pages/reports/InventoryCheck'))
const CompanyInformation = lazy(() => import('../pages/administrators/CompanyInformation'))
const UserAccounts = lazy(() => import('../pages/administrators/UserAccounts'))
const ManageUser = lazy(() => import('../pages/administrators/ManageUser'))
const UserRoles = lazy(() => import('../pages/administrators/UserRoles'))
const ManageUserRoles = lazy(() => import('../pages/administrators/ManageUserRoles'))
const ManageCompany = lazy(() => import('../pages/administrators/ManageCompany'))
const ManageSettings = lazy(() => import('../pages/administrators/ManageSettings'))
const ManageLegalPages = lazy(() => import('../pages/administrators/ManageLegalPages'))
const Rbac = lazy(() => import('../pages/administrators/Rbac'))
const VoidCodes = lazy(() => import('../pages/administrators/VoidCodes'))
const Administrators = lazy(() => import('../pages/Administrators'))

function parseBooleanSetting(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function CameraEventsModeGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    getLoginSettings()
      .then((settings: any) => {
        if (!mounted) return
        setAllowed(!parseBooleanSetting(settings?.showIsChanganOption))
      })
      .catch(() => {
        if (!mounted) return
        setAllowed(false)
      })

    return () => { mounted = false }
  }, [])

  if (allowed === null) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Checking camera event availability...</div>
  }

  if (!allowed) return <Navigate to="/administrators/settings" replace />

  return <>{children}</>
}

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-4">Loading…</div>}>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-pin" element={<ForgotPin />} />
        <Route element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><PageLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/add" element={<ManageCustomer />} />
          <Route path="/customer/:id" element={<ManageCustomer />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/add" element={<ManageVehicle />} />
          <Route path="/vehicles/:id" element={<ManageVehicle />} />
          <Route path="/operations/inspection" element={<Inspection />} />
          <Route path="/operations/inspection/add" element={<ManageInspection />} />
          <Route path="/operations/inspection/:id" element={<ManageInspection />} />
          <Route path="/operations/estimate" element={<Estimate />} />
          <Route path="/operations/estimate/add" element={<ManageEstimate />} />
          <Route path="/operations/estimate/:id" element={<ManageEstimate />} />
          <Route path="/operations/job-order/add" element={<ManageJobOrder />} />
          <Route path="/operations/job-order/:id" element={<ManageJobOrder />} />
          <Route path="/operations/expenses/add" element={<ManageExpenses />} />
          <Route path="/operations/expenses/:id" element={<ManageExpenses />} />
          <Route path="/operations/job-order" element={<JobOrder />} />
          <Route path="/operations/jobs-board" element={<JobsBoard />} />
          <Route path="/operations/appointments" element={<Navigate to="/operations" replace />} />
          <Route path="/operations/appointments/new" element={<Navigate to="/operations" replace />} />
          <Route path="/operations/appointments/:id" element={<Navigate to="/operations" replace />} />
          <Route path="/operations/invoice" element={<Invoice />} />
          <Route path="/operations/invoice/add" element={<ManageInvoice />} />
          <Route path="/operations/invoice/:id" element={<ManageInvoice />} />
          <Route path="/operations/deposit" element={<Deposit />} />
          <Route path="/operations/deposit/add" element={<ManageDeposit />} />
          <Route path="/operations/deposit/:id" element={<ManageDeposit />} />
          <Route path="/operations/payment" element={<Payment />} />
          <Route path="/operations/payment/add" element={<ManagePayment />} />
          <Route path="/operations/payment/:id" element={<ManagePayment />} />
          <Route path="/operations/accounts-receivable" element={<AccountsReceivable />} />
          <Route path="/operations/payment-reminder" element={<AccountsReceivable />} />
          <Route path="/operations/payment-reminders" element={<AccountsReceivable />} />
          <Route path="/operations/quick-sales" element={<QuickSales />} />
          <Route path="/operations/quick-sales/add" element={<ManageQuickSales />} />
          <Route path="/operations/quick-sales/:id" element={<ManageQuickSales />} />
          <Route path="/operations/expenses" element={<Expenses />} />
          <Route path="/operations/petty-cash" element={<PettyCash />} />
          <Route path="/operations/petty-cash/add" element={<PettyCashVoucher />} />
          <Route path="/operations/petty-cash/:id" element={<PettyCashVoucher />} />
          <Route path="/operations/camera-events" element={<Navigate to="/administrators/camera-events" replace />} />
          <Route path="/management" element={<Management />} />
          <Route path="/management/packages" element={<Packages />} />
          <Route path="/management/packages/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManagePackages /></ProtectedRoute>} />
          <Route path="/management/packages/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManagePackages /></ProtectedRoute>} />
          <Route path="/management/services" element={<Services />} />
          <Route path="/management/services/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageServices /></ProtectedRoute>} />
          <Route path="/management/services/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageServices /></ProtectedRoute>} />
          <Route path="/management/inventory" element={<Inventory />} />
          <Route path="/management/products" element={<Products />} />
          <Route path="/management/products/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageProducts /></ProtectedRoute>} />
          <Route path="/management/products/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageProducts /></ProtectedRoute>} />
          <Route path="/management/suppliers" element={<Suppliers />} />
          <Route path="/management/suppliers/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageSuppliers /></ProtectedRoute>} />
          <Route path="/management/suppliers/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageSuppliers /></ProtectedRoute>} />
          <Route path="/management/manufacturers" element={<Manufacturers />} />
          <Route path="/management/manufacturers/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageManufacturers /></ProtectedRoute>} />
          <Route path="/management/manufacturers/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageManufacturers /></ProtectedRoute>} />
          <Route
            path="/configuration"
            element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><Configuration /></ProtectedRoute>}
          />
          <Route path="/configuration/service-categories" element={<ServiceCategories />} />
          <Route path="/configuration/service-categories/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageServiceCategories /></ProtectedRoute>} />
          <Route path="/configuration/service-categories/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageServiceCategories /></ProtectedRoute>} />
          <Route path="/configuration/service-groups" element={<ServiceGroups />} />
          <Route path="/configuration/service-groups/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageServiceGroups /></ProtectedRoute>} />
          <Route path="/configuration/service-groups/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageServiceGroups /></ProtectedRoute>} />
          <Route path="/configuration/vehicle-makes" element={<VehicleMakes />} />
          <Route path="/configuration/vehicle-makes/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageVehicleMakes /></ProtectedRoute>} />
          <Route path="/configuration/vehicle-makes/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageVehicleMakes /></ProtectedRoute>} />
          <Route path="/configuration/vehicle-models" element={<VehicleModels />} />
          <Route path="/configuration/vehicle-models/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageVehicleModels /></ProtectedRoute>} />
          <Route path="/configuration/vehicle-models/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageVehicleModels /></ProtectedRoute>} />
          <Route path="/configuration/product-groups" element={<ProductGroups />} />
          <Route path="/configuration/product-groups/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageProductGroups /></ProtectedRoute>} />
          <Route path="/configuration/product-groups/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageProductGroups /></ProtectedRoute>} />
          <Route path="/configuration/product-categories" element={<ProductCategories />} />
          <Route path="/configuration/product-categories/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageProductCategories /></ProtectedRoute>} />
          <Route path="/configuration/product-categories/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageProductCategories /></ProtectedRoute>} />
          <Route path="/configuration/parameter-groups" element={<ParameterGroups />} />
          <Route path="/configuration/parameter-groups/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageParameterGroups /></ProtectedRoute>} />
          <Route path="/configuration/parameter-groups/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageParameterGroups /></ProtectedRoute>} />
          <Route path="/configuration/parameters" element={<Parameters />} />
          <Route path="/configuration/parameters/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageParameters /></ProtectedRoute>} />
          <Route path="/configuration/parameters/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageParameters /></ProtectedRoute>} />
          <Route path="/configuration/unit-of-measures" element={<UnitOfMeasures />} />
          <Route path="/configuration/unit-of-measures/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageUnitOfMeasures /></ProtectedRoute>} />
          <Route path="/configuration/unit-of-measures/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageUnitOfMeasures /></ProtectedRoute>} />
          <Route path="/configuration/job-statuses" element={<JobStatuses />} />
          <Route path="/configuration/job-statuses/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageJobStatuses /></ProtectedRoute>} />
          <Route path="/configuration/job-statuses/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageJobStatuses /></ProtectedRoute>} />
          <Route path="/configuration/inspection-templates" element={<InspectionTemplates />} />
          <Route path="/configuration/inspection-templates/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageInspectionTemplate /></ProtectedRoute>} />
          <Route path="/configuration/inspection-templates/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageInspectionTemplate /></ProtectedRoute>} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/daily-sales" element={<DailySales />} />
          <Route path="/reports/monthly-sales-summary" element={<MonthlySalesSummary />} />
          <Route path="/reports/incentives-tech" element={<IncentivesTech />} />
          <Route path="/reports/incentives-sa" element={<IncentivesSA />} />
          <Route path="/reports/commissions-tech" element={<CommissionsTech />} />
          <Route path="/reports/commissions-sa" element={<CommissionsSA />} />
          <Route path="/reports/credit-card-payment" element={<CreditCardPayment />} />
          <Route path="/reports/accounts-receivable-daily" element={<AccountsReceivableDailyReport />} />
          <Route path="/reports/accounts-receivable-monthly" element={<AccountsReceivableMonthlyReport />} />
          <Route path="/reports/payment-type" element={<PaymentTypeReport />} />
          <Route path="/reports/petty-cash-voucher" element={<PettyCashVoucherReport />} />
          <Route path="/reports/inventory-products" element={<InventoryProductsReport />} />
          <Route path="/reports/inventory-checks" element={<InventoryCheckReport />} />
          <Route
            path="/administrators"
            element={<ProtectedRoute allowedRoles={["ADMIN","SYSTEM ADMINISTRATOR"]}><Administrators /></ProtectedRoute>}
          />
          <Route path="/administrator" element={<Navigate to="/administrators" replace />} />
          <Route path="/administrator/settings" element={<Navigate to="/administrators/settings" replace />} />
          <Route path="/administrator/legal-pages" element={<Navigate to="/administrators/legal-pages" replace />} />
          <Route path="/administrator/legal-page" element={<Navigate to="/administrators/legal-pages" replace />} />
          <Route path="/administrator/rbac" element={<Navigate to="/administrators/rbac" replace />} />
          <Route path="/administrator/void-codes" element={<Navigate to="/administrators/void-codes" replace />} />
          <Route path="/administrators/company-information" element={<CompanyInformation />} />
          <Route path="/administrators/settings" element={<ManageSettings />} />
          <Route path="/administrators/legal-pages" element={<ManageLegalPages />} />
          <Route path="/administrators/legal-page" element={<Navigate to="/administrators/legal-pages" replace />} />
          <Route path="/administrators/company/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageCompany /></ProtectedRoute>} />
          <Route path="/administrators/company/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageCompany /></ProtectedRoute>} />
          <Route path="/administrators/user-accounts" element={<UserAccounts />} />
          <Route path="/administrators/user-accounts/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageUser /></ProtectedRoute>} />
          <Route path="/administrators/user-accounts/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageUser /></ProtectedRoute>} />
          <Route path="/administrators/user-roles" element={<UserRoles />} />
          <Route path="/administrators/user-roles/add" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageUserRoles /></ProtectedRoute>} />
          <Route path="/administrators/user-roles/:id" element={<ProtectedRoute allowedRoles={["ADMIN","STAFF","SYSTEM ADMINISTRATOR"]}><ManageUserRoles /></ProtectedRoute>} />
          <Route path="/administrators/rbac" element={<ProtectedRoute allowedRoles={["ADMIN","SYSTEM ADMINISTRATOR"]}><Rbac /></ProtectedRoute>} />
          <Route path="/administrators/camera-events" element={<ProtectedRoute allowedRoles={["ADMIN","SYSTEM ADMINISTRATOR"]}><CameraEventsModeGate><CameraEvents /></CameraEventsModeGate></ProtectedRoute>} />
          <Route path="/administrators/void-codes" element={<ProtectedRoute allowedRoles={["ADMIN","SYSTEM ADMINISTRATOR"]}><VoidCodes /></ProtectedRoute>} />
        </Route>
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
