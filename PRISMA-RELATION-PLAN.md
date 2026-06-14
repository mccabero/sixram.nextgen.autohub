# Prisma Relation Plan

Generated: 2026-06-13

Source database: `SixramNextGenRapide_Audit` restored from `C:\PROJECT\RASE\sixram.nextgen.rapide\BASE_DB_CLEAN.bak`

Target schema: `prisma/schema.prisma`

## Summary

Prisma relation fields have been generated from the restored MSSQL foreign key metadata.

| Item | Count |
| --- | ---: |
| Live MSSQL foreign key constraints | 101 |
| Unique FK relationships modeled in Prisma | 99 |
| Duplicate SQL constraints intentionally not modeled | 2 |
| Prisma `@relation` declarations added | 198 |
| Modeled cascade delete relations | 5 |
| Modeled no-action delete relations | 94 |

Validation result:

- `prisma format` passed.
- `npm run db:validate` passed.
- `npm run db:generate` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Relation Naming Strategy

The relation pass uses the live SQL Server foreign key names as Prisma relation names.

Child-side relation fields:

- Field name is derived from the FK column by removing the trailing `Id`.
- Example: `CustomerId` becomes `Customer`.
- Example: `PaymentTypeParameterId` becomes `PaymentTypeParameter`.
- Required or optional relation type follows the FK column nullability.

Parent-side collection fields:

- Field name pattern: `<ChildTable>As<ChildRelationField>`.
- Example: `Customers.DepositsAsCustomer`.
- Example: `Users.EstimatesAsAdvisorUser`.
- This avoids collisions where many tables reference `Users`, `Parameters`, `JobStatuses`, and other shared reference tables.

Constraint preservation:

- Child-side relations use `map: "<SQL Server FK name>"`.
- This lets future Prisma migrations keep SQL Server-style constraint names where practical.

Delete/update behavior:

- SQL Server `NO_ACTION` maps to Prisma `NoAction`.
- SQL Server `CASCADE` maps to Prisma `Cascade`.
- Update behavior is currently modeled as `NoAction`.

## Duplicate FK Constraints

Two MSSQL constraints duplicate the same child column and parent table relationship. Prisma should model one logical relation per scalar FK field, so these duplicate constraints were not represented as separate Prisma relations.

| Skipped constraint | Duplicate of | Child column | Parent |
| --- | --- | --- | --- |
| `FK_Estimate_QualityCheckUser` | `FK_Estimate_Approver` | `Estimates.ApproverUserId` | `Users.Id` |
| `FK_Inspection_ApproverUser` | `FK_Inspection_AdvisorUser` | `Inspections.AdvisorUserId` | `Users.Id` |

Important follow-up:

- `Inspections.ApproverUserId` exists as a scalar field, but the restored database does not enforce it as a foreign key.
- Before production migration, decide whether this is legacy drift or a real intended schema gap.
- Recommended target behavior is to add a proper `Inspections.ApproverUserId -> Users.Id` relation only if application behavior confirms that column should be enforced.

## Cascade Relations

These cascade behaviors are represented in Prisma and should be tested carefully during migration:

| Table | Foreign key | Delete behavior |
| --- | --- | --- |
| `ProductInventoryCheckItems` | `FK_ProductInventoryCheckItems_ProductInventoryChecks` | `Cascade` |
| `ProductVehicleModels` | `FK_ProductVehicleModels_Products` | `Cascade` |
| `ProductVehicleModels` | `FK_ProductVehicleModels_VehicleModels` | `Cascade` |
| `RolePermissions` | `FK_RolePermissions_Permissions` | `Cascade` |
| `RolePermissions` | `FK_RolePermissions_Roles` | `Cascade` |

## Highest-Reference Parent Models

The following parent models now have many back-relations and should be used carefully in Prisma queries to avoid accidental large includes:

| Parent model | Notes |
| --- | --- |
| `User` | Referenced by estimators, advisors, approvers, inspectors, technicians, salespeople, paid-by users, and RBAC tables. |
| `Parameter` | Referenced by payment types, vehicle attributes, and vehicle make/model metadata. |
| `Customer` | Referenced by vehicles, operations, payments, and memberships. |
| `JobStatus` | Referenced by operations, payments, expenses, deposits, quick sales, and petty cash. |
| `Product` | Referenced by packages, estimates, job orders, quick sales, inventory, and vehicle applicability. |
| `Package` | Referenced by package composition and operation package lines. |

Recommendation:

- Avoid broad `include` graphs by default.
- Define query-specific `select`/`include` objects per route handler.
- Add pagination for collection-heavy reads.

## FK Distribution By Child Table

| Child table | FK count |
| --- | ---: |
| `Estimates` | 8 |
| `Inspections` | 8 |
| `JobOrders` | 8 |
| `Vehicles` | 7 |
| `Products` | 5 |
| `Deposits` | 4 |
| `Invoices` | 4 |
| `QuickSales` | 4 |
| `Expenses` | 3 |
| `PaymentDetails` | 3 |
| `VehicleModels` | 3 |
| `EstimatePackages` | 2 |
| `EstimateProducts` | 2 |
| `EstimateServices` | 2 |
| `InspectionTechnicians` | 2 |
| `InvoicePackages` | 2 |
| `JobOrderPackages` | 2 |
| `JobOrderProducts` | 2 |
| `JobOrderServices` | 2 |
| `JobOrderTechnicians` | 2 |
| `PackageProducts` | 2 |
| `PackageServices` | 2 |
| `Payments` | 2 |
| `PettyCash` | 2 |
| `ProductInventoryCheckItems` | 2 |
| `ProductVehicleModels` | 2 |
| `QuickSalesProducts` | 2 |
| `RolePermissions` | 2 |
| `Services` | 2 |
| `UserRoles` | 2 |
| `EstimateTechnicians` | 1 |
| `Memberships` | 1 |
| `Parameters` | 1 |
| `ProductInventoryTransactions` | 1 |
| `Users` | 1 |
| `VehicleMakes` | 1 |

## Remaining Database Foundation Gaps

### Partial Unique Indexes

These still require raw PostgreSQL SQL migrations:

```sql
CREATE UNIQUE INDEX "UX_CompanyInfos_PrimaryCompany"
ON "CompanyInfos" ("IsPrimaryCompany")
WHERE "IsPrimaryCompany" = true;

CREATE UNIQUE INDEX "UX_InspectionChecklistTemplates_Active"
ON "InspectionChecklistTemplates" ("IsActive")
WHERE "IsActive" = true;
```

### Default Constraints

The restored MSSQL database has 77 default constraints. They were not all copied into Prisma during the relation pass.

Review defaults before the first PostgreSQL migration, especially:

- `getutcdate()` timestamp defaults.
- boolean defaults that application inserts rely on.
- incentive and numeric defaults.
- `Products.LowStockThreshold`.
- `Users.PinHash` and `Users.PinSalt`, which are security-sensitive.

### Case-Insensitive Behavior

The source collation is `SQL_Latin1_General_CP1_CI_AS`. PostgreSQL will not behave the same by default.

Review case-insensitive behavior for:

- `Users.Email`
- `Permissions.Key`
- `Parameters.Code`
- `ParameterGroups.Code`
- `Services.Code`
- `Packages.Code`
- product identifiers and reference numbers.

## Recommended Next Steps

1. Review the duplicate FK constraints and decide whether `Inspections.ApproverUserId` should become a real FK in PostgreSQL.
2. Review and approve which MSSQL default constraints should become Prisma `@default` values.
3. Add raw SQL migration files for the two partial unique indexes.
4. Create a dev PostgreSQL database or Neon dev branch.
5. Generate the first dev-only Prisma migration.
6. Run an MSSQL to PostgreSQL ETL dry run.
7. Reconcile row counts, FK integrity, decimal totals, and report-critical aggregates.

## Current Status

The Prisma schema now models the live scalar schema and the unique foreign key relationship graph from the restored MSSQL backup. It is ready for default/partial-index review before generating the first PostgreSQL migration.
