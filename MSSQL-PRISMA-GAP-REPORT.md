# MSSQL to Prisma Gap Report

Generated: 2026-06-13

Source backup: `C:\PROJECT\RASE\sixram.nextgen.rapide\BASE_DB_CLEAN.bak`

Restored audit database: `SixramNextGenRapide_Audit` on `.\SQLEXPRESS`

Target schema file: `prisma/schema.prisma`

## Backup Restore Summary

The `.bak` file contains two full backup sets. The latest backup set was used for validation.

| Item | Value |
| --- | --- |
| Backup file | `C:\PROJECT\RASE\sixram.nextgen.rapide\BASE_DB_CLEAN.bak` |
| Backup set used | Position 2 |
| Source database name in backup | `RASE_DB_NEW` |
| Backup timestamp | 2026-06-13 21:03:36 |
| SQL Server instance | `.\SQLEXPRESS` |
| Restored database | `SixramNextGenRapide_Audit` |
| SQL Server version | SQL Server 2022 Express 16.0.4252.3 |
| Collation | `SQL_Latin1_General_CP1_CI_AS` |

The backup verified successfully before restore.

## Live Schema Inventory

| Item | Count |
| --- | ---: |
| User tables | 54 |
| Columns | 702 |
| Primary keys | 54 |
| Identity columns | 54 |
| Foreign keys | 101 |
| Indexes | 169 |
| Unique indexes excluding primary keys | 7 |
| Filtered unique indexes | 2 |
| Default constraints | 77 |
| Computed columns | 0 |

SQL Server column type distribution:

| SQL Server type | Column count |
| --- | ---: |
| `int` | 288 |
| `nvarchar` | 143 |
| `datetime` | 130 |
| `decimal` | 85 |
| `bit` | 54 |
| `date` | 1 |
| `datetimeoffset` | 1 |

## Prisma Comparison Result

After validating against the restored database and refining the Prisma draft:

| Check | Result |
| --- | --- |
| Live tables vs Prisma mapped tables | 54 of 54 matched |
| Live columns vs Prisma scalar fields | 702 of 702 matched |
| Missing Prisma tables | 0 |
| Extra Prisma tables | 0 |
| Missing Prisma fields | 0 |
| Extra Prisma fields | 0 |
| Scalar type/nullability/native type diffs | 0 |

Status: the Phase 1 Prisma scalar schema now matches the restored MSSQL backup for table names, column names, nullability, and native type intent.

## Prisma Updates Applied

Updated `prisma/schema.prisma` after inspecting the backup:

- Corrected 26 native type mappings from unbounded text to live `nvarchar(n)` equivalents, or vice versa where the live column is `nvarchar(max)`.
- Added `@@unique([ProductInventoryCheckId, ProductId], map: "UX_ProductInventoryCheckItems_Check_Product")`.
- Confirmed the live database uses plural table names for the previously ambiguous EF model areas: `Customers`, `Memberships`, `Parameters`, `Payments`, `QuickSales`, `Users`, and related reference tables.
- Re-ran `prisma format`, `npm run db:validate`, `npm run db:generate`, and `npm run typecheck` successfully.

## Remaining Gaps

### 1. Prisma Relations Are Not Final Yet

The restored database has 101 foreign keys. The current Phase 1 Prisma schema intentionally models scalar FK columns first and defers relation fields.

Relation generation is the next schema step.

Foreign key delete behavior summary:

| Delete behavior | Count |
| --- | ---: |
| `NO_ACTION` | 96 |
| `CASCADE` | 5 |

Cascade foreign keys that must be represented carefully in Prisma:

| Table | Foreign key | Delete behavior |
| --- | --- | --- |
| `ProductInventoryCheckItems` | `FK_ProductInventoryCheckItems_ProductInventoryChecks` | `CASCADE` |
| `ProductVehicleModels` | `FK_ProductVehicleModels_Products` | `CASCADE` |
| `ProductVehicleModels` | `FK_ProductVehicleModels_VehicleModels` | `CASCADE` |
| `RolePermissions` | `FK_RolePermissions_Permissions` | `CASCADE` |
| `RolePermissions` | `FK_RolePermissions_Roles` | `CASCADE` |

### 2. Filtered Unique Indexes Require Raw SQL Migrations

Prisma cannot fully express SQL Server filtered unique indexes as plain `@@unique` constraints. These should be added as PostgreSQL partial indexes in raw SQL migrations.

| Table | Index | SQL Server filter | PostgreSQL equivalent |
| --- | --- | --- | --- |
| `CompanyInfos` | `UX_CompanyInfos_PrimaryCompany` | `([IsPrimaryCompany]=(1))` | `WHERE "IsPrimaryCompany" = true` |
| `InspectionChecklistTemplates` | `UX_InspectionChecklistTemplates_Active` | `([IsActive]=(1))` | `WHERE "IsActive" = true` |

### 3. Default Constraints Need Review

The restored database has 77 default constraints. Some are safe to carry forward, but they should not all be copied blindly.

Important examples:

| Category | Examples | Recommendation |
| --- | --- | --- |
| Boolean defaults | many `IsChangan`, `IsRequired`, `IsAdditional`, `Allowed` fields | Represent in Prisma where inserts depend on DB defaults. |
| Numeric defaults | incentives, `LowStockThreshold`, created/updated by fields | Review with application insert behavior before adding. |
| Timestamp defaults | `getutcdate()` on camera/events/RBAC/inventory tables | Convert deliberately to PostgreSQL `now()` or application-created UTC timestamps. |
| Security-sensitive defaults | `Users.PinHash`, `Users.PinSalt` | Do not copy blindly. Confirm whether these are still required or legacy. |

### 4. PostgreSQL Collation and Case Sensitivity Need Testing

The SQL Server backup uses `SQL_Latin1_General_CP1_CI_AS`, which is case-insensitive and accent-sensitive. PostgreSQL string comparison behavior will differ unless handled through:

- application-side normalization,
- `citext`,
- functional indexes such as `lower("Email")`,
- or explicit case-insensitive query patterns.

Fields to review first:

- `Users.Email`
- `Permissions.Key`
- reference codes in `Parameters`, `ParameterGroups`, `Services`, `Packages`, and products.

### 5. Data Migration Requires Row-Level Reconciliation

The restored backup contains data, not just schema. Row-count validation should be part of the ETL dry run.

High-volume tables from the restored backup:

| Table | Rows |
| --- | ---: |
| `JobOrderProducts` | 6568 |
| `EstimateProducts` | 6474 |
| `EstimateServices` | 4826 |
| `JobOrderServices` | 4800 |
| `JobOrderTechnicians` | 2782 |
| `EstimateTechnicians` | 2757 |
| `JobOrderPackages` | 1721 |
| `EstimatePackages` | 1699 |
| `Vehicles` | 1376 |
| `Invoices` | 1356 |
| `Customers` | 1339 |
| `Payments` | 1338 |

Empty tables in this backup:

| Table | Rows |
| --- | ---: |
| `Memberships` | 0 |
| `ProductInventoryChecks` | 0 |
| `ProductInventoryCheckItems` | 0 |

## Live Row Counts

| Table | Rows |
| --- | ---: |
| `CameraEvents` | 15 |
| `CompanyInfos` | 2 |
| `Customers` | 1339 |
| `Deposits` | 4 |
| `EstimatePackages` | 1699 |
| `EstimateProducts` | 6474 |
| `Estimates` | 1502 |
| `EstimateServices` | 4826 |
| `EstimateTechnicians` | 2757 |
| `Expenses` | 116 |
| `InspectionChecklistTemplates` | 2 |
| `Inspections` | 726 |
| `InspectionTechnicians` | 1309 |
| `InvoicePackages` | 1517 |
| `Invoices` | 1356 |
| `JobOrderPackages` | 1721 |
| `JobOrderProducts` | 6568 |
| `JobOrders` | 1481 |
| `JobOrderServices` | 4800 |
| `JobOrderTechnicians` | 2782 |
| `JobStatuses` | 9 |
| `Manufacturers` | 42 |
| `Memberships` | 0 |
| `OperationAccessCodes` | 3 |
| `PackageProducts` | 210 |
| `Packages` | 84 |
| `PackageServices` | 181 |
| `ParameterGroups` | 9 |
| `Parameters` | 60 |
| `PaymentDetails` | 1381 |
| `Payments` | 1338 |
| `Permissions` | 66 |
| `PettyCash` | 38 |
| `ProductCategories` | 44 |
| `ProductGroups` | 75 |
| `ProductInventoryCheckItems` | 0 |
| `ProductInventoryChecks` | 0 |
| `ProductInventoryTransactions` | 6 |
| `Products` | 1366 |
| `ProductVehicleModels` | 16 |
| `QuickSales` | 301 |
| `QuickSalesProducts` | 890 |
| `RolePermissions` | 825 |
| `Roles` | 13 |
| `ServiceCategories` | 24 |
| `ServiceGroups` | 27 |
| `Services` | 613 |
| `Suppliers` | 21 |
| `UnitOfMeasures` | 10 |
| `UserRoles` | 34 |
| `Users` | 23 |
| `VehicleMakes` | 45 |
| `VehicleModels` | 204 |
| `Vehicles` | 1376 |

## Recommended Next Phase 1 Actions

1. Generate Prisma relation fields from the 101 restored MSSQL foreign keys.
2. Add raw SQL migration notes for the 2 PostgreSQL partial unique indexes.
3. Decide which of the 77 default constraints should become Prisma `@default` values.
4. Create a first dev-only PostgreSQL migration after relation fields and defaults are reviewed.
5. Run an ETL dry run from `SixramNextGenRapide_Audit` to PostgreSQL.
6. Reconcile row counts, FK integrity, decimal totals, and high-value business reports.

## Current Status

The restored MSSQL backup confirms that the Phase 1 Prisma scalar model is now aligned with the live schema. The project is ready for the relation/default review step, not yet for production migrations.
