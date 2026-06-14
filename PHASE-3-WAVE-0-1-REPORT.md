# Phase 3 Wave 0 and First Wave 1 Report

Date: 2026-06-13

## Status

Phase 3 Wave 0 and the non-asset Wave 1 endpoints are implemented.

Read-only asset routes are intentionally deferred until the object storage provider is selected.

## Implemented API Harness Utilities

- `src/server/api/legacy-json.ts`
- `src/server/api/errors.ts`
- `src/server/api/params.ts`
- `src/server/api/audit.ts`
- `src/server/api/uploads.ts`

The harness provides:

- Legacy JSON serialization for Date, Decimal-like values, and bigint values.
- Legacy `{ error }` response helpers.
- Safe integer/query parsing helpers.
- Current authorized user helper.
- Local upload-file helpers for read compatibility.

## Implemented Endpoints

Public read endpoints:

- `GET /api/companyinfo`
- `GET /api/companyinfo/{id}`
- `GET /api/login-settings`

RBAC bootstrap endpoints:

- `GET /api/rbac/effective-permissions`
- `GET /api/rbac/page-access`
- `GET /api/rbac`
- `POST /api/rbac/save`
- `GET /api/roles`
- `GET /api/roles/{id}`
- `POST /api/roles`
- `PUT /api/roles/{id}`
- `DELETE /api/roles/{id}`

## Compatibility Notes

`GET /api/companyinfo` and `GET /api/companyinfo/{id}` preserve the legacy PascalCase payload and include:

- `PrimaryCompany`
- `Logo`
- `LogoPath`
- `LogoUrl`

`GET /api/login-settings` preserves the legacy camelCase payload and defaults:

- `showIsChanganOption: true`
- `cameraEventCooldownSeconds: 60`
- `backgroundImageUrl: null`
- `logoUrl: null`

RBAC endpoints use the Phase 2C auth guard and require a valid Bearer token plus `auth.can_login`.

`GET /api/rbac` returns the admin RBAC snapshot expected by the legacy UI:

- `users`
- `roles`
- `permissions`
- `rolePermissions`

`GET /api/roles` returns role list records with user counts. `GET /api/roles/{id}` returns role details with `assignedUsers`.

`POST /api/rbac/save` mirrors the legacy transaction behavior:

- Updates the selected user's primary role.
- Rewrites the selected user's assigned roles.
- Upserts requested role-permission matrix entries.
- Blocks saves that would remove the actor's ability to log in and manage RBAC.

Role mutations preserve the legacy contracts:

- `POST /api/roles` returns the created role with `201`.
- `PUT /api/roles/{id}` returns `204`.
- `DELETE /api/roles/{id}` returns `204` after deleting related `UserRoles` and `RolePermissions`.
- Role delete is blocked when the role is still assigned as a primary role.

## Validation Completed

The following checks passed:

```powershell
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

DB-backed smoke checks passed against the migrated Neon development data:

- Company info list returned 2 rows.
- Company info detail returned the expected legacy fields.
- Login settings returned expected defaults.
- Effective permissions returned 66 permission keys for a can-login user.
- Page access for `/dashboard` returned `permissionKey: "page.dashboard.view"` and `allowed: true`.
- RBAC snapshot returned 23 users, 13 roles, and 66 permissions.
- Roles list returned 13 roles.
- Role detail returned assigned-user data for the selected role.
- Role create returned `201`, role update returned `204`, and role delete returned `204`.
- RBAC save returned `200` for a temporary user/role assignment.
- Smoke-test cleanup returned the role count to 13.

## Build Note

`next build` passes, but Turbopack currently reports a non-failing NFT trace warning for local upload-file compatibility used by `GET /api/login-settings`.

This should be revisited when the storage provider is selected. The likely final direction is to replace local filesystem reads with object storage URLs.

## Secret Hygiene

Secret scan passed. No Neon/source secrets were written to the repository.

## Recommended Next Task

Continue with Wave 2 configuration reference data:

1. Add a small reference-data CRUD service for simple configuration tables.
2. Add `api/config` route handlers for service categories, service groups, vehicle makes/models, product groups/categories, parameter groups/parameters, unit of measures, and job statuses.
3. Add inspection template read/activation routes with the one-active-template rule.
4. Add vehicle-model applicable product routes.
5. Keep file-backed asset endpoints deferred until object storage is selected.
