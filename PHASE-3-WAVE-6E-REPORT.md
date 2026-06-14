# Phase 3 Wave 6E Report: Job Order Read APIs

Date: 2026-06-13

## Scope

Wave 6E added read-only job order endpoints from the legacy operations controller. Job order mutation endpoints remain deferred because they touch linked estimates, invoice links, inventory-affecting status transitions, and additional-line synchronization.

## Implemented Endpoints

- `GET /api/operations/joborders`
- `GET /api/operations/joborders/summary`
- `GET /api/operations/joborders/next-reference`
- `GET /api/operations/joborders/by-service/{serviceId}`
- `GET /api/operations/joborders/by-product/{productId}`
- `GET /api/operations/joborders/{id}`

## Files Added

- `src/server/operations/job-orders.ts`
- `src/app/api/operations/joborders/route.ts`
- `src/app/api/operations/joborders/summary/route.ts`
- `src/app/api/operations/joborders/next-reference/route.ts`
- `src/app/api/operations/joborders/by-service/[serviceId]/route.ts`
- `src/app/api/operations/joborders/by-product/[productId]/route.ts`
- `src/app/api/operations/joborders/[id]/route.ts`
- `PHASE-3-WAVE-6E-REPORT.md`

## Behavioral Notes

- Job order list returns the legacy list projection with customer, vehicle, plate, status, estimate, invoice, and package markers.
- Job order summary returns package/service search helpers used by the legacy UI:
  - `packageIds`
  - `packageNames`
  - `packageSearchTexts`
  - `packageServiceNames`
  - `serviceIds`
  - `serviceNames`
- Next reference preserves the legacy prefix-plus-number increment rule and defaults to `JO0000001` when no prior reference exists.
- Job order detail returns nested legacy DTO data for:
  - job status,
  - service group,
  - vehicle model and make,
  - customer,
  - advisor, estimator, approver,
  - packages,
  - services,
  - products,
  - technicians.
- Detail preserves the legacy fallback behavior: if job order package/service/product/technician lines are empty and the job order is linked to an estimate, matching estimate lines are returned with the current job order ID.
- By-service and by-product lookup endpoints return the legacy job order summary projection.

## Authorization

Routes use the existing route permission catalog:

- `/api/operations/joborders*` requires `page.operations.job_order.view`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 6E and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database:

- Read job order list: `1481` rows.
- Read job order summary: `1481` rows.
- Read next job order reference: `JO0001482`.
- Read job order detail for job order `1`.
- Verified detail line collections were returned:
  - packages: `1`
  - services: `2`
  - products: `2`
  - technicians: `1`
- Read by-service lookup: `360` rows.
- Read by-product lookup: `115` rows.

Runtime note:

- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed.

## Deferred Items

- `POST /api/operations/joborders`
- `PUT /api/operations/joborders/{id}`
- `DELETE /api/operations/joborders/{id}`
- Job order PDF print endpoint.
- Job order unlock/void endpoints.
- Invoice, payment, deposit, quick-sales, expense, and petty-cash operation endpoints.

## Recommended Next Batch

Proceed to Wave 6F:

- Implement job order create/update/delete.
- Preserve linked-estimate duplicate checks.
- Preserve non-price-editor price/rate protection.
- Preserve inventory-affecting status checks for product usage.
- Preserve linked estimate additional-line synchronization.
