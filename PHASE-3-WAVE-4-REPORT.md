# Phase 3 Wave 4 Report: Management and Inventory

Date: 2026-06-13

## Scope

Wave 4 migrated the legacy management catalog and inventory support APIs from the .NET Web API/MSSQL implementation to Next.js App Router route handlers backed by Prisma/PostgreSQL.

## Implemented Endpoints

### Suppliers

- `GET /api/management/suppliers`
- `POST /api/management/suppliers`
- `GET /api/management/suppliers/{id}`
- `PUT /api/management/suppliers/{id}`
- `DELETE /api/management/suppliers/{id}`
- `GET /api/management/suppliers/{id}/products`

### Manufacturers

- `GET /api/management/manufacturers`
- `POST /api/management/manufacturers`
- `GET /api/management/manufacturers/{id}`
- `PUT /api/management/manufacturers/{id}`
- `DELETE /api/management/manufacturers/{id}`
- `GET /api/management/manufacturers/{id}/products`

### Services

- `GET /api/management/services`
- `POST /api/management/services`
- `GET /api/management/services/{id}`
- `PUT /api/management/services/{id}`
- `DELETE /api/management/services/{id}`

### Products

- `GET /api/management/products`
- `POST /api/management/products`
- `GET /api/management/products/{id}`
- `PUT /api/management/products/{id}`
- `DELETE /api/management/products/{id}`
- `GET /api/management/products/{id}/applicable-vehicles`
- `PUT /api/management/products/{id}/applicable-vehicles`

### Packages

- `GET /api/management/packages`
- `POST /api/management/packages`
- `GET /api/management/packages/{id}`
- `PUT /api/management/packages/{id}`
- `DELETE /api/management/packages/{id}`

### Inventory

- `GET /api/management/inventory/summary`
- `GET /api/management/inventory/audit`
- `GET /api/management/inventory/checks`
- `POST /api/management/inventory/checks`
- `GET /api/management/inventory/checks/{id}`
- `GET /api/management/inventory/products/{productId}/transactions`
- `POST /api/management/inventory/transactions`
- `DELETE /api/management/inventory/transactions/{id}`
- `POST /api/management/inventory/reconciliations`

## Files Added

- `src/server/management/service.ts`
- `src/server/management/route-helpers.ts`
- `src/app/api/management/suppliers/route.ts`
- `src/app/api/management/suppliers/[id]/route.ts`
- `src/app/api/management/suppliers/[id]/products/route.ts`
- `src/app/api/management/manufacturers/route.ts`
- `src/app/api/management/manufacturers/[id]/route.ts`
- `src/app/api/management/manufacturers/[id]/products/route.ts`
- `src/app/api/management/services/route.ts`
- `src/app/api/management/services/[id]/route.ts`
- `src/app/api/management/products/route.ts`
- `src/app/api/management/products/[id]/route.ts`
- `src/app/api/management/products/[id]/applicable-vehicles/route.ts`
- `src/app/api/management/packages/route.ts`
- `src/app/api/management/packages/[id]/route.ts`
- `src/app/api/management/inventory/summary/route.ts`
- `src/app/api/management/inventory/audit/route.ts`
- `src/app/api/management/inventory/checks/route.ts`
- `src/app/api/management/inventory/checks/[id]/route.ts`
- `src/app/api/management/inventory/products/[productId]/transactions/route.ts`
- `src/app/api/management/inventory/transactions/route.ts`
- `src/app/api/management/inventory/transactions/[id]/route.ts`
- `src/app/api/management/inventory/reconciliations/route.ts`

## Behavioral Notes

- Routes use the existing API guard and legacy JSON response helper.
- `PUT` and `DELETE` return `204 No Content`, matching prior wave and legacy API behavior.
- Missing records return `404`.
- Delete conflicts return `409` with a linked-record message.
- Product list supports `includeApplicableVehicleSearch=true` and `isQuickSalesProduct=true|false`.
- Product inventory balance includes:
  - manual inventory transactions,
  - active job order product usage,
  - active quick sales product usage.
- Canceled, void, or delete-like job statuses are excluded from active usage.
- Inventory transaction types are normalized to `Stock In`, `Stock Out`, and `Adjustment`.
- Inventory check types are normalized to `End of Day` and `Month End`.
- Month-end inventory checks normalize the check date to the last day of the requested month.
- Product low-stock threshold falls back to `5` when missing or non-positive.
- Product applicable vehicle updates replace the saved vehicle model assignment set transactionally.
- Packages reject quick-sales products, matching the legacy controller rule.
- Package child product/service pricing honors `auth.can_edit_price`:
  - users without price edit permission use current product selling price and service standard rate,
  - users without price edit permission cannot set product cost, markup, selling price, or service standard rate on create/update.

## Authorization

Routes use the existing route permission catalog:

- `/api/management/suppliers*` requires `page.management.suppliers.view`
- `/api/management/manufacturers*` requires `page.management.manufacturers.view`
- `/api/management/services*` requires `page.management.services.view`
- `/api/management/products*` requires `page.management.products.view`
- `/api/management/packages*` requires `page.management.packages.view`
- `/api/management/inventory*` requires `page.management.inventory.view`
- `DELETE` also requires `auth.can_delete`
- Price-sensitive writes check `auth.can_edit_price` inside the management service.

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 4 and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database with cleanup:

- Created a smoke-test supplier.
- Created a smoke-test manufacturer.
- Created a smoke-test service.
- Created a smoke-test product.
- Assigned an applicable vehicle model to the product.
- Created a smoke-test package with one product and one service child row.
- Created a stock-in inventory transaction.
- Created an end-of-day inventory check.
- Read package details with child rows.
- Read inventory check list and detail.
- Ran a broader catalog and inventory service smoke pass before the final validation rerun.
- Removed all temporary package, product, inventory, supplier, manufacturer, and service rows.

Runtime note:

- The Neon smoke test emitted a PG adapter advisory about `sslmode=require` semantics in future `pg` versions and a `client.query()` deprecation warning. The smoke checks passed and cleanup completed; this should be reviewed during deployment hardening with the final Neon connection-string policy.

## Deferred Items

- Inventory PDF/print endpoints remain deferred until the reporting/PDF strategy is selected:
  - `/api/management/reports/inventory-checks/print`
  - `/api/management/reports/inventory-products/print`
- Inventory balance calculation is functionally migrated, but later performance tuning should consider SQL aggregation for large production data volumes.
- Package delete behavior currently follows direct legacy delete semantics; child rows or downstream operation references can still block deletion through foreign-key constraints.

## Recommended Next Wave

Proceed to the first operations transaction wave:

- Inspections and estimates are the recommended next module pair because they depend on the customer, vehicle, catalog, service, product, and package foundations now in place.
- Keep invoices, payments, deposits, quick sales, expenses, and petty cash for later operation/reporting waves.
