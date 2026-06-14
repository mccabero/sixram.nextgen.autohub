# Phase 3 Wave 6K Report: Quick Sales APIs

## Scope

Implemented quick sales JSON APIs with product line handling, protected pricing, inventory validation, and operation soft delete.

## Endpoints Added

- `GET /api/operations/quicksales`
- `POST /api/operations/quicksales`
- `GET /api/operations/quicksales/summary`
- `GET /api/operations/quicksales/next-reference`
- `GET /api/operations/quicksales/{id}`
- `PUT /api/operations/quicksales/{id}`
- `DELETE /api/operations/quicksales/{id}`

## Files Changed

- `src/server/operations/quick-sales.ts`
- `src/app/api/operations/quicksales/route.ts`
- `src/app/api/operations/quicksales/summary/route.ts`
- `src/app/api/operations/quicksales/next-reference/route.ts`
- `src/app/api/operations/quicksales/[id]/route.ts`

## Legacy Behavior Preserved

- Quick sales list returns migrated scalar quick sale records.
- Quick sales summary orders newest rows first and includes customer, payment method, total amount, and status.
- Quick sale next reference follows the legacy `QS0000001` sequence.
- Quick sale detail includes product lines with product name, price, quantity, and amount.
- Quick sale create defaults to `OPEN` when no status is supplied.
- Quick sale create/update validates product existence.
- Quick sale create/update validates inventory usage when the effective status posts inventory.
- Quick sale update excludes the current quick sale from inventory usage checks.
- Quick sale create/update respects `can_edit_price`; without it, submitted product prices are replaced by product selling price.
- Quick sale update preserves existing protected prices for existing products when price editing is not allowed.
- Quick sale update replaces product lines when `products` is supplied.
- Quick sale update blocks reopening a non-open quick sale back to `OPEN`.
- Quick sale delete follows the operation-record soft-delete pattern by moving the quick sale to `DELETED`.

## Validation

- `npm run typecheck` passed.
- `npm run db:validate` passed with a placeholder PostgreSQL URL.
- `npm run lint` passed.
- `npm run build` passed with the known pre-existing Turbopack trace warning through `src/server/api/uploads.ts` and `src/app/api/login-settings/route.ts`.

## Neon Smoke Test

Write smoke testing used a direct Neon connection because this wave exercises interactive transactions. A non-posting temporary status was used so stock availability did not depend on live inventory levels, and the temporary row was hard-cleaned after verification.

Verified:

- Quick sales list count: `301`
- Quick sales summary count: `301`
- Next quick sale reference: `QS0000303`
- Quick sale detail retrieval succeeded.
- Quick sale create inserted one product line.
- Protected create price used product selling price `350` instead of submitted price.
- Quick sale update replaced the product line.
- Protected update price stayed at `350`.
- Protected update amount recalculated to `700`.
- Reopening a non-open quick sale back to `OPEN` was blocked.
- Quick sale soft delete moved the row to `DELETED`.
- Cleanup verification found `0` temporary quick sale rows.

## Notes

- The Neon/PG adapter emitted the same SSL advisory for `sslmode=require`; deployment should review whether to use `sslmode=verify-full` or the documented compatibility flag.
- Quick sale receipt/print work remains deferred to the reports/print wave if needed.
