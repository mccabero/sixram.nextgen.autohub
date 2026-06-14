# Phase 3 Wave 6D Report: Estimate Mutation APIs

Date: 2026-06-13

## Scope

Wave 6D completed the core estimate write endpoints from the legacy operations controller. Printable estimate PDFs remain deferred with the other report/export endpoints.

## Implemented Endpoints

- `POST /api/operations/estimates`
- `PUT /api/operations/estimates/{id}`
- `DELETE /api/operations/estimates/{id}`

## Files Changed

- `src/server/operations/estimates.ts`
- `src/app/api/operations/estimates/route.ts`
- `src/app/api/operations/estimates/[id]/route.ts`

## Behavioral Notes

- Create accepts the legacy estimate DTO shape with camelCase and PascalCase aliases.
- Create auto-generates the estimate reference when `referenceNo` is blank.
- Create rejects duplicate estimate links for the same positive `inspectionId`.
- Create/update reject discount values greater than zero when `summary`/remarks is blank.
- Create/update reject quick-sales products because estimates only allow non-quick-sales products.
- Create/update validate package, product, service, and technician references before writing child rows.
- Create/update write parent and child records in Prisma transactions.
- Package, product, service, and technician line collections are replaced when supplied on update.
- Estimate `isPackage` is derived from supplied package/product/service lines when line collections are included.
- Non-price-editor writes preserve legacy price protection:
  - create uses product selling price and service standard rate,
  - update preserves existing line price/rate when available,
  - amount is recalculated from protected price/rate.
- Re-opening operation records is blocked when a request tries to move a non-open estimate back to `OPEN`.
- Delete preserves the legacy soft-delete behavior by assigning the `DELETED` job status instead of removing the row.

## Authorization

Routes use the existing route permission catalog:

- `POST /api/operations/estimates` requires `page.operations.estimate.view`
- `PUT /api/operations/estimates/{id}` requires `page.operations.estimate.view`
- `DELETE /api/operations/estimates/{id}` requires `page.operations.estimate.view` and `auth.can_delete`

Price protection uses:

- `auth.can_edit_price`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 6D and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database:

- Created a temporary package estimate with one package, one product, one service, and one technician.
- Verified non-price-editor product price was replaced with product selling price.
- Verified non-price-editor service rate was replaced with service standard rate.
- Updated product quantity, service hours, summary, and technician assignments.
- Verified protected product price and service rate were preserved during update.
- Verified product/service amounts were recalculated after update.
- Soft-deleted the estimate and verified the `DELETED` status.
- Hard-deleted only the temporary smoke estimate and its child rows after validation.

Runtime note:

- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed.

## Deferred Items

- Estimate PDF print endpoint.
- Job order, invoice, payment, deposit, quick-sales, expense, and petty-cash operation endpoints.

## Recommended Next Batch

Proceed to Wave 6E:

- Implement job order read APIs.
- Mirror estimate read DTO conventions for list, summary, detail, and next-reference endpoints.
- Keep job order create/update/delete in a separate wave because it touches linked estimates, inventory-affecting statuses, invoice linkage, and additional-line synchronization.
