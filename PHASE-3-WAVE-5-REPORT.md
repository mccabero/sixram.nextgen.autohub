# Phase 3 Wave 5 Report: Users, Roles, and Void Codes

Date: 2026-06-13

## Scope

Wave 5 completed the administrative API layer for user management and operation void-code generation. Role CRUD was already migrated in an earlier admin/RBAC wave and was validated again as part of this wave.

## Implemented Endpoints

### Users

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/{id}`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`
- `GET /api/users/by-email?email=...`
- `GET /api/users/pin-availability?pin=...&excludeUserId=...`
- `POST /api/users/change-password-by-email`

### Void Codes

- `GET /api/administrators/void-codes?take=...`
- `POST /api/administrators/void-codes`

### Roles

Already present and validated:

- `GET /api/roles`
- `POST /api/roles`
- `GET /api/roles/{id}`
- `PUT /api/roles/{id}`
- `DELETE /api/roles/{id}`

## Files Added

- `src/server/users/service.ts`
- `src/server/users/route-helpers.ts`
- `src/server/void-codes/service.ts`
- `src/server/void-codes/route-helpers.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/users/by-email/route.ts`
- `src/app/api/users/pin-availability/route.ts`
- `src/app/api/users/change-password-by-email/route.ts`
- `src/app/api/administrators/void-codes/route.ts`

## Behavioral Notes

- User responses preserve the legacy DTO shape with camelCase JSON fields.
- User responses do not return `PasswordHash`, `Salt`, `PinHash`, or `PinSalt`.
- User detail/list responses include:
  - primary role summary,
  - `roleName`,
  - `roleDescription`,
  - assigned `roles` from `UserRoles`.
- User email lookup uses case-insensitive PostgreSQL matching to emulate typical SQL Server collation behavior.
- User create hashes both password and PIN with the existing PBKDF2 helper.
- Missing user PIN falls back to legacy default `111111`, then still goes through PIN availability validation.
- PIN availability checks verify the provided PIN against stored PIN hashes instead of comparing plaintext.
- User update can replace assigned secondary roles transactionally.
- `POST /api/users/change-password-by-email` remains public to match the legacy `[AllowAnonymous]` endpoint.
- Void-code generation:
  - creates a random 6-digit code,
  - avoids duplicates among active unused codes,
  - stores hash/salt and suffix,
  - stores the legacy `CodeValue` for administrator history compatibility,
  - returns the full code only from generation/history routes protected by administrator void-code permission.
- Void-code service also includes server-side resolve/consume helpers for later operation VOID/unlock routes.

## Authorization

Routes use the existing route permission catalog:

- `/api/users*` requires `page.administrator.user_accounts.view`
- `/api/administrators/void-codes*` requires `page.administrator.void_codes.view`
- `DELETE` also requires `auth.can_delete`
- `POST /api/users/change-password-by-email` is intentionally public through the existing public API exception list.

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 5 and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database with cleanup:

- Created a smoke-test role.
- Created a smoke-test user with hashed password and PIN.
- Verified user lookup by ID.
- Verified user lookup by email using different casing.
- Verified user list includes the smoke user.
- Verified credential hash fields are not present in user response payloads.
- Verified PIN availability detects the user's PIN and honors `excludeUserId`.
- Updated user profile fields, password, PIN, and assigned roles.
- Changed the user's password through the public email-based compatibility endpoint.
- Generated a void code.
- Verified the void code appears in recent history as `ACTIVE`.
- Resolved the active void code.
- Consumed the void code.
- Verified the consumed code no longer resolves and history shows `USED`.
- Removed temporary user-role, user, role, and void-code rows.

Runtime note:

- The Neon smoke test emitted the PG adapter advisory about current `sslmode=require` behavior changing in future `pg` versions. The smoke checks passed and cleanup completed.

## Deferred Items

- Full operation VOID/unlock endpoint integration is deferred to Wave 6, but the server-side void-code resolve/consume helpers are ready for that work.
- User delete follows direct legacy delete semantics; linked operation records can still block deletion through foreign-key constraints.
- Password reset token endpoints from the internal legacy service are not controller endpoints and were not added in this wave.

## Recommended Next Wave

Proceed to Phase 3 Wave 6: Operations Core.

Recommended first Wave 6 batch:

- Inspection read/summary/next-reference endpoints.
- Inspection create/update/delete after the read paths are validated.
- Estimate read/summary/next-reference endpoints after inspections are stable.
