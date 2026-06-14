# Phase 3 Wave 6I Report: Payments APIs

## Scope

Implemented JSON payment APIs and the invoice proceed-to-payment bridge. PDF receipt and gate-pass endpoints remain deferred to the reports/print wave.

## Endpoints Added

- `GET /api/operations/payments`
- `POST /api/operations/payments`
- `GET /api/operations/payments/summary`
- `GET /api/operations/payments/next-reference`
- `GET /api/operations/payments/{id}`
- `PUT /api/operations/payments/{id}`
- `DELETE /api/operations/payments/{id}`
- `POST /api/operations/invoices/{id}/proceed-to-payment`

## Files Changed

- `src/server/operations/payments.ts`
- `src/app/api/operations/payments/route.ts`
- `src/app/api/operations/payments/summary/route.ts`
- `src/app/api/operations/payments/next-reference/route.ts`
- `src/app/api/operations/payments/[id]/route.ts`
- `src/app/api/operations/invoices/[id]/proceed-to-payment/route.ts`

## Legacy Behavior Preserved

- Payment list returns migrated scalar payment records.
- Payment summary orders newest payments first and includes payment detail summaries.
- Payment detail returns customer, status, invoice, job order, payment type, and payment detail fields.
- Payment next reference follows the legacy `PY0000001` sequence.
- Payment create always generates the next payment reference number.
- Payment create inserts payment detail rows when supplied.
- Payment create replaces blank detail reference numbers with the generated payment reference number.
- Payment update supports partial field updates.
- Payment update blocks reopening a non-open payment back to `OPEN`.
- Payment update replaces all payment details when `paymentDetails` is supplied.
- Payment delete follows the operation-record soft-delete pattern by moving the payment to `DELETED`.
- Invoice proceed-to-payment:
  - Returns an existing payment when a payment detail already exists for the invoice.
  - Requires the invoice to be `OPEN`.
  - Requires `OPEN` and `CONVERTED` statuses to exist.
  - Calculates amount payable from invoice total minus non-cancelled deposits and payments.
  - Rejects invoices with no remaining balance.
  - Creates a payment shell and converts the invoice to `CONVERTED`.

## Validation

- `npm run typecheck` passed.
- `npm run db:validate` passed with a placeholder PostgreSQL URL.
- `npm run lint` passed.
- `npm run build` passed with the known pre-existing Turbopack trace warning through `src/server/api/uploads.ts` and `src/app/api/login-settings/route.ts`.

## Neon Smoke Test

Write smoke testing used a direct Neon connection because this wave exercises interactive transactions. Temporary rows were hard-cleaned after verification.

Verified:

- Payment list count: `1338`
- Payment summary count: `1338`
- Next payment reference: `PY0001343`
- Payment detail retrieval succeeded.
- Payment create inserted one detail row.
- Payment update replaced details and changed amount paid to `20`.
- Reopening a completed payment back to `OPEN` was blocked.
- Payment soft delete moved the payment to `DELETED`.
- Invoice proceed-to-payment created a payment.
- Invoice proceed-to-payment converted the invoice to `CONVERTED`.
- Cleanup verification found `0` payment-wave temporary job orders, invoices, and payments.

## Notes

- The Neon/PG adapter emitted the same SSL advisory for `sslmode=require`; deployment should review whether to use `sslmode=verify-full` or the documented compatibility flag.
- Payment receipt and gate-pass PDFs are intentionally deferred to the reports/print wave.
