# Online Hosting Costing Document

Prepared for: SIXRAM NextGen Autohub  
Prepared date: 2026-06-14  
Currency: USD unless stated otherwise

## Purpose

This document summarizes the estimated monthly and annual costs for hosting the application online using:

- Vercel for the Next.js application
- Vercel Blob for file storage, including public and private files
- Neon for PostgreSQL database hosting
- Cloudflare Registrar for domain name registration and DNS

Prices are based on currently published vendor pricing and should be rechecked before final purchase because cloud pricing can change.

## Executive Summary

For a commercial production deployment, the recommended starting point is:

| Item | Recommended starting option | Estimated cost |
| --- | --- | ---: |
| Application hosting | Vercel Pro, 1 deploying seat | $20/month |
| Database | Neon Launch, usage-based | $8-$30/month for light production usage |
| File storage | Vercel Blob, usage-based | $0-$20/month for light to moderate file usage |
| Domain | Cloudflare Registrar | Usually annual, exact TLD price shown at checkout |

Expected initial hosting budget:

- Light production use: about $30-$70/month, plus domain registration.
- Heavier usage, larger database, or many private file downloads: about $80-$150+/month.
- Enterprise SLA, SSO, HIPAA, advanced WAF, or high traffic: custom pricing may be required.

## Important Hosting Recommendation

Do not use Vercel Hobby for the live client system. Vercel's Hobby plan is free, but it is limited to non-commercial personal use. A client-facing business application should use Vercel Pro or Enterprise.

## Vercel Application Hosting

Recommended plan: Vercel Pro.

| Cost item | Included / rate |
| --- | ---: |
| Pro platform fee | $20/month |
| Included deploying seat | 1 seat |
| Additional deploying seats | $20/month per Owner or Member seat |
| Viewer seats | Free |
| Included usage credit | $20/month |
| Fast Data Transfer included | 1 TB/month |
| Edge Requests included | 10,000,000/month |
| Vercel Function active CPU overage | Starts at $0.128/hour |
| Function invocations overage | Starts at $0.60 per 1M |
| Build minutes | Usage-based depending machine type |

Notes:

- One Vercel Pro seat is enough if only one technical owner deploys and manages the application.
- Add more paid seats only for team members who need deploy/configuration access.
- Client users do not need Vercel seats to use the application.
- Configure Vercel Spend Management before going live to avoid surprise overage bills.

## Vercel Blob Storage

Vercel Blob should be used for uploaded files such as vehicle photos, documents, receipts, reports, and other application assets.

### Public vs Private Blob Storage

| Storage type | Best for | Cost behavior |
| --- | --- | --- |
| Public Blob | Public images, vehicle photos, logos, downloadable public assets | Browser downloads directly from Blob. Usually cheaper for high-read public files. |
| Private Blob | Sensitive documents, internal records, customer documents, protected reports | Application checks authorization and streams file through a server route. Storage price is the same, but delivery can cost more because the request also uses Vercel Functions and Vercel data transfer. |

Vercel states that public and private Blob stores use the same pricing for storage, operations, and uploads. The difference is delivery: private files are usually served through a Function after authorization, which can add Function, Fast Data Transfer, and Fast Origin Transfer costs.

### Blob Pricing

| Blob item | Hobby included | Pro included | Pro overage |
| --- | ---: | ---: | ---: |
| Storage | 1 GB/month | 5 GB/month | $0.023 per GB-month |
| Simple operations | 10,000/month | 100,000/month | $0.40 per 1M |
| Advanced operations | 2,000/month | 10,000/month | $5.00 per 1M |
| Blob data transfer | 10 GB/month | 100 GB/month | Starts at $0.05 per GB |

Simple operations are typically reads/cache misses or `head()` calls. Advanced operations include `put()`, `copy()`, and `list()` calls. Delete operations are free according to Vercel's Blob pricing documentation.

### Blob Cost Examples

| Scenario | Assumption | Estimated Blob cost |
| --- | --- | ---: |
| Small | 5 GB storage, 20 GB downloads, low operations | Usually within Pro included allocation |
| Moderate public files | 50 GB storage, 350 GB downloads, 2.5M downloads, 70% cache hit | Vercel example: about $15.73/month |
| Private document-heavy use | Many protected document downloads through app routes | Higher than public delivery because Function and Vercel response transfer may also apply |

Cost control recommendations:

- Use public Blob only for non-sensitive files.
- Use private Blob for sensitive uploads and enforce authorization in Route Handlers.
- Avoid storing large videos or high-volume media in Blob without separate media/storage review.
- Keep private document downloads cached only where security policy allows.
- Monitor Blob storage, transfer, and operations from the Vercel dashboard.

## Neon PostgreSQL Database

Recommended starting plan: Neon Launch.

Neon paid plans are usage-based and have no monthly minimum base fee. Billing depends mainly on compute hours, database storage, history storage, branches, and network transfer.

| Neon item | Launch plan | Scale plan |
| --- | ---: | ---: |
| Base fee | Usage-based | Usage-based |
| Compute | $0.106 per CU-hour | $0.222 per CU-hour |
| Database storage | $0.35 per GB-month | $0.35 per GB-month |
| History storage | $0.20 per GB-month | $0.20 per GB-month |
| Included branches per project | 10 | 25 |
| Additional branches | $0.002 per branch-hour | $0.002 per branch-hour |
| Public network transfer | 100 GB included, then $0.10/GB | 100 GB included, then $0.10/GB |

### Neon Cost Examples

| Scenario | Assumption | Estimated Neon cost |
| --- | --- | ---: |
| Development / test | Free plan, low usage | $0/month, not recommended for production |
| Light production | 1 CU active about 2 hours/day, 5 GB database | About $8-$12/month |
| Small always-available production | Average 0.25 CU for 730 hours, 10 GB database | About $23-$28/month |
| Busier production | Average 1 CU for 730 hours, 20 GB database | About $85-$95/month |

Notes:

- Neon can scale compute to zero when inactive, which reduces cost.
- Keeping the database warm 24/7 increases compute cost.
- Production workloads should use paid Launch or Scale rather than Free.
- Keep preview/dev branches short-lived to avoid extra storage and branch-hour costs.

## Domain Registration with Cloudflare

Recommended registrar: Cloudflare Registrar.

Cloudflare Registrar charges domains at cost. Cloudflare states that it does not add markup to registry and ICANN fees. Domain pricing depends on the selected TLD, such as `.com`, `.net`, `.org`, `.app`, `.dev`, `.ph`, or others.

| Item | Estimated cost |
| --- | ---: |
| Common `.com` domain | Budget about $10-$15/year, exact price shown in Cloudflare checkout |
| Other TLDs | Can range from under $10/year to $80+/year depending on registry |
| Cloudflare DNS | Included |
| WHOIS privacy / redaction | Included where supported |
| SSL/TLS | Included by Cloudflare and also provided by Vercel for the deployed app |

Recommendation:

- Register the domain in the client's Cloudflare account.
- Use Cloudflare DNS records to point the domain to Vercel.
- Keep Cloudflare proxy/CDN settings reviewed before enabling, because Vercel already provides CDN, SSL, WAF, and DDoS protection. A double-CDN setup can work, but should be configured intentionally.

## Estimated Monthly Packages

### Option A: Low-Traffic Production Start

| Item | Estimate |
| --- | ---: |
| Vercel Pro, 1 deploying seat | $20/month |
| Neon Launch, light usage | $8-$12/month |
| Vercel Blob, small usage | $0-$5/month |
| Domain | About $10-$15/year for common `.com`, exact TLD dependent |
| Estimated monthly total | $28-$37/month |

Best for: initial launch, internal pilot, low traffic, limited uploads.

### Option B: Recommended Business Production

| Item | Estimate |
| --- | ---: |
| Vercel Pro, 1 deploying seat | $20/month |
| Neon Launch, small always-available production | $23-$28/month |
| Vercel Blob, public/private mixed usage | $5-$25/month |
| Domain | Annual |
| Estimated monthly total | $48-$73/month |

Best for: client-facing production system with normal business usage.

### Option C: Higher Usage / Document Heavy

| Item | Estimate |
| --- | ---: |
| Vercel Pro, 1-2 deploying seats | $20-$40/month |
| Neon Launch or Scale | $85-$150+/month depending compute |
| Vercel Blob | $25-$100+/month depending storage and private downloads |
| Domain | Annual |
| Estimated monthly total | $130-$290+/month |

Best for: higher traffic, many file downloads, larger database, or more active users.

## Not Included in These Estimates

The following may add cost later:

- Email/SMS sending provider
- Payment gateway fees
- Object storage alternatives if the application stores large videos or very high-volume files
- External monitoring, logging, or error tracking
- Vercel add-ons such as Web Analytics Plus, Speed Insights, SAML SSO, HIPAA BAA, or Observability Plus
- Backup/export tooling outside Neon defaults
- VPN, tunnel, static IP, or edge network work for private camera or Hikvision integrations
- Professional support or Enterprise contracts
- Taxes, VAT, or currency conversion fees

## Client Decision Points

Before finalizing hosting, the client should decide:

- Preferred domain name and TLD.
- Whether the application must be public internet-facing or limited to internal users.
- Expected number of users and uploaded files per month.
- Expected size and sensitivity of uploaded documents.
- Whether sensitive files must always be private.
- Whether the database should scale to zero when inactive or stay warm all day.
- Whether private cameras or local network devices need to be accessed from the hosted app.
- Required compliance, SLA, SSO, or audit logging requirements.

## Recommended Starting Decision

For the first online production release, choose:

- Vercel Pro with 1 deploying seat.
- Neon Launch with spend monitoring.
- Vercel Blob with separate public and private stores.
- Cloudflare Registrar for the domain and DNS.
- A monthly budget cap/spend alert on Vercel and Neon.

Recommended initial client budget: $50-$100/month plus annual domain registration. This gives enough room for normal early production traffic while avoiding an oversized enterprise commitment.

## Source Links

- Vercel pricing: https://vercel.com/pricing
- Vercel Pro plan: https://vercel.com/docs/plans/pro-plan
- Vercel Hobby commercial-use guidance: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel Blob pricing: https://vercel.com/docs/vercel-blob/usage-and-pricing
- Vercel Blob GA pricing announcement: https://vercel.com/blog/vercel-blob-now-generally-available
- Neon pricing: https://neon.com/pricing
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- Cloudflare domain-cost guidance: https://www.cloudflare.com/learning/dns/how-much-does-a-domain-name-cost/
