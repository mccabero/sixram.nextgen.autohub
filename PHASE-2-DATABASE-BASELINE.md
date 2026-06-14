# Phase 2A Database Baseline

Date: 2026-06-13

## Status

The PostgreSQL baseline has been generated from the Prisma schema, validated locally, and applied to the Neon development database.

## Files Created or Updated

- `prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20260613133000_init/migration.sql`

## Prisma Defaults Applied

These defaults were copied because they are low-risk SQL Server defaults and safe for new PostgreSQL inserts:

- `IsChangan @default(false)` on transaction/customer/vehicle modules.
- `IncentiveSA @default(0)` and `IncentiveTech @default(0)` on package, estimate, invoice, job order, and product lines.
- `Packages.NextServiceReminderDays @default(0)`.
- `PaymentDetails.IsFullyPaid @default(false)`.
- `PaymentDetails.IsDeposit @default(false)`.
- `Products.LowStockThreshold @default(5)`.
- `RolePermissions.Allowed @default(false)`.

## Defaults Intentionally Not Copied

These SQL Server defaults need application-level handling or explicit migration decisions:

- `Users.PinHash` and `Users.PinSalt` default values. These are security-sensitive and must not be reused for new users.
- Audit user defaults such as `CreatedById = 0` and `UpdatedById = 0`.
- Timestamp defaults such as `getutcdate()`.
- `OperationAccessCodes.GeneratedById`.

## PostgreSQL-Specific Additions

The migration includes raw SQL for SQL Server filtered unique index equivalents:

```sql
CREATE UNIQUE INDEX "UX_CompanyInfos_PrimaryCompany"
ON "CompanyInfos"("IsPrimaryCompany")
WHERE "IsPrimaryCompany" = true;

CREATE UNIQUE INDEX "UX_InspectionChecklistTemplates_Active"
ON "InspectionChecklistTemplates"("IsActive")
WHERE "IsActive" = true;
```

## Validation Completed

The following checks passed with a temporary local development `DATABASE_URL` supplied to Prisma commands before the Neon apply:

```powershell
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm run build
```

The following Neon checks passed after the database connection string was provided:

```powershell
npx prisma migrate deploy
npx prisma migrate status
```

Prisma reports the database schema is up to date.

## Neon Baseline Verification

The Neon development database now contains:

- 55 public base tables, including Prisma migration metadata.
- 710 public columns.
- 99 foreign keys.
- 70 indexes.
- 2 partial indexes:
  - `UX_CompanyInfos_PrimaryCompany`
  - `UX_InspectionChecklistTemplates_Active`

The connection string was used only for the apply and verification commands and was not committed to the repository.

## Next Phase 2 Task

Proceed to Phase 2B:

- Build the MSSQL-to-PostgreSQL ETL dry-run process.
- Load data from `SixramNextGenRapide_Audit`.
- Reconcile row counts, foreign keys, unique constraints, RBAC rows, and decimal totals.
- Produce `ETL-DRY-RUN-REPORT.md`.
