# Phase 3 Wave 6C Report: Estimate Read APIs

Date: 2026-06-13

## Scope

Wave 6C added read-only estimate endpoints from the legacy operations controller. Estimate mutation endpoints remain deferred because package, service, product, technician, pricing, and approval behavior should be migrated in a separate transactional wave.

## Implemented Endpoints

- `GET /api/operations/estimates`
- `GET /api/operations/estimates/summary`
- `GET /api/operations/estimates/next-reference`
- `GET /api/operations/estimates/{id}`

## Files Added

- `src/server/operations/estimates.ts`
- `src/app/api/operations/estimates/route.ts`
- `src/app/api/operations/estimates/summary/route.ts`
- `src/app/api/operations/estimates/next-reference/route.ts`
- `src/app/api/operations/estimates/[id]/route.ts`
- `PHASE-3-WAVE-6C-REPORT.md`

## Behavioral Notes

- Estimate list returns the legacy list-view projection:
  - `clientType`
  - `referenceNo`
  - `transactionDate`
  - `customerName`
  - `vehicle`
  - `plateNo`
  - `estimateType`
  - `status`
- Estimate summary returns the legacy summary projection with `inspectionId`, `customerId`, `createdDate`, and `isPackage`.
- Next reference preserves the legacy prefix-plus-number increment rule and defaults to `EST0000001` when no prior reference exists.
- Estimate detail returns the nested legacy DTO shape for:
  - job status,
  - vehicle model and make,
  - customer,
  - technicians,
  - packages,
  - services,
  - products.
- Package detail intentionally exposes `id` as `PackageId`, matching the legacy anonymous projection.

## Authorization

Routes use the existing route permission catalog:

- `/api/operations/estimates*` requires `page.operations.estimate.view`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 6C and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database:

- Read estimate list: `1502` rows.
- Read estimate summary: `1502` rows.
- Read next estimate reference: `EST0001503`.
- Read estimate detail for estimate `7`.
- Verified detail line collections were returned:
  - packages: `1`
  - services: `2`
  - products: `2`
  - technicians: `1`

Runtime note:

- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed.

## Deferred Items

- `POST /api/operations/estimates`
- `PUT /api/operations/estimates/{id}`
- `DELETE /api/operations/estimates/{id}`
- Estimate PDF print endpoint.
- Job order, invoice, payment, and deposit operation endpoints.

## Recommended Next Batch

Proceed to Wave 6D:

- Implement estimate create/update/delete.
- Preserve package/service/product/technician replacement behavior.
- Preserve price-edit protection and package line expansion rules.
- Preserve soft-delete status behavior.
