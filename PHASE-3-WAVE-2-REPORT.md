# Phase 3 Wave 2 Report

Date: 2026-06-13

## Status

Wave 2 configuration reference-data routes are implemented.

## Implemented Endpoints

Dynamic configuration resource routes:

- `GET /api/config/{resource}`
- `POST /api/config/{resource}`
- `GET /api/config/{resource}/{id}`
- `PUT /api/config/{resource}/{id}`
- `DELETE /api/config/{resource}/{id}`

Implemented resources:

- `service-categories`
- `service-groups`
- `vehicle-makes`
- `vehicle-models`
- `product-groups`
- `product-categories`
- `parameter-groups`
- `parameters`
- `unit-of-measures`
- `job-statuses`

Vehicle model support route:

- `GET /api/config/vehicle-models/{id}/applicable-products`

Inspection template routes:

- `GET /api/config/inspection-templates`
- `GET /api/config/inspection-templates/active`
- `GET /api/config/inspection-templates/{id}`
- `POST /api/config/inspection-templates`
- `PUT /api/config/inspection-templates/{id}`
- `POST /api/config/inspection-templates/{id}/activate`
- `DELETE /api/config/inspection-templates/{id}`

## Compatibility Notes

The handlers use the Phase 2C auth guard and require a valid Bearer token with `auth.can_login`.

Protected route permission follows the legacy API catalog:

- `/api/config*` requires `page.configuration.view`
- `DELETE` also requires `auth.can_delete`

Payloads are returned in camelCase. The existing frontend configuration screens already consume camelCase fields and tolerate PascalCase fallbacks.

Special behavior preserved:

- `GET /api/config/parameters?parameterGroup=...` filters by parameter group name or code.
- Parameter group filtering is case-insensitive to approximate SQL Server collation behavior.
- `POST /api/config/parameters` validates `ParameterGroupId`.
- `POST /api/config/vehicle-models` validates `VehicleMakeId`, `BodyParameterId`, and `ClassificationParameterId`.
- `GET /api/config/vehicle-models/{id}/applicable-products` returns related products with group/category/manufacturer/supplier summaries.
- Delete conflicts return `409` with a legacy-safe message.
- Inspection template reads return summary counts, layout key, revision, and groups when a detail payload is expected.
- Inspection template create/update normalizes checklist groups and items before storing `ChecklistJson`.
- Inspection template update increments `Revision` only when content changes.
- Inspection template activation and active-template deletion preserve the one-active-template rule.
- Deleting or deactivating the last available template returns `409`.

## Validation Completed

The following checks passed:

```powershell
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

DB-backed smoke checks passed against the migrated Neon development data:

- Service category list returned 24 rows before the write smoke.
- Temporary service category create returned `201`.
- Temporary service category update returned `204`.
- Temporary service category delete returned `204`.
- Service category list returned 24 rows after cleanup.
- `parameters?parameterGroup=REGION` returned 11 rows.
- Vehicle makes returned 45 rows.
- Vehicle model applicable-products route returned `200`.
- Inspection template list returned 2 rows before and after the write smoke.
- Temporary inspection template create returned `201`.
- Temporary inspection template update returned `200` and incremented the revision.
- Temporary inspection template activation returned `200`.
- Temporary active-template delete returned `204`.
- The original active template was restored after temporary-template cleanup.

## Build Note

`next build` passes. The existing non-failing Turbopack NFT trace warning remains isolated to local upload-file compatibility used by `GET /api/login-settings`.

## Remaining Phase 3 Work

Wave 2 is closed. Continue with Wave 3: customers and vehicles.

## Secret Hygiene

Secret scan passed. No Neon/source secrets were written to the repository.
