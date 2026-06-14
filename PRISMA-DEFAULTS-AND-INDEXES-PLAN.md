# Prisma Defaults and Indexes Plan

Generated: 2026-06-13

Source database: `SixramNextGenRapide_Audit` restored from `C:\PROJECT\RASE\sixram.nextgen.rapide\BASE_DB_CLEAN.bak`

Target schema: `prisma/schema.prisma`

## Summary

The restored MSSQL database has:

| Item | Count |
| --- | ---: |
| Default constraints | 77 |
| Primary keys | 54 |
| Unique indexes excluding primary keys | 7 |
| Filtered unique indexes | 2 |
| Computed columns | 0 |

The Prisma schema already includes the primary keys, ordinary unique constraints discovered so far, scalar fields, and relation graph. The remaining index/default work is about migration fidelity and application behavior.

## Recommendation

Do not blindly copy all MSSQL defaults into Prisma.

Use this split:

1. Add low-risk business defaults to Prisma `@default`.
2. Convert SQL Server `getutcdate()` defaults deliberately to Prisma `@default(now())` only for tables where database-side defaulting is still desired.
3. Do not copy `Users.PinHash` and `Users.PinSalt` defaults without a security decision.
4. Add the two filtered unique indexes through raw PostgreSQL SQL migrations.

## Current Prisma Default Coverage

The current schema already includes key defaults for:

- all `Id` primary keys with `@default(autoincrement())`,
- `CompanyInfos.IsPrimaryCompany`,
- `EstimatePackages.IsAdditional`,
- `EstimateProducts.IsRequired`,
- `EstimateProducts.IsAdditional`,
- `EstimateServices.IsRequired`,
- `EstimateServices.IsAdditional`,
- `InspectionChecklistTemplates.Revision`,
- `InspectionChecklistTemplates.IsActive`,
- `JobOrderPackages.IsAdditional`,
- `JobOrderProducts.IsRequired`,
- `JobOrderProducts.IsAdditional`,
- `JobOrderServices.IsRequired`,
- `JobOrderServices.IsAdditional`,
- `Products.IsQuickSalesProduct`.

## Defaults Recommended For Prisma

These defaults are safe parity candidates because they represent ordinary boolean or numeric business defaults.

| Table | Column | MSSQL default | Prisma default |
| --- | --- | --- | --- |
| `Customers` | `IsChangan` | `0` | `@default(false)` |
| `Deposits` | `IsChangan` | `0` | `@default(false)` |
| `Estimates` | `IsChangan` | `0` | `@default(false)` |
| `Expenses` | `IsChangan` | `0` | `@default(false)` |
| `Inspections` | `IsChangan` | `0` | `@default(false)` |
| `Invoices` | `IsChangan` | `0` | `@default(false)` |
| `JobOrders` | `IsChangan` | `0` | `@default(false)` |
| `Payments` | `IsChangan` | `0` | `@default(false)` |
| `PettyCash` | `IsChangan` | `0` | `@default(false)` |
| `QuickSales` | `IsChangan` | `0` | `@default(false)` |
| `Vehicles` | `IsChangan` | `0` | `@default(false)` |
| `EstimatePackages` | `IncentiveSA` | `0` | `@default(0)` |
| `EstimatePackages` | `IncentiveTech` | `0` | `@default(0)` |
| `EstimateProducts` | `IncentiveSA` | `0` | `@default(0)` |
| `EstimateProducts` | `IncentiveTech` | `0` | `@default(0)` |
| `InvoicePackages` | `IncentiveSA` | `0` | `@default(0)` |
| `InvoicePackages` | `IncentiveTech` | `0` | `@default(0)` |
| `JobOrderPackages` | `IncentiveSA` | `0` | `@default(0)` |
| `JobOrderPackages` | `IncentiveTech` | `0` | `@default(0)` |
| `JobOrderProducts` | `IncentiveSA` | `0` | `@default(0)` |
| `JobOrderProducts` | `IncentiveTech` | `0` | `@default(0)` |
| `Packages` | `NextServiceReminderDays` | `0` | `@default(0)` |
| `Packages` | `IncentiveSA` | `0` | `@default(0)` |
| `Packages` | `IncentiveTech` | `0` | `@default(0)` |
| `PaymentDetails` | `IsFullyPaid` | `0` | `@default(false)` |
| `PaymentDetails` | `IsDeposit` | `0` | `@default(false)` |
| `Products` | `IncentiveSA` | `0` | `@default(0)` |
| `Products` | `IncentiveTech` | `0` | `@default(0)` |
| `Products` | `LowStockThreshold` | `5` | `@default(5)` |
| `RolePermissions` | `Allowed` | `0` | `@default(false)` |

## Defaults Requiring Review

These are system/audit defaults. They may be useful for seed scripts and infrastructure-managed writes, but they can also hide bugs if route handlers forget to set audit fields.

| Table | Columns | MSSQL default | Recommendation |
| --- | --- | --- | --- |
| `InspectionChecklistTemplates` | `CreatedById`, `UpdatedById` | `0` | Consider `@default(0)` only if system-generated records will keep using user id `0`. |
| `Permissions` | `CreatedById`, `UpdatedById` | `0` | Reasonable for RBAC seed data, but seed scripts can also set these explicitly. |
| `ProductInventoryCheckItems` | `CreatedById`, `UpdatedById` | `0` | Prefer explicit app values unless inventory reconciliation can be system-generated. |
| `ProductInventoryChecks` | `CreatedById`, `UpdatedById` | `0` | Prefer explicit app values unless checks can be system-generated. |
| `ProductInventoryTransactions` | `CreatedById`, `UpdatedById` | `0` | Prefer explicit app values for audit integrity. |
| `ProductVehicleModels` | `CreatedById`, `UpdatedById` | `0` | Acceptable for seed/import records, but explicit values are cleaner. |
| `RolePermissions` | `CreatedById`, `UpdatedById` | `0` | Reasonable for RBAC seed data. |
| `OperationAccessCodes` | `GeneratedById` | `0` | Review carefully. Generated codes should usually record the real generator user id. |

Recommended policy:

- For seed-only tables, either use explicit values in seed scripts or add `@default(0)`.
- For user-facing transactional tables, avoid `@default(0)` on audit fields unless legacy behavior requires it.

## Timestamp Defaults

MSSQL uses `getutcdate()` on these timestamp fields:

| Table | Columns |
| --- | --- |
| `CameraEvents` | `CreatedDateTime` |
| `InspectionChecklistTemplates` | `CreatedDateTime`, `UpdatedDateTime` |
| `OperationAccessCodes` | `GeneratedDateTime` |
| `Permissions` | `CreatedDateTime`, `UpdatedDateTime` |
| `ProductInventoryCheckItems` | `CreatedDateTime`, `UpdatedDateTime` |
| `ProductInventoryChecks` | `CreatedDateTime`, `UpdatedDateTime` |
| `ProductInventoryTransactions` | `CreatedDateTime`, `UpdatedDateTime` |
| `ProductVehicleModels` | `CreatedDateTime`, `UpdatedDateTime` |
| `RolePermissions` | `CreatedDateTime`, `UpdatedDateTime` |

Prisma options:

| Target behavior | Prisma approach | Notes |
| --- | --- | --- |
| Database sets timestamp when omitted | `@default(now())` | Closest Prisma-native equivalent. PostgreSQL `now()` is transaction time. |
| App always sets timestamps explicitly | no Prisma default | Best for audit clarity and deterministic ETL. |
| Auto-update on every Prisma update | `@updatedAt` | Not equivalent to current SQL Server defaults; only use if the app wants new behavior. |

Recommendation:

- Use `@default(now())` for created/generated timestamps on infrastructure tables where omission is valid.
- Do not add `@updatedAt` during parity migration unless explicitly approved.
- Keep transaction/business dates app-owned.

## Security-Sensitive Defaults

The restored database has these user defaults:

| Table | Column | MSSQL default |
| --- | --- | --- |
| `Users` | `PinHash` | default base64 hash value |
| `Users` | `PinSalt` | default base64 salt value |

Recommendation:

- Do not copy these defaults into Prisma.
- During data migration, preserve existing user values from MSSQL.
- During new user creation, require explicit PIN initialization/reset behavior.
- Review whether these defaults represent a legacy shared PIN state and whether affected users should be forced through PIN reset.

## Filtered Unique Indexes

MSSQL filtered indexes:

| Table | Index | Filter |
| --- | --- | --- |
| `CompanyInfos` | `UX_CompanyInfos_PrimaryCompany` | `([IsPrimaryCompany]=(1))` |
| `InspectionChecklistTemplates` | `UX_InspectionChecklistTemplates_Active` | `([IsActive]=(1))` |

These should be created in PostgreSQL using raw SQL migrations:

```sql
CREATE UNIQUE INDEX "UX_CompanyInfos_PrimaryCompany"
ON "CompanyInfos" ("IsPrimaryCompany")
WHERE "IsPrimaryCompany" = true;

CREATE UNIQUE INDEX "UX_InspectionChecklistTemplates_Active"
ON "InspectionChecklistTemplates" ("IsActive")
WHERE "IsActive" = true;
```

Do not add these as ordinary Prisma `@@unique` constraints. An ordinary unique constraint on a boolean column would allow at most one `false` row, which is not the desired behavior.

## Ordinary Unique Indexes

These ordinary unique indexes are Prisma-compatible and should remain in `schema.prisma`:

| Table | Index | Columns |
| --- | --- | --- |
| `Permissions` | `UX_Permissions_Key` | `Key` |
| `ProductInventoryCheckItems` | `UX_ProductInventoryCheckItems_Check_Product` | `ProductInventoryCheckId`, `ProductId` |
| `ProductInventoryChecks` | `UX_ProductInventoryChecks_CheckType_CheckDate` | `CheckType`, `CheckDate` |
| `ProductVehicleModels` | `UX_ProductVehicleModels_ProductId_VehicleModelId` | `ProductId`, `VehicleModelId` |
| `RolePermissions` | `UX_RolePermissions_RoleId_PermissionId` | `RoleId`, `PermissionId` |

## Recommended Schema Update Pass

Before the first dev PostgreSQL migration, update `prisma/schema.prisma` with these approved changes:

1. Add low-risk `@default(false)` values for `IsChangan`, `PaymentDetails.IsFullyPaid`, `PaymentDetails.IsDeposit`, and `RolePermissions.Allowed`.
2. Add low-risk `@default(0)` values for incentive decimal fields and `Packages.NextServiceReminderDays`.
3. Add `Products.LowStockThreshold @default(5)`.
4. Decide whether seed/runtime audit defaults should use `@default(0)` or explicit seed values.
5. Decide which `getutcdate()` fields should become `@default(now())`.
6. Do not add defaults for `Users.PinHash` and `Users.PinSalt`.
7. Add raw SQL migration statements for the two partial unique indexes.

## Migration File Strategy

Recommended sequence:

1. Update Prisma defaults after approval.
2. Run `npx prisma format`.
3. Run `npm run db:validate`.
4. Create the first dev migration.
5. Edit the generated migration SQL to add the two PostgreSQL partial unique indexes.
6. Apply to a dev PostgreSQL database only.
7. Run an MSSQL to PostgreSQL ETL dry run.

## Phase 1 Closeout Decision

Phase 1 can be considered complete after:

- this plan is reviewed,
- Prisma default decisions are approved,
- the two partial-index raw SQL statements are accepted,
- and the first dev migration target is chosen.

No production migration should be generated until the dev migration and ETL dry run pass reconciliation.
