# Migration Assessment: sixram.nextgen.rapide

Generated: 2026-06-13

Source project: `C:\PROJECT\RASE\sixram.nextgen.rapide`

Target stack: Next.js App Router, Route Handlers, Prisma ORM, PostgreSQL

Assessment scope: static analysis of the source solution, EF Core mappings, controllers, services, runtime schema initializers, SQL sync scripts, and the existing React/Vite frontend. No target application code or schema code is generated in this document.

## Executive Summary

The current system is a .NET 8 Web API backed by SQL Server, with a separate React/Vite frontend. The backend is organized around controllers, EF Core repositories/services, JWT authentication, RBAC middleware, runtime schema initializers, QuestPDF reporting, local file storage, OpenAI chat integration, and Hikvision camera event ingestion.

The migration to Next.js App Router, Route Handlers, Prisma, and PostgreSQL is feasible but should be treated as a staged platform migration, not a simple framework rewrite. The largest risks are data model conversion, the 256 existing API endpoints, operations/payment workflows, inventory accounting logic, PDF report parity, RBAC parity, SQL Server-specific raw SQL, and local file storage assumptions.

Recommended strategy:

1. Preserve current `/api/...` route contracts at first using Next.js Route Handlers.
2. Convert the SQL Server schema into an explicit Prisma/PostgreSQL schema before feature rewrites.
3. Migrate authentication and RBAC early because almost every module depends on it.
4. Migrate reference/configuration modules before transactional modules.
5. Migrate the operations chain in business order: inspections, estimates, job orders, invoices, payments, reports.
6. Replace local uploads with object storage before migrating file-heavy modules.
7. Run repeated SQL Server to PostgreSQL data dry-runs before cutover.

## Assessment Basis

Inspected source areas:

- `.NET 8` solution under `Core\sixram.nextgen`
- Projects: `sixram.nextgen.api`, `sixram.nextgen.application`, `sixram.nextgen.domain`, `sixram.nextgen.infrastructure`
- EF Core `SixramNextGenDbContext`, scaffolded entities, partial mappings, runtime schema initializers
- SQL Server sync scripts under `scripts\db-schema-sync`
- API controllers under `sixram.nextgen.api\Controllers`
- Application services, middleware, repositories, and PDF report classes
- Existing React/Vite frontend route map and API client behavior

Important limitation:

- This assessment does not connect to a live SQL Server instance or restore `BASE_DB_CLEAN.bak`. Counts and findings are based on source code and scripts.
- Secrets were not copied into this document. Only configuration key names are referenced.

## 1. Database Inventory

### Summary

| Item | Count / Finding |
| --- | ---: |
| Scaffolded EF entities | 52 |
| Additional runtime-managed entities | 2 |
| Known tables/entities | 54 |
| Scaffolded scalar properties | 680 |
| Explicit scaffolded FK constraints | 66 |
| SQL sync script batch separators | 955 `GO` statements |
| Stored procedures/functions/views/triggers found in source scripts | 0 |

Additional runtime-managed entities:

- `InspectionChecklistTemplate`
- `OperationAccessCode`

### Database Domains

| Domain | Tables / entities | Migration notes |
| --- | --- | --- |
| Identity and RBAC | `Users`, `Roles`, `UserRoles`, `Permissions`, `RolePermissions`, `OperationAccessCodes` | Must migrate early. RBAC middleware and page permissions are central to access control. |
| Customer and vehicle | `Customers`, `Vehicles`, `VehicleMakes`, `VehicleModels`, `Membership` | Medium complexity. Used by most operations workflows. |
| Configuration/reference data | `Parameters`, `ParameterGroups`, `JobStatuses`, `ServiceCategories`, `ServiceGroups`, `ProductGroups`, `ProductCategories`, `UnitOfMeasures`, `Manufacturers`, `Suppliers` | Should be migrated before transactional modules. |
| Management/catalog | `Products`, `Services`, `Packages`, `PackageProducts`, `PackageServices`, `ProductVehicleModels` | Product applicability and inventory links increase complexity. |
| Inventory | `ProductInventoryTransactions`, `ProductInventoryChecks`, `ProductInventoryCheckItems` | High complexity because accounting logic, reconciliations, and reporting depend on it. |
| Operations | `Inspections`, `Estimates`, `JobOrders`, `Invoices`, `Deposits`, `Payments`, `QuickSales`, `Expenses`, `PettyCash`, and line-item/technician/package join tables | Highest business complexity. Migrate in workflow order. |
| Company and settings | `CompanyInfos`, plus file-backed login settings | Database plus object storage migration needed. |
| Camera/events | `CameraEvents` | Includes raw XML, snapshot metadata, and local file paths. |

### Detailed Table Inventory

| Entity / table | Columns | Area | Migration notes |
| --- | ---: | --- | --- |
| `CameraEvent` | 20 | Camera/events | Preserve raw XML/text; move snapshots to object storage. |
| `CompanyInfo` | 20 | Company/settings | Primary-company partial unique index must be recreated in PostgreSQL. |
| `Customer` | 24 | Customer | Core foreign-key target for operations. |
| `Deposit` | 19 | Payments | Depends on customer, job order, job status, payment type. |
| `Estimate` | 30 | Operations | Complex parent aggregate with products, services, packages, technicians. |
| `EstimatePackage` | 10 | Operations | Join/detail table. |
| `EstimateProduct` | 16 | Operations | Line-item pricing and quantity semantics must be preserved. |
| `EstimateService` | 14 | Operations | Line-item pricing and service relationships. |
| `EstimateTechnician` | 7 | Operations | User relationship. |
| `Expense` | 17 | Finance | Payment type, user, job status references. |
| `Inspection` | 22 | Operations | Includes photos/checklist/report flows. |
| `InspectionTechnician` | 7 | Operations | User relationship. |
| `InspectionChecklistTemplate` | 10 | Operations/configuration | Runtime-created table; active-template partial unique index. |
| `Invoice` | 22 | Operations/finance | Depends on job orders and report generation. |
| `InvoicePackage` | 9 | Operations/finance | Invoice detail relationship. |
| `JobOrder` | 30 | Operations | Central workflow entity; many reports and status transitions depend on it. |
| `JobOrderPackage` | 10 | Operations | Join/detail table. |
| `JobOrderProduct` | 16 | Operations/inventory | Can affect product inventory. |
| `JobOrderService` | 14 | Operations | Service line items. |
| `JobOrderTechnician` | 7 | Operations | User relationship. |
| `JobStatus` | 7 | Configuration | Workflow status reference. |
| `Manufacturer` | 7 | Management | Product reference data. |
| `Membership` | 11 | Customer | Singular table naming should be normalized deliberately in Prisma. |
| `OperationAccessCode` | 12 | Security/operations | Sensitive. Review plaintext `CodeValue` retention before migration. |
| `Package` | 18 | Management/catalog | Package composition via product/service join tables. |
| `PackageProduct` | 10 | Management/catalog | Join/detail table. |
| `PackageService` | 10 | Management/catalog | Join/detail table. |
| `Parameter` | 12 | Configuration | Generic reference value table. |
| `ParameterGroup` | 8 | Configuration | Generic reference group table. |
| `Payment` | 18 | Payments | Accounts receivable and reports depend on it. |
| `PaymentDetail` | 13 | Payments | Payment split/details. |
| `Permission` | 8 | RBAC | Seed logic currently uses SQL Server `MERGE`. |
| `PettyCash` | 16 | Finance | Singular table mapping exists in current EF model. |
| `Product` | 23 | Management/inventory | Inventory and applicability dependencies. |
| `ProductCategory` | 7 | Configuration | Product reference data. |
| `ProductGroup` | 7 | Configuration | Product reference data. |
| `ProductInventoryCheck` | 8 | Inventory | Unique check-type/date index. |
| `ProductInventoryCheckItem` | 11 | Inventory | Reconciliation details. |
| `ProductInventoryTransaction` | 11 | Inventory | Transaction history and audit reports. |
| `ProductVehicleModel` | 7 | Product applicability | Unique product/model pair index. |
| `QuickSale` | 20 | Operations/finance | Sales and payment workflow. |
| `QuickSalesProduct` | 10 | Operations/inventory | Can affect product inventory. |
| `Role` | 7 | RBAC | Role names also appear in JWT claims. |
| `RolePermission` | 8 | RBAC | Unique role/permission pair. |
| `Service` | 17 | Management/catalog | Used by estimates, job orders, and packages. |
| `ServiceCategory` | 7 | Configuration | Service reference data. |
| `ServiceGroup` | 7 | Configuration | Service reference data. |
| `Supplier` | 9 | Management | Product reference data. |
| `UnitOfMeasure` | 7 | Configuration | Product reference data. |
| `User` | 19 | Identity | Password and PIN hashes must remain verifiable or be migrated carefully. |
| `UserRole` | 7 | RBAC | Many-to-many user role relationship. |
| `Vehicle` | 18 | Customer/vehicle | Core relationship to customer and operations. |
| `VehicleMake` | 8 | Vehicle configuration | Reference data. |
| `VehicleModel` | 10 | Vehicle configuration | Reference data; product applicability depends on it. |

### Key Database Migration Considerations

- Decide whether Prisma table names will preserve existing SQL Server names or adopt a new naming convention. Preserving names with `@@map` reduces data migration risk.
- Convert SQL Server identity columns to PostgreSQL identity/serial semantics through Prisma defaults.
- Preserve decimal precision, especially money-like values currently represented as `decimal(18,2)`.
- Normalize `datetime`, `datetimeoffset`, and `date` behavior. Prefer UTC storage and explicit timezone handling for event timestamps.
- Convert `nvarchar(max)` and long text fields to PostgreSQL `text`.
- Review checklist JSON fields and other serialized content. PostgreSQL `jsonb` may be better than plain text where the app queries the structure.
- Recreate filtered SQL Server indexes as PostgreSQL partial indexes. Prisma may require raw SQL migrations for some partial indexes.
- Recreate include-column indexes where needed. PostgreSQL supports `INCLUDE`, but Prisma may also require raw migration SQL.
- Replace runtime schema initializer behavior with versioned Prisma migrations. Runtime DDL should not remain in the Next.js application path.

## 2. API Inventory

### Controller Summary

| Controller | Endpoint count | GET | POST | PUT | DELETE | Target route-handler area |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `OperationsController` | 90 | 57 | 14 | 9 | 10 | `app/api/operations/.../route.ts` |
| `ConfigurationController` | 59 | 25 | 12 | 11 | 11 | `app/api/config/.../route.ts` |
| `ManagementController` | 40 | 20 | 8 | 6 | 6 | `app/api/management/.../route.ts` |
| `LoginSettingsController` | 8 | 3 | 2 | 1 | 2 | `app/api/login-settings/.../route.ts` |
| `UsersController` | 8 | 4 | 2 | 1 | 1 | `app/api/users/.../route.ts` |
| `HikvisionCameraController` | 8 | 4 | 2 | 1 | 1 | `app/api/camera/hikvision/.../route.ts` |
| `VehiclesController` | 8 | 5 | 1 | 1 | 1 | `app/api/vehicles/.../route.ts` |
| `CustomersController` | 7 | 4 | 1 | 1 | 1 | `app/api/customers/.../route.ts` |
| `CompanyInfosController` | 7 | 3 | 2 | 1 | 1 | `app/api/companyinfo/.../route.ts` |
| `ServiceCategoriesController` | 5 | 2 | 1 | 1 | 1 | Consolidate under config or keep compatibility route |
| `RolesController` | 5 | 2 | 1 | 1 | 1 | `app/api/roles/.../route.ts` |
| `RbacController` | 5 | 3 | 1 | 1 | 0 | `app/api/rbac/.../route.ts` |
| `AuthController` | 3 | 1 | 2 | 0 | 0 | `app/api/auth/.../route.ts` |
| `VoidCodesController` | 2 | 1 | 1 | 0 | 0 | `app/api/administrators/void-codes/.../route.ts` |
| `ChatController` | 1 | 0 | 1 | 0 | 0 | `app/api/chat/messages/route.ts` |
| **Total** | **256** | **155** | **50** | **34** | **17** |  |

### API Groups

| API group | Current responsibilities | Migration notes |
| --- | --- | --- |
| `api/auth` | Login, token validation, forgot/reset PIN | Migrate early. Decide between JWT compatibility and HTTP-only session cookies. |
| `api/rbac`, `api/roles`, `api/users` | Users, roles, permissions, page access | Central platform dependency. Must preserve permission keys and page access behavior. |
| `api/config` | Reference/configuration CRUD | Good early migration candidate after auth. |
| `api/customers`, `api/vehicles` | Customer and vehicle CRUD/summaries | Medium risk and high reuse by operations. |
| `api/management` | Products, services, packages, inventory, suppliers, manufacturers, PDFs | Large module. Inventory logic and reports make it high risk. |
| `api/operations` | Inspections, estimates, job orders, invoices, payments, deposits, quick sales, expenses, petty cash, reports, void/unlock | Largest and most complex module. Must be migrated in smaller business slices. |
| `api/companyinfo` | Company records and logo upload | Requires DB plus object storage. |
| `api/login-settings` | Login screen settings and assets | Currently file-backed; should move to DB/object storage or managed configuration. |
| `api/camera/hikvision` | Anonymous camera alarm webhook, event queries, snapshots, camera settings | Needs special deployment review for public webhook and camera network reachability. |
| `api/chat` | OpenAI-backed assistant endpoint | Low data complexity but requires secure server-side API key management. |

### API Compatibility Recommendation

The existing frontend already calls `/api/...` paths through an API client. During migration, keep route names and response shapes compatible first. After parity is achieved, selected flows can move to server actions, loaders, or redesigned Next.js boundaries.

Recommended route-handler pattern:

- One route-handler folder per existing API resource.
- Shared server-only modules for auth, RBAC checks, Prisma access, validation, and error responses.
- Zod or equivalent validation for all request bodies and query parameters.
- A compatibility test suite that compares representative .NET responses to Next.js responses.

## 3. Authentication Inventory

### Current Authentication

Current backend behavior:

- JWT Bearer authentication.
- Global controller authorization policy: API controllers require authenticated users by default.
- `AuthController` exposes login, validation, and forgot/reset PIN.
- `AuthService` supports email/password login and six-digit PIN login.
- Password and PIN hashing use PBKDF2/Rfc2898DeriveBytes with SHA-256, 32-byte salt, 32-byte hash, and configurable iterations.
- Login requires the user to have the `auth.can_login` permission.
- JWT includes user id, email, role id, role names, and profile name claims.
- Token expiration is configured by `Jwt:ExpiryMinutes`.

Current frontend behavior:

- Stores `auth_token` and `auth_user` in `localStorage`.
- Adds `Authorization: Bearer <token>` to API requests.
- Decodes JWT client-side and validates token expiry.
- Performs automatic logout after five minutes of inactivity.

### Current RBAC

RBAC tables:

- `Users`
- `Roles`
- `UserRoles`
- `Permissions`
- `RolePermissions`

RBAC middleware behavior:

- Requires authentication for most `/api` paths.
- Requires `auth.can_login` for API access.
- Maps route prefixes to permission keys.
- Requires `auth.can_delete` for DELETE requests.
- Requires `operations.can_void` for void operations.
- Seeds/updates permission keys at startup through SQL Server-specific runtime DDL and seed logic.

Public or anonymous API exceptions found:

- `POST /api/auth/login`
- `POST /api/auth/forgot-pin`
- `POST /api/users/change-password-by-email`
- `GET /api/companyinfo`
- `GET /api/login-settings`
- `GET` inspection photo endpoints under `/api/operations/inspections/.../photos`
- `POST /api/camera/hikvision/alarm`

### Target Authentication Recommendation

Recommended target approach:

1. Keep the existing password and PIN hash verification compatible during migration so users do not need a forced password reset.
2. Move browser authentication from `localStorage` JWT storage to HTTP-only, secure, same-site cookies if possible.
3. Preserve JWT compatibility temporarily if the existing frontend must coexist during staged migration.
4. Implement RBAC in shared Next.js server-only authorization utilities and/or middleware.
5. Port permission keys exactly before refactoring names.
6. Review public endpoints before cutover, especially `change-password-by-email`, public media endpoints, and camera webhook behavior.

Security decisions needed:

- Whether to keep JWT as the long-term auth mechanism or adopt a session library.
- Whether to retain PIN login.
- Whether to retain plaintext `OperationAccessCode.CodeValue`; this should be reviewed because the entity also stores hash/salt/suffix.
- Whether public inspection photo access remains acceptable.
- Whether CORS should be restricted to known origins in the target deployment.

## 4. External Integrations

| Integration | Current implementation | Target migration action | Risk |
| --- | --- | --- | --- |
| OpenAI chat | `ChatController` calls `https://api.openai.com/v1/responses`; model from config; API key from config/environment; gated by `chatbot.can_use` | Implement server-only Route Handler with environment-based secret management and request validation | Low to medium |
| Hikvision camera alarm webhook | Anonymous XML webhook at `/api/camera/hikvision/alarm`; skips HTTPS redirection for this route | Implement public Route Handler; validate payloads; consider IP allowlist/signature if available | High |
| Hikvision snapshots | Backend calls camera URL with network credentials and writes snapshots locally | Vercel serverless may not reach local cameras. Use a local gateway, VPN, tunnel, or on-prem worker if cameras are private network devices | High |
| Camera settings | Stored in local JSON under `uploads/camera/hikvision-settings.json`; password persisted there | Move to encrypted DB fields or managed secrets; avoid plain JSON secrets | High |
| Login settings/assets | Stored in local JSON/files under `uploads/login` | Move structured settings to DB and assets to object storage | Medium |
| Company logos | Stored under `uploads/company-logo/{id}` | Move to object storage such as Vercel Blob, S3, R2, or Azure Blob | Medium |
| Inspection photos | Stored under `uploads/inspections/{id}` | Move to object storage with signed/public URL policy | Medium to high |
| Camera snapshots | Stored under `uploads/camera-events/YYYY/MM` | Move to object storage and store object keys in PostgreSQL | Medium to high |
| PDF reports | QuestPDF classes generate PDFs in .NET | Replace with React/HTML-to-PDF, Playwright/Puppeteer, PDFKit, React PDF, or a separate reporting service | High |
| Swagger/OpenAPI | Swashbuckle in .NET | Generate OpenAPI from route handlers or maintain contract tests/docs separately | Medium |
| IIS deployment | `web.config` and IIS deployment docs exist | Replace or supplement with Vercel deployment pipeline; keep IIS only if a local/on-prem gateway remains | Medium |

Target deployment note:

- Vercel + Neon is a good fit for standard Next.js Route Handlers and PostgreSQL.
- Add a connection pooling strategy for Prisma and Neon, such as Neon pooled connection strings and careful Prisma client lifecycle handling.
- Add object storage. The current app depends on local filesystem writes that will not be durable on Vercel.
- Add centralized logging, error tracking, environment variable management, and database migration automation.
- Camera integration may need an always-on local bridge service if cameras are not reachable from the public internet.

## 5. Stored Procedures

No stored procedures, scalar functions, table-valued functions, views, or triggers were found in the inspected source code or SQL sync scripts.

This lowers migration risk, but it does not remove SQL migration work. The application still contains significant SQL Server-specific raw SQL and runtime DDL.

### Raw SQL / Runtime DDL Owners

| Area | Current raw SQL purpose | Migration action |
| --- | --- | --- |
| `RbacSchemaInitializer` | Creates RBAC tables, indexes, permissions, and seed data | Replace with Prisma migrations and seed scripts. Convert `MERGE` logic to idempotent PostgreSQL upsert. |
| `InventoryAccounting` | Creates inventory tables/columns/indexes and performs inventory adjustments | Move DDL to migrations; port DML and reporting queries to Prisma/queryRaw PostgreSQL SQL. |
| `ProductVehicleApplicabilitySchemaInitializer` | Creates product-to-vehicle applicability table and indexes | Move to Prisma schema/migration. |
| `InspectionChecklistTemplateSchemaInitializer` | Creates checklist template table and filtered active index | Move to Prisma migration; use PostgreSQL partial unique index. |
| `OperationAccessCodeSchemaInitializer` | Creates access code table and indexes | Move to Prisma migration; review sensitive fields. |
| `CameraEventSchemaInitializer` | Creates camera event table and indexes | Move to Prisma migration. |
| `DatabaseIndexInitializer` | Detects missing FK indexes using SQL Server `sys.*` catalog and creates indexes dynamically | Replace with explicit Prisma/raw SQL migration indexes. |
| `ManagementController` inventory audit | Uses raw SQL for inventory audit/report queries | Rewrite for PostgreSQL, likely with Prisma `$queryRaw` for complex aggregations. |
| `CompanyInfosController` | Clears primary company using interpolated SQL | Replace with Prisma transaction/updateMany. |
| `OperationAccessCodeService` | Atomically consumes codes using interpolated SQL | Replace with PostgreSQL transaction and conditional update. |

## 6. SQL Server Specific Features

| SQL Server feature | Found usage | PostgreSQL / Prisma migration action |
| --- | --- | --- |
| SQL Server EF provider | `Microsoft.EntityFrameworkCore.SqlServer` | Replace with Prisma PostgreSQL provider. |
| `[dbo]` and bracket quoting | Extensive in scripts and runtime SQL | Convert to PostgreSQL identifiers or avoid raw schema-qualified SQL where possible. |
| `IDENTITY(1,1)` | Identity columns in SQL scripts | Use Prisma `@default(autoincrement())` and PostgreSQL identity/sequence behavior. |
| `OBJECT_ID`, `COL_LENGTH`, `sys.*` catalog queries | Runtime schema checks and index initializer | Remove runtime DDL; use Prisma migrations. |
| `SCOPE_IDENTITY()` | RBAC seed logic | Use PostgreSQL `RETURNING` or Prisma upsert/create result. |
| `MERGE [dbo]` | Permission seeding | Convert to Prisma upsert or PostgreSQL `INSERT ... ON CONFLICT`. |
| `GETUTCDATE()` | Default timestamp expressions | Use PostgreSQL `now()` or application-generated UTC timestamps. |
| `DATETIME`, `DATETIMEOFFSET`, `DATE` | Many entities and scripts | Map carefully to Prisma `DateTime`; preserve timezone semantics. |
| `NVARCHAR(MAX)` | Long text fields | Use PostgreSQL `text`. |
| Filtered indexes | `HasFilter("[IsPrimaryCompany] = 1")`, `HasFilter("[IsActive] = 1")` | Use PostgreSQL partial unique indexes, likely in raw SQL migrations. |
| Include-column indexes | Inventory and transaction date indexes | Use PostgreSQL `INCLUDE` indexes where needed; may require raw SQL migrations. |
| `TOP 1` | SQL Server query syntax | Convert to `LIMIT 1`. |
| `N''` Unicode string literals | SQL scripts | Remove SQL Server-specific prefix in PostgreSQL. |
| `GO` batch separators | SQL sync scripts | Not valid PostgreSQL; migration scripts must be regenerated. |
| SQL Server `.bak` backup | `BASE_DB_CLEAN.bak` exists | Cannot restore directly to PostgreSQL. Use SQL Server export/ETL into PostgreSQL. |

## 7. Migration Complexity Per Module

| Module | Complexity | Why |
| --- | --- | --- |
| Next.js platform foundation | Medium | App Router, Route Handler conventions, environment loading, validation, testing, and Prisma lifecycle setup. |
| Prisma/PostgreSQL schema conversion | High | 54 known tables/entities, many relationships, indexes, partial indexes, naming decisions, and data type conversions. |
| Data migration from MSSQL | High | SQL Server `.bak` cannot restore directly; needs export, transform, load, verification, and repeatable dry-runs. |
| Authentication, users, roles, RBAC | High | Global access control, permission seeding, JWT claims, password/PIN hash compatibility, public endpoint review. |
| Company info and login settings | Medium to high | Mix of database data, local files, public endpoints, and branding assets. |
| Customers and vehicles | Medium | Core CRUD with downstream dependencies. Good candidate after auth/config. |
| Configuration/reference modules | Medium | Many CRUD resources but relatively low business logic. |
| Management catalog | High | Products, services, packages, applicability, suppliers, manufacturers, and inventory dependencies. |
| Inventory accounting and reconciliation | Very high | Runtime DDL, raw SQL reporting, audit logic, stock adjustments, and transaction history. |
| Inspections | High | Photos, checklist templates, technicians, PDFs, and operations workflow links. |
| Estimates | High | Parent/detail aggregates, packages, products, services, technicians, pricing, approvals. |
| Job orders | Very high | Central workflow entity with inventory, technicians, statuses, invoices, reports, and gate pass output. |
| Invoices, payments, deposits, AR | Very high | Financial workflow, reports, payment details, balances, and data correctness requirements. |
| Quick sales, expenses, petty cash | High | Financial and inventory side effects plus reports. |
| PDF/reporting | High to very high | 17 QuestPDF report classes must be recreated and visually verified. |
| Hikvision camera events | High | Public webhook, XML parsing, snapshots, local network camera access, secret handling, file storage. |
| OpenAI chat | Low to medium | Small API surface, but requires secure key management and RBAC. |
| Dashboard and analytics | Medium to high | Depends on migrated operations, payments, and inventory data. |
| Frontend migration from React Router to Next App Router | High | Many protected routes, route guards, RBAC page access, forms, reports, and API contracts. |
| Deployment to Vercel/Neon | Medium | Straightforward for core app, but storage, Prisma pooling, camera access, and PDF generation need design. |

## 8. Estimated Effort

Assumptions:

- Estimate covers migration to functional parity, not a full product redesign.
- Estimate assumes one senior full-stack engineer with periodic QA/business validation.
- More engineers can reduce calendar time, but coordination and regression testing still matter.
- Data migration effort depends on live database size, quality, and how many historical records must be retained.

| Workstream | Estimated engineering days |
| --- | ---: |
| Final discovery, acceptance baseline, migration runbook | 4 to 6 |
| Next.js, Prisma, PostgreSQL foundation | 5 to 8 |
| Prisma schema conversion and migration setup | 8 to 14 |
| MSSQL to PostgreSQL ETL dry-runs and reconciliation | 10 to 20 |
| Authentication, sessions/JWT compatibility, RBAC | 6 to 10 |
| Configuration, customers, vehicles | 8 to 12 |
| Company/login settings and object storage foundation | 5 to 9 |
| Management catalog and product applicability | 10 to 18 |
| Inventory accounting, checks, audit reports | 14 to 24 |
| Operations: inspections, estimates, job orders | 18 to 30 |
| Finance: invoices, deposits, payments, AR, quick sales, expenses, petty cash | 16 to 28 |
| PDF/report recreation and visual QA | 10 to 18 |
| External integrations: OpenAI, Hikvision, camera snapshots | 8 to 14 |
| Frontend App Router migration and protected route UX | 14 to 24 |
| End-to-end QA, security review, UAT, cutover | 12 to 20 |

Overall estimate:

- One senior full-stack engineer: approximately 100 to 165 engineering days, or 20 to 33 calendar weeks.
- Two engineers plus QA support: approximately 12 to 20 calendar weeks if work is split cleanly by module.
- Add additional time if reports require exact pixel parity, if historical data is dirty, or if the camera integration needs new network infrastructure.

## 9. Recommended Migration Order

1. Establish migration baseline
   - Freeze current production behavior into acceptance criteria.
   - Export current API route list and representative request/response samples.
   - Identify must-keep historical data and archival data.

2. Create target platform foundation
   - Next.js App Router project structure.
   - Route Handler conventions.
   - Shared validation, error response, logging, and environment modules.
   - Prisma client setup for PostgreSQL.
   - Test framework and CI checks.

3. Convert database schema
   - Build Prisma schema from EF Core and SQL scripts.
   - Preserve table/column names initially with Prisma mapping where useful.
   - Create explicit migrations for all tables, foreign keys, indexes, partial indexes, and seed data.
   - Remove runtime DDL from the future app architecture.

4. Build repeatable data migration
   - Export from SQL Server into a controlled intermediate format.
   - Load into PostgreSQL.
   - Reconcile row counts, FK integrity, monetary totals, inventory balances, and key reports.
   - Repeat until dry-runs are reliable.

5. Migrate authentication and RBAC
   - Port password/PIN hash verification.
   - Port users, roles, permissions, role-permissions, and user-roles.
   - Implement auth middleware and route-level permission checks.
   - Review public endpoints and sensitive flows.

6. Migrate storage-backed settings
   - Add object storage.
   - Move login assets, company logos, inspection photos, and camera snapshots out of local filesystem storage.
   - Store durable object keys/URLs in PostgreSQL.

7. Migrate configuration/reference modules
   - Service categories/groups.
   - Vehicle makes/models.
   - Product groups/categories.
   - Parameter groups/parameters.
   - Unit measures.
   - Job statuses.
   - Inspection templates.

8. Migrate customers and vehicles
   - Customer CRUD and summaries.
   - Vehicle CRUD and customer associations.
   - Membership behavior.

9. Migrate management/catalog
   - Services, products, packages.
   - Package product/service composition.
   - Suppliers and manufacturers.
   - Product-to-vehicle applicability.

10. Migrate inventory
    - Product inventory transactions.
    - Inventory checks and reconciliation.
    - Inventory summaries and audit reports.
    - Stock side effects from operations and quick sales.

11. Migrate operations workflow
    - Inspections and photos.
    - Estimates.
    - Job orders.
    - Invoices.
    - Deposits and payments.
    - Accounts receivable.
    - Quick sales.
    - Expenses and petty cash.
    - Void/unlock access-code flows.

12. Recreate reports and PDFs
    - Prioritize business-critical reports first: invoices, job orders, estimates, payment receipts, inventory checks, daily sales.
    - Use visual regression checks for PDF output.
    - Decide whether report generation runs in Vercel serverless, a worker, or a separate reporting service.

13. Migrate external integrations
    - OpenAI chat endpoint.
    - Hikvision alarm webhook.
    - Camera snapshot capture or local bridge service.
    - Camera event dashboard and retention policy.

14. Migrate frontend routes to Next.js
    - Preserve current protected route behavior.
    - Port layouts, navigation, RBAC page access, forms, loading states, and error states.
    - Retire React Router after parity.

15. Harden and cut over
    - Security review.
    - Performance review.
    - UAT.
    - Final data migration.
    - DNS/deployment cutover.
    - Rollback plan.

## SDLC Work Packages

### FORGE - Backend / Data Tasks

- Produce the Prisma schema from the EF Core model and SQL scripts.
- Replace runtime schema initializers with versioned migrations and seed scripts.
- Implement route handlers preserving current API contracts.
- Port RBAC and business services module by module.
- Recreate complex SQL Server reports/queries in PostgreSQL-compatible SQL or Prisma.
- Build data migration and reconciliation scripts.

### PIXEL - Frontend / UI Tasks

- Port React Router routes to Next.js App Router pages.
- Preserve login, protected route, RBAC navigation, and inactivity logout behavior or replace with an approved session UX.
- Update API client usage for Route Handlers.
- Recreate report and PDF request flows.
- Validate responsive behavior across operations, management, configuration, and report pages.

### AEGIS - QA / Security Tasks

- Build acceptance tests around high-risk workflows: login, RBAC, inspection-to-invoice flow, payments, inventory reconciliation, void codes, and reports.
- Compare source and target API responses for representative fixtures.
- Verify SQL Server to PostgreSQL row counts, FK integrity, balances, and report totals.
- Review public endpoints, token/session storage, CORS, camera webhook exposure, object storage access, and secret handling.
- Perform OWASP review before cutover.

### ATLAS - Deployment Tasks

- Configure Vercel environments for preview and production.
- Configure Neon PostgreSQL with pooled connection strings for Prisma.
- Add object storage for uploaded assets and generated snapshots.
- Add environment variables for JWT/session secrets, OpenAI, storage, camera settings, and database URLs.
- Add migration pipeline and rollback checklist.
- Add monitoring, logging, backup, and restore procedures.
- Decide whether Hikvision snapshot capture needs a local gateway service.

## Key Open Decisions

| Decision | Why it matters |
| --- | --- |
| Preserve API contracts or redesign endpoints? | Preserving contracts reduces frontend risk. Redesigning can improve architecture but increases migration scope. |
| Long-term auth model: JWT or HTTP-only sessions? | Affects middleware, frontend state, security posture, and deployment. |
| Storage provider | Required because Vercel filesystem is not durable for uploads. |
| PDF generation strategy | Current QuestPDF implementation cannot be copied directly into Next.js. |
| Camera network architecture | Vercel may receive webhooks, but may not reach private camera IPs for snapshots. |
| Data migration source | Live SQL Server export, `.bak` restore to a staging SQL Server, or another ETL path changes the migration plan. |
| Appointment module status | Frontend contains appointment references/redirects, but no active backend API inventory was found. Decide whether to retire or migrate later. |

## Final Recommendation

Proceed with a phased migration. Start with schema, data migration, auth/RBAC, and API compatibility before attempting frontend redesign. The safest path is to make the Next.js application behave like the existing system first, then improve architecture after parity is proven.

The highest-risk modules are operations, inventory, payments/accounts receivable, reports, and camera integration. These should receive dedicated test fixtures and business-user validation before cutover.
