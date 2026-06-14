# Phase 3 Wave 3 Report: Customers and Vehicles

Date: 2026-06-13

## Scope

Wave 3 migrated the legacy customer and vehicle master-data APIs from the .NET Web API/MSSQL implementation to Next.js App Router route handlers backed by Prisma/PostgreSQL.

## Implemented Endpoints

### Customers

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/summary`
- `GET /api/customers/by-email?email=...`
- `GET /api/customers/{id}`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`

### Vehicles

- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/summary`
- `GET /api/vehicles/by-plate?plate=...`
- `GET /api/vehicles/by-customer/{customerId}`
- `GET /api/vehicles/{id}`
- `PUT /api/vehicles/{id}`
- `DELETE /api/vehicles/{id}`

### Legacy URL Compatibility

The legacy React frontend uses uppercase `/api/Vehicles` paths. Because Windows cannot represent both `vehicles` and `Vehicles` folders in the same workspace, compatibility is handled through Next.js rewrites:

- `/api/Vehicles`
- `/api/Vehicles/:path*`

Both rewrite to the canonical lowercase `/api/vehicles` handlers.

## Files Added

- `src/server/customers/service.ts`
- `src/server/vehicles/service.ts`
- `src/app/api/customers/route.ts`
- `src/app/api/customers/summary/route.ts`
- `src/app/api/customers/by-email/route.ts`
- `src/app/api/customers/[id]/route.ts`
- `src/app/api/vehicles/route.ts`
- `src/app/api/vehicles/summary/route.ts`
- `src/app/api/vehicles/by-plate/route.ts`
- `src/app/api/vehicles/by-customer/[customerId]/route.ts`
- `src/app/api/vehicles/[id]/route.ts`

## Files Updated

- `next.config.ts`

## Behavioral Notes

- Customer responses preserve the migrated legacy DTO shape with camelCase JSON fields.
- Vehicle responses expose both `plateNumber` and `plateNo` for compatibility with existing frontend normalization.
- Vehicle detail responses include nested customer, vehicle model, and vehicle make data.
- Customer email lookup uses case-insensitive PostgreSQL matching to emulate typical SQL Server collation behavior.
- Vehicle plate lookup uses case-insensitive PostgreSQL matching to match the legacy repository behavior.
- `PUT` and `DELETE` return `204 No Content`, matching the legacy controller contract.
- Missing records return `404`.
- Invalid query parameters return legacy-style `400` messages:
  - `email is required`
  - `plate is required`
  - `customerId is required`
- Delete conflicts return `409` with a clear linked-record message.

## Authorization

Routes use the existing API guard and RBAC permission catalog:

- `/api/customers*` requires `page.customers.view`
- `/api/vehicles*` requires `page.vehicles.view`
- `DELETE` also requires `auth.can_delete`

## Validation

Completed successfully:

- `npm run typecheck`
- `npm run db:validate`
- `npm run lint`
- `npm run build`

Build note:

- The existing Turbopack tracing warning remains for `src/server/api/uploads.ts` through the login-settings route. This warning predates Wave 3 and is tied to local upload compatibility.

## Neon Smoke Test

Completed successfully against the Neon PostgreSQL database with cleanup:

- Created a smoke-test customer.
- Read customer by ID.
- Read customer by email using different casing.
- Updated customer notes.
- Confirmed customer appears in summary.
- Created a smoke-test vehicle for that customer.
- Read vehicle by ID.
- Read vehicle by plate using different casing.
- Read vehicles by customer.
- Updated vehicle year.
- Confirmed vehicle appears in summary.
- Deleted smoke-test vehicle.
- Deleted smoke-test customer.

All smoke checks returned `true`, and temporary rows were removed.

## Deferred Items

- No file-backed asset/image endpoints were included in this wave; those remain deferred until the object storage decision.
- Operation modules that depend on customers/vehicles can now move forward in later waves.

## Recommended Next Wave

Proceed to Phase 3 Wave 4:

- Management catalog APIs for products, services, packages, suppliers, manufacturers, and inventory support routes.
- Keep operation transaction APIs for a later wave after catalog dependencies are stable.
