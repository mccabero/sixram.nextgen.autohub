# Phase 3 Wave 6B Report: Inspection Mutation APIs

Date: 2026-06-13

## Scope

Wave 6B completed the core inspection write endpoints from the legacy operations controller. Photo storage and printable inspection reports remain deferred because they need a storage/reporting decision.

## Implemented Endpoints

- `POST /api/operations/inspections`
- `PUT /api/operations/inspections/{id}`
- `DELETE /api/operations/inspections/{id}`

## Files Added

- `src/server/operations/route-helpers.ts`
- `PHASE-3-WAVE-6B-REPORT.md`

## Files Changed

- `src/server/operations/inspections.ts`
- `src/app/api/operations/inspections/route.ts`
- `src/app/api/operations/inspections/[id]/route.ts`

## Behavioral Notes

- Create accepts the legacy inspection DTO shape with camelCase and PascalCase aliases.
- Create writes inspection technicians in the same transaction as the inspection.
- Technician IDs are de-duplicated before insert, matching the legacy `Distinct()` behavior.
- Update returns `204 No Content`, matching the legacy controller.
- Update only applies fields that are provided with usable values, preserving legacy nullable DTO behavior.
- Update replaces technician assignments only when `technicianUserIds`/`TechnicianUserIds` is present.
- Re-opening operation records is blocked when a request tries to move a non-open record back to `OPEN`.
- Delete preserves the legacy soft-delete behavior by assigning the `DELETED` job status instead of removing the row.
- The `DELETED` job status is created automatically if missing, using the legacy name and description.

## Authorization

Routes use the existing route permission catalog:

- `POST /api/operations/inspections` requires `page.operations.inspection.create`
- `PUT /api/operations/inspections/{id}` requires `page.operations.inspection.update`
- `DELETE /api/operations/inspections/{id}` requires `page.operations.inspection.delete`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 6B and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database:

- Created a temporary inspection with a duplicate technician ID list.
- Verified technician ID de-duplication.
- Read the created inspection detail.
- Updated remarks, odometer, and technician assignments.
- Verified technician replacement with an empty list.
- Soft-deleted the inspection and verified the `DELETED` status.
- Hard-deleted only the temporary smoke inspection and its technician rows after validation.

Runtime note:

- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed.

## Deferred Items

- Inspection PDF print endpoint.
- Inspection photo list/upload/delete endpoints.
- Estimate mutation endpoints.
- Job order, invoice, payment, and deposit operation endpoints.

## Recommended Next Batch

Proceed to Wave 6C:

- Implement estimate read APIs.
- Mirror inspection read DTO conventions for list, summary, detail, and next-reference endpoints.
- Keep estimate create/update/delete in a separate wave because package/service/product child rows need transactional pricing and authorization rules.
