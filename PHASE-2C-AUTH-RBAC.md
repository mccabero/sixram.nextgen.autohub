# Phase 2C Auth and RBAC Foundation

Date: 2026-06-13

## Status

Phase 2C is complete for the migration foundation.

The Next.js App Router now has legacy-compatible authentication route handlers, migrated password/PIN hash verification, JWT issuing and validation, and database-backed RBAC helpers.

## Files Created or Updated

- `.env.example`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/forgot-pin/route.ts`
- `src/app/api/auth/validate/route.ts`
- `src/server/api/body.ts`
- `src/server/auth/claims.ts`
- `src/server/auth/guard.ts`
- `src/server/auth/password-hasher.ts`
- `src/server/auth/rbac.ts`
- `src/server/auth/service.ts`
- `src/server/env.ts`

## Implemented Endpoints

### `POST /api/auth/login`

Supports both legacy login modes:

- Email/password login.
- Six-digit PIN login.

Returns the legacy-compatible token response shape:

```json
{
  "accessToken": "...",
  "expiresAtUtc": "..."
}
```

### `GET /api/auth/validate`

Validates a Bearer token and confirms the user still has `auth.can_login`.

Returns:

```json
{
  "userId": 1
}
```

### `POST /api/auth/forgot-pin`

Verifies username/password, checks the new six-digit PIN is unique among active users, then updates `PinHash` and `PinSalt`.

Returns `204 No Content` on success.

## Compatibility Decisions

- Password and PIN verification uses PBKDF2-SHA256.
- Salt size is 32 bytes.
- Hash size is 32 bytes.
- Default iteration count is `100000`, matching the .NET API.
- Existing migrated `PasswordHash`, `Salt`, `PinHash`, and `PinSalt` values are preserved and verified as-is.
- New PIN hashes are generated with fresh random salts.
- JWT claims include the legacy-compatible fields:
  - `sub`
  - `email`
  - `role`
  - `role_name`
  - `given_name`
  - `family_name`
  - `middle_name`
  - .NET claim type URI equivalents for role/name/name identifier.

## RBAC Foundation

The RBAC layer now supports:

- Effective role lookup from `Users.RoleId` plus `UserRoles`.
- Effective permission lookup through `RolePermissions` and `Permissions`.
- `auth.can_login` enforcement.
- API route permission resolution.
- DELETE permission modifier through `auth.can_delete`.
- VOID action modifier through `operations.can_void`.
- Reusable route guard: `authorizeApiRequest`.

## Environment Variables

Added:

```env
JWT_EXPIRY_MINUTES="60"
PASSWORD_HASHING_ITERATIONS="100000"
```

Existing required runtime values:

```env
DATABASE_URL="..."
JWT_SECRET="..."
JWT_ISSUER="..."
JWT_AUDIENCE="..."
```

## Validation Completed

The following checks passed:

```powershell
npm run db:validate
npm run typecheck
npm run lint
npm run build
```

Additional smoke checks passed:

- PBKDF2 hash/verify round trip.
- PBKDF2 negative verification.
- JWT issue/verify/user-id extraction.
- Database-backed RBAC guard check against migrated Neon data.

## Notes and Risks

- A real `JWT_SECRET` must be supplied in Vercel/production. Do not commit it.
- Rotate the Neon password that was pasted into chat before any production-like usage.
- `POST /api/auth/forgot-pin` intentionally preserves the legacy behavior of updating only `PinHash` and `PinSalt`.
- Email matching is case-insensitive to preserve SQL Server collation behavior.
- Full middleware-wide route protection can be added after more API modules are migrated; for now the reusable guard is ready for each migrated Route Handler.

## Recommended Next Task

Proceed to Phase 3 planning: begin API module migration order, starting with low-risk reference/configuration modules before operations-heavy modules.
