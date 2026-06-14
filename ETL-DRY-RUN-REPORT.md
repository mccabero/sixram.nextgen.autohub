# ETL Dry-Run Report

Date: 2026-06-13

## Scope

Phase 2B migrated data from the restored SQL Server backup into the Neon development PostgreSQL database.

- Source: `.\SQLEXPRESS`, database `SixramNextGenRapide_Audit`
- Target: Neon development PostgreSQL database
- Source tables: 54
- Source rows: 50,330
- Target app rows after load: 50,330

The Neon connection string was supplied through `DATABASE_URL` for commands only and was not committed to the repository.

## ETL Tooling Added

- `scripts/etl-mssql-to-postgres.mjs`
- `npm run etl:dry-run`
- `npm run etl:reconcile`

The ETL runner:

- Reads SQL Server through `sqlcmd`.
- Loads PostgreSQL through the existing `pg` dependency.
- Computes a dependency-safe table load order from SQL Server foreign keys.
- Preserves identity `Id` values.
- Converts SQL Server decimal values to strings before JSON transfer to avoid JavaScript number precision loss.
- Inserts in batches using parameterized PostgreSQL statements.
- Resets PostgreSQL identity sequences after each table load.
- Refuses to load into non-empty target app tables unless `--reset-target` is explicitly passed.

## Commands Run

```powershell
$env:DATABASE_URL = "<Neon development connection string>"
npm run etl:dry-run
npm run etl:reconcile
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

## Reconciliation Summary

| Check | Result |
| --- | ---: |
| Source rows | 50,330 |
| Target rows | 50,330 |
| Row-count mismatches | 0 |
| Decimal-sum mismatches | 0 |
| Target foreign keys | 99 |
| Target indexes | 70 |
| Target partial indexes | 2 |

The PostgreSQL foreign key count is expected to be 99 because two duplicate or miswired SQL Server foreign keys were intentionally not modeled as duplicate Prisma relations:

- `FK_Estimate_QualityCheckUser`
- `FK_Inspection_ApproverUser`

## RBAC Reconciliation

| Area | Count |
| --- | ---: |
| Roles | 13 |
| Permissions | 66 |
| RolePermissions | 825 |
| Allowed RolePermissions | 243 |
| Users | 23 |
| UserRoles | 34 |

## Decimal Checks

All sampled decimal totals matched between SQL Server and PostgreSQL:

- `Deposits.DepositAmount`
- `Estimates.TotalAmount`
- `Expenses.Amount`
- `Invoices.TotalAmount`
- `JobOrders.TotalAmount`
- `PaymentDetails.AmountPaid`
- `Payments.TotalPaidAmount`
- `PettyCash.Balance`
- `Products.SellingPrice`
- `QuickSales.TotalAmount`

## Table Counts

| Table | SQL Server | PostgreSQL |
| --- | ---: | ---: |
| CameraEvents | 15 | 15 |
| CompanyInfos | 2 | 2 |
| Customers | 1,339 | 1,339 |
| Deposits | 4 | 4 |
| EstimatePackages | 1,699 | 1,699 |
| EstimateProducts | 6,474 | 6,474 |
| EstimateServices | 4,826 | 4,826 |
| EstimateTechnicians | 2,757 | 2,757 |
| Estimates | 1,502 | 1,502 |
| Expenses | 116 | 116 |
| InspectionChecklistTemplates | 2 | 2 |
| InspectionTechnicians | 1,309 | 1,309 |
| Inspections | 726 | 726 |
| InvoicePackages | 1,517 | 1,517 |
| Invoices | 1,356 | 1,356 |
| JobOrderPackages | 1,721 | 1,721 |
| JobOrderProducts | 6,568 | 6,568 |
| JobOrderServices | 4,800 | 4,800 |
| JobOrderTechnicians | 2,782 | 2,782 |
| JobOrders | 1,481 | 1,481 |
| JobStatuses | 9 | 9 |
| Manufacturers | 42 | 42 |
| Memberships | 0 | 0 |
| OperationAccessCodes | 3 | 3 |
| PackageProducts | 210 | 210 |
| PackageServices | 181 | 181 |
| Packages | 84 | 84 |
| ParameterGroups | 9 | 9 |
| Parameters | 60 | 60 |
| PaymentDetails | 1,381 | 1,381 |
| Payments | 1,338 | 1,338 |
| Permissions | 66 | 66 |
| PettyCash | 38 | 38 |
| ProductCategories | 44 | 44 |
| ProductGroups | 75 | 75 |
| ProductInventoryCheckItems | 0 | 0 |
| ProductInventoryChecks | 0 | 0 |
| ProductInventoryTransactions | 6 | 6 |
| ProductVehicleModels | 16 | 16 |
| Products | 1,366 | 1,366 |
| QuickSales | 301 | 301 |
| QuickSalesProducts | 890 | 890 |
| RolePermissions | 825 | 825 |
| Roles | 13 | 13 |
| ServiceCategories | 24 | 24 |
| ServiceGroups | 27 | 27 |
| Services | 613 | 613 |
| Suppliers | 21 | 21 |
| UnitOfMeasures | 10 | 10 |
| UserRoles | 34 | 34 |
| Users | 23 | 23 |
| VehicleMakes | 45 | 45 |
| VehicleModels | 204 | 204 |
| Vehicles | 1,376 | 1,376 |

## Validation Results

The following checks passed after the ETL load:

- `npm run etl:reconcile`
- `npm run db:validate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Notes and Risks

- The dry run used the Neon development database only.
- Production cutover still needs a separate backup, freeze window, final restore/export, and rollback plan.
- `Users.PinHash` and `Users.PinSalt` values were preserved from SQL Server, but the SQL Server default PIN hash/salt must not be used for newly created users.
- `Inspections.ApproverUserId` remains a schema decision point because the restored SQL Server database did not enforce it as a distinct FK.
- The PostgreSQL client emitted an SSL warning for the connection string mode. Before production, confirm the final Neon connection string uses the preferred SSL settings for the selected driver version.
- File-backed data such as uploads, inspection photos, camera snapshots, reports, and login assets still needs a storage migration plan.

## Phase 2B Status

Phase 2B is complete for the development dry run.

Recommended next task: proceed to Phase 2C, the authentication and RBAC foundation.
