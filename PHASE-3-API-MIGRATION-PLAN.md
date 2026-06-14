# Phase 3 API Migration Plan

Date: 2026-06-13

## Status

Phase 3 is open.

Phase 1 and Phase 2 established the Next.js, Prisma, PostgreSQL, ETL, auth, and RBAC foundation. Phase 3 migrates the .NET Web API surface to Next.js App Router Route Handlers.

## Source API Inventory

Source project:

```text
C:\PROJECT\RASE\sixram.nextgen.rapide\Core\sixram.nextgen\src\sixram.nextgen.api
```

Controller inventory:

| Controller | Endpoints | Lines | Phase 3 Complexity |
| --- | ---: | ---: | --- |
| `OperationsController` | 92 | 7,929 | Very high |
| `ConfigurationController` | 59 | 749 | Medium |
| `ManagementController` | 40 | 2,095 | High |
| `LoginSettingsController` | 8 | 266 | Medium |
| `UsersController` | 8 | 113 | Medium |
| `HikvisionCameraController` | 8 | 694 | High |
| `VehiclesController` | 8 | 97 | Medium |
| `CustomersController` | 7 | 89 | Low-medium |
| `CompanyInfosController` | 7 | 253 | Medium |
| `ServiceCategoriesController` | 5 | 73 | Low |
| `RolesController` | 5 | 177 | Medium |
| `RbacController` | 5 | 305 | Medium |
| `AuthController` | 3 | 120 | Done in Phase 2C |
| `VoidCodesController` | 2 | 55 | Medium |
| `ChatController` | 1 | 226 | Medium |

Current migrated endpoints:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/validate`
- `POST /api/auth/forgot-pin`

## API Compatibility Rules

Phase 3 should preserve legacy client compatibility first, then improve internals.

- Keep existing route paths unless the frontend is migrated in the same change.
- Return legacy response shapes for migrated endpoints, not the newer `{ data }` wrapper, unless the old endpoint already returned that shape.
- Use Next.js `runtime = "nodejs"` for handlers that use Prisma, crypto, file IO, reports, or external SDKs.
- Use `authorizeApiRequest` for protected endpoints.
- Keep the public API exceptions from the .NET middleware:
  - `POST /api/auth/login`
  - `POST /api/auth/forgot-pin`
  - `GET /api/companyinfo*`
  - `GET /api/login-settings*`
  - public inspection photo GET routes
- Preserve SQL Server collation behavior by using case-insensitive matching where old searches depended on it.
- Convert Prisma Decimal values before returning JSON. Do not leak Decimal object internals.
- Parse and validate request bodies with Zod or narrow route-specific validators.
- Use transactions for multi-table operations, especially operations, invoices, payments, inventory, RBAC saves, and PIN/password changes.
- Keep audit columns explicit:
  - `CreatedById`
  - `CreatedDateTime`
  - `UpdatedById`
  - `UpdatedDateTime`

## Shared API Utilities To Add First

Before broad module work, add a small Route Handler support layer:

| Utility | Purpose |
| --- | --- |
| `src/server/api/legacy-json.ts` | Legacy response helpers, JSON serialization, Decimal/date cleanup |
| `src/server/api/params.ts` | Safe route/query parsing helpers |
| `src/server/api/audit.ts` | Current user/audit field helpers |
| `src/server/api/crud.ts` | Thin shared CRUD helpers for reference tables only |
| `src/server/api/errors.ts` | Consistent `400`, `401`, `403`, `404`, `409`, `500` legacy error shape |

Do not over-generalize operations modules. Shared CRUD should be limited to simple reference/configuration tables.

## Recommended Migration Waves

### Wave 0: API Harness

Goal: make future endpoint ports fast and consistent.

Scope:

- Add shared legacy JSON serialization.
- Add route parameter/query parsing helpers.
- Add API error helper.
- Add audit helper.
- Add a tiny smoke-test strategy for handlers.

Exit criteria:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- One DB-backed handler smoke test pattern documented.

### Wave 1: Public Shell and RBAC/Admin Core

Goal: make the login shell and post-login permission checks work against Next.js.

Endpoints:

- `GET /api/companyinfo`
- `GET /api/companyinfo/{id}`
- `GET /api/companyinfo/{companyId}/logo`
- `GET /api/login-settings`
- `GET /api/login-settings/background`
- `GET /api/login-settings/logo`
- `GET /api/rbac`
- `POST /api/rbac/save`
- `GET /api/rbac/effective-permissions`
- `GET /api/rbac/page-access`
- `GET /api/roles`
- `GET /api/roles/{id}`

Notes:

- File-backed login/company assets should be read-only first.
- Mutating asset endpoints should wait for the storage decision.
- RBAC save must be transactional.

### Wave 2: Configuration Reference Data

Goal: migrate the low-risk reference tables used by nearly every screen.

Endpoints under `api/config`:

- Service categories
- Service groups
- Vehicle makes
- Vehicle models
- Product groups
- Product categories
- Parameter groups
- Parameters
- Unit of measures
- Job statuses
- Inspection templates
- Active inspection template
- Vehicle model applicable products

Notes:

- This is the best first full implementation wave after the API harness.
- Most endpoints are CRUD wrappers over single tables.
- Inspection template activation must preserve the partial unique index rule: only one active template.

### Wave 3: Customers and Vehicles

Goal: unlock core master-data workflows used by operations.

Endpoints:

- `api/customers`
- `api/customers/summary`
- `api/customers/{id}`
- `api/customers/by-email`
- `api/vehicles`
- `api/vehicles/summary`
- `api/vehicles/{id}`
- `api/vehicles/by-plate`
- `api/vehicles/by-customer/{customerId}`

Notes:

- Support both observed casing patterns if the old frontend remains in use:
  - `/api/vehicles`
  - `/api/Vehicles`
- Use case-insensitive duplicate checks where SQL Server collation did.

### Wave 4: Management and Inventory

Goal: migrate products, packages, services, suppliers, manufacturers, and inventory views.

Endpoints:

- `api/management/packages`
- `api/management/services`
- `api/management/products`
- `api/management/suppliers`
- `api/management/manufacturers`
- `api/management/inventory`
- inventory check and transaction endpoints
- inventory report endpoints that return JSON

Notes:

- Package/product/service updates are multi-table.
- Inventory updates must use transactions.
- Report PDF generation should stay out of this wave unless a report library is selected.

### Wave 5: Users, Roles, Void Codes, and Admin Mutations

Goal: complete administrative workflows that modify security-sensitive data.

Endpoints:

- `api/users`
- `api/users/{id}`
- `api/users/by-email`
- `api/users/pin-availability`
- `api/users/change-password-by-email`
- `api/roles`
- `api/roles/{id}`
- `api/administrators/void-codes`

Notes:

- Reuse Phase 2C PBKDF2 helpers.
- Never return `PasswordHash`, `Salt`, `PinHash`, or `PinSalt`.
- Void code generation uses hashed codes and must remain time-bound.

### Wave 6: Operations Core

Goal: migrate high-value operational workflows.

Recommended order:

1. Inspection read/summary/next-reference.
2. Inspection create/update/delete.
3. Estimate read/summary/next-reference.
4. Estimate create/update/delete.
5. Job order read/summary/by-service/by-product.
6. Job order create/update/complete/unlock/delete.
7. Invoice read/summary/next-reference/proceed-to-payment.
8. Payment read/summary/next-reference/create/update/delete.
9. Deposits.
10. Quick sales.
11. Expenses.
12. Petty cash vouchers.
13. Void routes.

Notes:

- This wave needs the most QA.
- Use Prisma transactions for every create/update that touches child rows.
- Reconcile generated reference numbers with legacy behavior.
- Defer PDF/report printing until the report strategy is chosen.

### Wave 7: Reports, Files, Hikvision, and Chat

Goal: migrate integration-heavy endpoints after core data paths are stable.

Endpoints:

- Report print endpoints.
- Inspection photos.
- Company logo upload.
- Login asset upload.
- Hikvision alarm/events/snapshot/settings.
- Chat messages.

Notes:

- Decide object storage before file upload endpoints:
  - Vercel Blob
  - S3
  - Cloudflare R2
  - Azure Blob
- Hikvision local network callbacks may require a gateway service, not only Vercel Route Handlers.
- Report generation needs a Node-compatible PDF strategy replacing QuestPDF.
- Chat should use environment-managed OpenAI configuration only.

## First Implementation Batch

Recommended first coding batch:

1. Wave 0 API harness.
2. Read-only public shell endpoints:
   - `GET /api/companyinfo`
   - `GET /api/companyinfo/{id}`
   - `GET /api/login-settings`
3. RBAC read endpoints:
   - `GET /api/rbac/effective-permissions`
   - `GET /api/rbac/page-access`

Why this batch:

- It exercises public + authenticated route behavior.
- It supports the login shell and protected page bootstrapping.
- It avoids file upload/storage decisions.
- It gives PIXEL a stable target for future frontend migration.

## FORGE Tasks

- Add shared API harness utilities.
- Port first implementation batch.
- Preserve legacy response contracts.
- Use Prisma transactions for any multi-row writes.
- Run build and DB-backed smoke tests.

## PIXEL Tasks

- Do not start broad UI migration yet.
- Verify current frontend call patterns and casing.
- Identify endpoints that can be consumed unchanged.
- Document any frontend changes required after Wave 1.

## AEGIS Tasks

- Review route authorization coverage.
- Confirm public endpoint exceptions are intentional.
- Check no credential hashes are returned.
- Add acceptance criteria per module wave.
- Verify RBAC behavior for allowed/denied users.

## ATLAS Tasks

- Keep Neon dev database separate from production.
- Define Vercel env vars for Phase 3 routes.
- Choose storage provider before file-upload endpoints.
- Create deployment/rollback checklist before Wave 6.

## Validation Gate Per Wave

Every Phase 3 wave must pass:

```powershell
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

For DB-backed waves, also run at least one smoke test against the migrated Neon development data.

## Open Decisions

- Final object storage provider.
- PDF/report generation library.
- Whether to maintain uppercase route compatibility for `/api/Vehicles` long-term or migrate callers to lowercase.
- Whether to add a global Next middleware for RBAC after enough APIs are migrated, or continue per-route guards.
- How to host Hikvision callbacks if the camera cannot reach Vercel directly.

## Phase 3 Exit Criteria

Phase 3 is complete when:

- All selected .NET Web API endpoints are migrated or explicitly deprecated.
- Legacy frontend can run against Next Route Handlers for migrated modules.
- RBAC is enforced on protected APIs.
- Data writes are transaction-safe.
- Build/lint/typecheck pass.
- Smoke tests pass against Neon dev data.
- External integration gaps are either implemented or documented for a later phase.
