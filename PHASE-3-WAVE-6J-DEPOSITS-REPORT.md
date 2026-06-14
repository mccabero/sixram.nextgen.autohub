# Phase 3 Wave 6J Report: Deposits APIs

## Scope

Implemented deposit JSON APIs for list, summary, detail, create, update, and soft delete.

## Endpoints Added

- `GET /api/operations/deposits`
- `POST /api/operations/deposits`
- `GET /api/operations/deposits/summary`
- `GET /api/operations/deposits/{id}`
- `PUT /api/operations/deposits/{id}`
- `DELETE /api/operations/deposits/{id}`

## Files Changed

- `src/server/operations/deposits.ts`
- `src/app/api/operations/deposits/route.ts`
- `src/app/api/operations/deposits/summary/route.ts`
- `src/app/api/operations/deposits/[id]/route.ts`

## Legacy Behavior Preserved

- Deposit list returns migrated scalar deposit records.
- Deposit summary returns reference, transaction date, customer, payment type, deposit amount, and status.
- Deposit detail returns the deposit record by id.
- Deposit create stores the supplied reference number and payment reference number; the legacy API does not generate a deposit reference.
- Deposit update supports partial field updates.
- Deposit update blocks reopening a non-open deposit back to `OPEN`.
- Deposit delete follows the operation-record soft-delete pattern by moving the deposit to `DELETED`.

## Validation

- `npm run typecheck` passed.
- `npm run db:validate` passed with a placeholder PostgreSQL URL.
- `npm run lint` passed.
- `npm run build` passed with the known pre-existing Turbopack trace warning through `src/server/api/uploads.ts` and `src/app/api/login-settings/route.ts`.

## Neon Smoke Test

Smoke testing used a temporary deposit and hard-cleaned it after verification.

Verified:

- Deposit list count: `4`
- Deposit summary count: `4`
- Deposit detail retrieval succeeded.
- Deposit create succeeded.
- Deposit update changed amount from `25` to `30`.
- Reopening a completed deposit back to `OPEN` was blocked.
- Deposit soft delete moved the deposit to `DELETED`.
- Cleanup verification found `0` temporary deposit rows.

## Notes

- The Neon/PG adapter emitted the same SSL advisory for `sslmode=require`; deployment should review whether to use `sslmode=verify-full` or the documented compatibility flag.
