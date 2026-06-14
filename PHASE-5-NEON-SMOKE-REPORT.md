# Phase 5 Neon Smoke Report

Date: 2026-06-14

## Scope

Ran a read-only Neon PostgreSQL smoke test after the frontend parity and compatibility wave.

The smoke test used the supplied Neon development connection string only as an in-memory command environment variable. The connection string was not written to repository files.

## Result

Status: Passed.

The smoke connected to:

- database: `neondb`
- schema: `public`

No write operations were performed.

## Read-Only Counts

| Area | Count |
| --- | ---: |
| Companies | 2 |
| Users | 23 |
| Active users | 16 |
| Roles | 13 |
| Permissions | 66 |
| Role permissions | 825 |
| Job statuses | 9 |
| Customers | 1,339 |
| Vehicles | 1,376 |
| Service categories | 24 |
| Service groups | 27 |
| Vehicle makes | 45 |
| Vehicle models | 204 |
| Products | 1,366 |
| Services | 613 |
| Packages | 84 |
| Inspections | 726 |
| Estimates | 1,502 |
| Job orders | 1,481 |
| Invoices | 1,356 |
| Payments | 1,338 |
| Deposits | 4 |
| Quick sales | 301 |
| Expenses | 116 |
| Petty cash | 38 |
| Camera events | 15 |
| `auth.can_login` permission | 1 |
| Primary company | 1 |
| Active inspection checklist templates | 1 |

## Observations

- Core migrated data is present in Neon.
- Auth/RBAC seed data is present.
- The `auth.can_login` permission exists.
- A primary company exists.
- An active inspection checklist template exists.
- Newly added Phase 4 compatibility modules have corresponding data where the original schema supports them:
  - expenses
  - petty cash
  - camera events

## Non-Blocking Advisory

The PostgreSQL adapter emitted an SSL advisory:

- Current `sslmode=require` handling is treated similarly to `verify-full`.
- Future `pg` / `pg-connection-string` behavior may change.
- Before production, confirm the preferred Neon SSL connection string policy. If keeping current strict behavior, consider explicit `sslmode=verify-full`; if using libpq compatibility semantics, follow the provider guidance for `uselibpqcompat=true&sslmode=require`.

## Remaining Smoke Coverage

This smoke test confirms direct Prisma/Neon read access only. It does not replace browser workflow QA.

Recommended next checks:

- Login through the copied UI using a real test user.
- Verify dashboard cards against Neon data.
- Exercise the inspection-to-payment workflow in the browser.
- Verify report print routes with real records.
- Verify RBAC-denied and RBAC-allowed screens.

