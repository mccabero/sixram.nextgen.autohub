# Phase 3 Wave 6F Report: Job Order Mutation APIs

Date: 2026-06-13

## Scope

Wave 6F completed the core job order write endpoints from the legacy operations controller. Completion, unlock, void, and printable report endpoints remain deferred because they have separate workflow rules.

## Implemented Endpoints

- `POST /api/operations/joborders`
- `PUT /api/operations/joborders/{id}`
- `DELETE /api/operations/joborders/{id}`

## Files Changed

- `src/server/operations/job-orders.ts`
- `src/app/api/operations/joborders/route.ts`
- `src/app/api/operations/joborders/[id]/route.ts`

## Behavioral Notes

- Create accepts the legacy job order DTO shape with camelCase and PascalCase aliases.
- Create auto-generates the job order reference when `referenceNo` is blank.
- Create rejects duplicate job order links for the same positive `estimateId`.
- Create/update reject discount values greater than zero when `summary`/remarks is blank.
- Create/update reject quick-sales products because job orders only allow non-quick-sales products.
- Create/update validate package, product, service, and technician references before writing child rows.
- Create/update replace package, product, service, and technician line collections when supplied.
- Job order `isPackage` is derived from supplied package/product/service lines when line collections are included.
- Create/update preserve legacy job order price behavior: submitted job order product prices and service rates are stored directly.
- Product stock validation is performed when product lines are supplied and the effective job status affects inventory.
- Product stock validation excludes the current job order usage during update.
- Re-opening operation records is blocked when a request tries to move a non-open job order back to `OPEN`.
- Linked estimate additional-line synchronization is preserved:
  - job order lines not present in original estimate lines are tagged additional,
  - additional estimate package/product/service lines are replaced from tagged job order lines,
  - linked estimate totals are updated from the job order totals.
- Delete preserves the legacy soft-delete behavior by assigning the `DELETED` job status instead of removing the row.

## Authorization

Routes use the existing route permission catalog:

- `POST /api/operations/joborders` requires `page.operations.job_order.view`
- `PUT /api/operations/joborders/{id}` requires `page.operations.job_order.view`
- `DELETE /api/operations/joborders/{id}` requires `page.operations.job_order.view` and `auth.can_delete`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 6F and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database:

- Created a temporary estimate fixture.
- Created a temporary job order linked to that estimate.
- Verified create returned a job order ID.
- Verified job order detail returned service and technician lines.
- Verified original linked estimate services were not incorrectly tagged as additional.
- Updated the job order with an additional service line and an empty technician list.
- Verified job order technician rows were replaced.
- Verified detail fallback returned linked estimate technicians when job order technicians were empty.
- Verified linked estimate additional service synchronization.
- Soft-deleted the job order and verified the `DELETED` status.
- Hard-deleted only the temporary smoke job order, estimate, and child rows after validation.

Runtime notes:

- The successful write smoke used Neon’s direct host because the pooled host terminated an interactive Prisma transaction and left a temporary lock during the first attempt.
- The temporary lock was identified via `pg_stat_activity`, terminated, and all W6F smoke rows were cleaned up.
- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed.

## Deferred Items

- `POST /api/operations/joborders/{id}/complete`
- `POST /api/operations/joborders/{id}/unlock`
- Job order void endpoint.
- Job order PDF print endpoint.
- Invoice, payment, deposit, quick-sales, expense, and petty-cash operation endpoints.

## Recommended Next Batch

Proceed to Wave 6G:

- Implement invoice read APIs.
- Include invoice list, detail, print-deferred data endpoints, and accounts receivable views where the legacy controller exposes read-only projections.
- Keep invoice create/update/delete and payment posting in separate waves because they affect job order completion, payments, and balances.
