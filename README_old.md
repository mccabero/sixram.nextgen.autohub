# SIXRAM NextGen AutoHub

Phase 1 foundation for migrating `sixram.nextgen.rapide` from .NET Web API and SQL Server to Next.js App Router, Route Handlers, Prisma ORM, and PostgreSQL.

## What Exists Now

- Next.js App Router shell
- Route Handler health endpoint at `/api/health`
- Prisma 7 configuration with PostgreSQL provider
- Initial Prisma scalar schema draft for 54 EF Core entities
- Server-side environment validation
- Prisma client factory for PostgreSQL adapter usage
- Auth/RBAC utility boundaries for the future route-handler migration

## Setup

```bash
npm install
copy .env.example .env
npm run db:validate
npm run db:generate
npm run dev
```

## Phase 1 Boundaries

This phase intentionally does not implement business modules yet.

Before module generation, validate the live SQL Server schema for:

- Actual singular/plural table names
- Foreign keys and delete behavior
- Existing indexes
- Decimal precision/scale
- Date/time semantics
- Runtime-created tables from the old .NET startup path

The Prisma schema is a foundation draft, not the final production migration.
