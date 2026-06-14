# Phase 3 Wave 6A Report: Inspection Read APIs

Date: 2026-06-13

## Scope

Wave 6A started the operations migration with read-only inspection endpoints. This batch intentionally avoided create/update/delete and file/report endpoints so the largest legacy controller can be migrated in safer, testable slices.

## Implemented Endpoints

- `GET /api/operations/inspections`
- `GET /api/operations/inspections/summary`
- `GET /api/operations/inspections/checklist-template`
- `GET /api/operations/inspections/next-reference`
- `GET /api/operations/inspections/{id}`

## Files Added

- `src/server/operations/inspections.ts`
- `src/app/api/operations/inspections/route.ts`
- `src/app/api/operations/inspections/summary/route.ts`
- `src/app/api/operations/inspections/checklist-template/route.ts`
- `src/app/api/operations/inspections/next-reference/route.ts`
- `src/app/api/operations/inspections/[id]/route.ts`

## Behavioral Notes

- Inspection list returns the legacy list-view projection:
  - `clientType`
  - `referenceNo`
  - `inspectionDate`
  - `customerName`
  - `vehicle`
  - `plateNo`
  - `status`
- Inspection summary returns the legacy dashboard/list summary projection with `vehicleId`, `isChangan`, and `transactionDate`.
- Inspection detail returns the legacy nested DTO shape for:
  - job status,
  - vehicle model and make,
  - customer,
  - assigned technicians.
- Next reference preserves the legacy prefix-plus-number increment rule and defaults to `V10000001` when no prior reference exists.
- Checklist template uses the active template from the configuration module. A small legacy fallback is returned only if no template exists.

## Authorization

Routes use the existing route permission catalog:

- `/api/operations/inspections*` requires `page.operations.inspection.view`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 6A and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database:

- Read inspection list: `726` rows.
- Read inspection summary: `726` rows.
- Read next inspection reference: `VI0000728`.
- Read checklist template: `12` groups.
- Read inspection detail for an existing inspection.

Runtime note:

- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed.

## Deferred Items

- `POST /api/operations/inspections`
- `PUT /api/operations/inspections/{id}`
- `DELETE /api/operations/inspections/{id}`
- Inspection PDF print endpoint.
- Inspection photo list/upload/delete endpoints.

## Recommended Next Batch

Proceed to Wave 6B:

- Implement inspection create/update/delete.
- Preserve technician replacement behavior.
- Use transactions for inspection and inspection technician writes.
- Keep inspection photo and print endpoints deferred until storage/report strategy is selected.
