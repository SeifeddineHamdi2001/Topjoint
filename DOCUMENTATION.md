# Top Joint — E-commerce Platform Documentation

**Project:** `topjoint-web` · version `0.1.0`
**Documented:** 5 November 2026, from a full read of the source tree
**Scope:** everything under `topjoint-web/` (storefront, admin panel, API, database, operations)

This document describes **what the code actually does**, not what it was meant to do. Where the
original design notes (`PLAN.md`) and the implementation have drifted apart, the drift is called out
in [§24](#24-design-drift-and-roadmap).

---

## Contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Quick start](#3-quick-start)
4. [Architecture](#4-architecture)
5. [Project layout](#5-project-layout)
6. [Data model](#6-data-model)
7. [Money pricing and delivery](#7-money-pricing-and-delivery)
8. [Storefront](#8-storefront)
9. [Cart and checkout](#9-cart-and-checkout)
10. [Orders and cash on delivery](#10-orders-and-cash-on-delivery)
11. [Quote requests](#11-quote-requests)
12. [Admin panel](#12-admin-panel)
13. [Dashboard metrics](#13-dashboard-metrics)
14. [Meta Pixel and Conversions API](#14-meta-pixel-and-conversions-api)
15. [Server Actions reference](#15-server-actions-reference)
16. [HTTP API reference](#16-http-api-reference)
17. [File storage and uploads](#17-file-storage-and-uploads)
18. [Authentication and security](#18-authentication-and-security)
19. [Shop settings](#19-shop-settings)
20. [Environment variables](#20-environment-variables)
21. [Database operations](#21-database-operations)
22. [Deployment](#22-deployment)
23. [Code review findings](#23-code-review-findings)
24. [Design drift and roadmap](#24-design-drift-and-roadmap)
25. [Verification status](#25-verification-status)
26. [Glossary](#26-glossary)
- [Appendix A — Seeded catalogue](#appendix-a--seeded-catalogue)
- [Appendix B — Status labels](#appendix-b--status-labels)
- [Appendix C — Route map](#appendix-c--route-map)

---

## 1. Overview

Top Joint is a Tunisian industrial-gasket workshop (head gaskets, motorcycle/scooter gaskets, flat
industrial gaskets, custom cutting). `topjoint-web` is its bilingual e-commerce site plus a private
back-office.

**Two surfaces, one deployment:**

| Surface | Language | Purpose |
|---|---|---|
| Storefront `/fr`, `/ar` | French + Arabic (RTL) | Browse the catalogue, order standard parts **cash on delivery**, or send a quote request for custom work |
| Admin `/admin` | French only | Process quote requests, call and confirm orders, manage products and shop settings, manage staff accounts |

**Key characteristics**

- No customer accounts and no online payment. Checkout collects name, phone and address; the shop
  calls the customer to confirm, then ships and collects cash.
- Prices, stock, delivery fee and Meta tracking credentials are all editable from the admin — no
  redeploy needed.
- Two admin roles: a single **owner** (from `.env`, full access) and any number of **staff**
  accounts (orders only).
- Arabic is a first-class locale: every string is translated, layouts mirror with CSS logical
  properties, and Arabic fonts are baked into the same font stacks.
- Product photos and quote attachments are stored on the server's disk, outside `public/`.

---

## 2. Tech stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 16.x | App Router, React Server Components, Server Actions, `proxy.ts` (the Next 16 replacement for `middleware.ts`) |
| UI runtime | React | 19.3 | `useActionState` for all forms |
| Language | TypeScript | 5.9 | `strict: true`, path alias `@/* → src/*` |
| Styling | Tailwind CSS | 3.4 | Theme ported 1:1 from the Stitch design template |
| Database | PostgreSQL | 14+ (Docker image: 18-alpine) | Enum statuses, case-insensitive `ILIKE` search |
| ORM | Prisma | 6.19 | Versioned migrations in `prisma/migrations` |
| Auth | `jose` (JWT) + `node:crypto` scrypt | — | Signed HttpOnly cookie, no auth library |
| Icons | Material Symbols Outlined | web font | Loaded from Google Fonts at runtime |
| Fonts | Geist, Hanken Grotesk, Cairo, IBM Plex Sans Arabic | `next/font` | Latin + Arabic in the same stacks |
| Images | `sharp` | 0.35 | Present as a dependency; not directly imported |
| Dev tooling | `tsx` | 4.23 | Runs `prisma/seed.ts` |

**Toolchain observed on this machine:** Node `v24.18.0`, npm `11.16.0`.

There is **no test framework, no linter config and no CI** in this project (see
[§23](#23-code-review-findings)).

---

## 3. Quick start

### Prerequisites

- Node.js 20+ (24 is what this checkout runs on)
- PostgreSQL 14+, local or remote — **or** Docker for the bundled database

### Steps

```bash
cd topjoint-web
npm install
cp .env.example .env        # then edit DATABASE_URL, ADMIN_*, AUTH_SECRET
npm run db:up               # optional: PostgreSQL 18 on localhost:5434 via Docker
npm run setup               # prisma migrate deploy + seed 44 products
npm run dev                 # http://localhost:3000
```

| URL | What |
|---|---|
| `http://localhost:3000/` | Redirects to `/fr` or `/ar` based on the browser's `Accept-Language` |
| `http://localhost:3000/fr` | French storefront |
| `http://localhost:3000/ar` | Arabic storefront |
| `http://localhost:3000/admin` | Admin login if no session; dashboard if owner |

### npm scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Development server with HMR |
| `build` | `prisma generate && next build` | Regenerate the Prisma client, then build |
| `start` | `next start` | Serve the production build |
| `db:up` | `docker compose up -d db` | Start the local PostgreSQL container |
| `db:migrate` | `prisma migrate dev` | Create + apply a migration after editing `schema.prisma` (dev only) |
| `db:deploy` | `prisma migrate deploy` | Apply pending migrations (production/CI) |
| `db:seed` | `tsx prisma/seed.ts` | Upsert the 41 seed products; safe to re-run |
| `db:studio` | `prisma studio` | Browse/edit data in a browser |
| `setup` | `prisma migrate deploy && tsx prisma/seed.ts` | First-run database bootstrap |

### Editor launch profiles

`.claude/launch.json` defines two profiles: `topjoint-dev` (`npm run dev -- -p 3001`) and
`topjoint-prod` (`next start -p 3002`).

---

## 4. Architecture

```
   Storefront browser (fr / ar)                   Admin browser (fr)
             │                                           │
             │ RSC navigation + Server Actions           │ RSC navigation + Server Actions
             ▼                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 — Node runtime                                                │
│                                                                          │
│  src/proxy.ts         locale redirect  ·  admin session gate  ·  staff    │
│                       path allow-list                                    │
│                                                                          │
│  src/app/[lang]/*     public pages       src/app/[lang]/actions.ts       │
│  src/app/admin/*      admin pages        src/app/admin/actions.ts        │
│  src/app/api/*        search · uploads · admin files · Meta CAPI         │
│                                                                          │
│  src/lib/*            db · auth · session · storage · settings · meta     │
│  src/config/*         site · catalog · delivery · admin (status maps)     │
│  src/i18n/*           fr.ts (source of truth) · ar.ts (typed copy)        │
└───────────────┬───────────────────────────────────┬──────────────────────┘
                │ Prisma 6                          │ node:fs
                ▼                                   ▼
       PostgreSQL "topjoint"              storage/public    product photos
       (6 tables, 2 enums)                storage/private   quote attachments
```

### Rendering strategy

- Almost every page is `export const dynamic = "force-dynamic"` — catalogue, product page, checkout,
  dashboard, admin lists — because prices, stock, settings and counters must always be fresh. There
  is no ISR and no caching layer to invalidate.
- `generateStaticParams()` exists only for the two locales (`/fr`, `/ar`); `dynamicParams = false`
  makes any other first segment (e.g. `/de`) a 404.
- Data flows downward from async Server Components into small Client Components (`useCart`,
  `SearchBox`, `ProductBuyBox`, `CheckoutView`, admin forms).
- Mutations are Server Actions in exactly two files: `src/app/[lang]/actions.ts` (public) and
  `src/app/admin/actions.ts` (authenticated).
- After admin mutations, `revalidatePath("/", "layout")` invalidates the whole tree; public form
  submissions call `revalidatePath("/admin", "layout")` so the sidebar badges refresh.

### Request routing order

`src/proxy.ts` runs before every page request (matcher skips `/api`, `/_next` and any path containing
a dot):

1. Path starts with `/admin`:
   - `/admin/login` passes through.
   - No valid session cookie → redirect to `/admin/login`.
   - Staff role on a path outside `/admin/commandes*` and `/admin/impression*` → redirect to
     `/admin/commandes`.
2. First segment is `fr` or `ar` → serve.
3. Otherwise → redirect to the preferred locale (`ar` if `Accept-Language` starts with `ar`,
   otherwise `fr`), preserving the rest of the path.

---

## 5. Project layout

```
topjoint-web/
├── prisma/
│   ├── schema.prisma              6 models, 2 enums
│   ├── seed.ts                    41 demo products from public/products/*
│   └── migrations/                4 versioned SQL migrations
├── public/products/p01…p41.jpg    seed photos (~130 KB each, ~5.6 MB total)
├── storage/                       runtime uploads (git-ignored)
│   ├── public/                    product photos served via /api/uploads
│   └── private/                   quote attachments, admin-only
├── src/
│   ├── proxy.ts                   Next 16 edge-style gate (locale + admin)
│   ├── app/
│   │   ├── globals.css            Tailwind layers, .field / .field-label, RTL fixes
│   │   ├── [lang]/
│   │   │   ├── layout.tsx         <html lang dir>, fonts, metadata, CartProvider, pixel
│   │   │   ├── page.tsx           home: hero, stats, categories, featured, services,
│   │   │   │                      banner, why-us, process, contact + quote form
│   │   │   ├── actions.ts         submitQuote · placeOrder
│   │   │   ├── not-found.tsx      bilingual 404
│   │   │   ├── produits/page.tsx  catalogue: search, filters, sort, pagination
│   │   │   ├── produits/[slug]/page.tsx   product sheet
│   │   │   └── commande/page.tsx  checkout page
│   │   ├── admin/
│   │   │   ├── layout.tsx         admin <html> shell, robots noindex
│   │   │   ├── actions.ts         every admin mutation (19 actions)
│   │   │   ├── login/page.tsx     login form
│   │   │   ├── (panel)/layout.tsx sidebar, badges, logout
│   │   │   ├── (panel)/page.tsx   dashboard
│   │   │   ├── (panel)/commandes/{page.tsx,[id]/page.tsx}
│   │   │   ├── (panel)/demandes/{page.tsx,[id]/page.tsx}
│   │   │   ├── (panel)/produits/{page.tsx,[id]/page.tsx,nouveau/page.tsx}
│   │   │   ├── (panel)/equipe/page.tsx
│   │   │   ├── (panel)/reglages/page.tsx
│   │   │   └── impression/commande/[id]/page.tsx   printable delivery slip
│   │   └── api/
│   │       ├── search/route.ts            live search JSON
│   │       ├── uploads/[name]/route.ts    public product photos
│   │       ├── admin/files/[name]/route.ts authenticated quote attachments
│   │       └── meta/event/route.ts        browser → server Conversions API relay
│   ├── components/
│   │   ├── Icon.tsx               Material Symbols wrapper + RTL flip
│   │   ├── site/                  Header, Footer, Logo, MobileMenu, LangSwitch,
│   │   │                          ProductCard, SearchBox, QuoteForm, MetaPixel,
│   │   │                          MetaViewContent
│   │   ├── cart/                  CartProvider, CartDrawer, CartButton, AddToCart,
│   │   │                          ProductBuyBox, CheckoutView
│   │   └── admin/                 ActionForm, ConfirmButton, ListControls,
│   │                              PrintButton, ProductForm, SelectAll, StatusBadge
│   ├── config/
│   │   ├── site.ts                brand, phones, e-mail, locales
│   │   ├── catalog.ts             joint types, applications, CC options, price formatting
│   │   ├── pricing.ts             cart quantity tiers
│   │   ├── delivery.ts            delivery fee rule
│   │   └── admin.ts               status label maps, stock rules, date/URL helpers
│   ├── i18n/{fr.ts,ar.ts,index.ts}
│   └── lib/
│       ├── db.ts                  Prisma singleton + search/unique-violation helpers
│       ├── auth.ts                scrypt hashing, authenticate, requireAdmin/Owner
│       ├── session.ts             JWT sign/verify, cookie options, staff path rule
│       ├── storage.ts             upload validation/save/read/delete
│       ├── settings.ts            DB-backed shop settings with defaults
│       └── meta.ts                Conversions API: hashing, events, Purchase
├── docker-compose.yml             PostgreSQL only (not the app)
├── next.config.ts                 12 MB Server Action body limit
├── tailwind.config.ts             full Stitch colour/spacing/type scale
├── tsconfig.json                  strict, `@/*` alias
├── .env / .env.example            secrets and DB URL
├── PLAN.md                        original design intent / roadmap
└── README.md                      short operator quick-start
```

---

## 6. Data model

Defined in `prisma/schema.prisma`, applied by six migrations:

| Migration | Adds |
|---|---|
| `20261030121203_init` | `QuoteRequest`, `Product`, `Order`, `OrderItem`, enums, indexes |
| `20261030174649_admin_tier1` | `Order.stockDeducted`, `QuoteRequest.handledAt`, `OrderEvent` |
| `20261030180234_cod_delivery_staff` | `NO_ANSWER` + `RETURNED` statuses, `deliveryMillimes`, `callAttempts`, `lastCallAt`, `OrderEvent.actor`, `Setting`, `StaffUser` |
| `20261030181434_meta_purchase_on_confirm` | `Order.metaVisitor` (JSONB), `Order.metaPurchaseSentAt` |
| `20261107183000_catalog_variants` | `Product.application`, `ProductThickness` (priced épaisseurs), `Order.discountMillimes`; drops `material`/`thicknesses` |
| `20261107193000_combo_products` | `Product.kind`, `comboCulasseId`, `comboChemiseId` (self-relations) |
| `20261107203000_combo_thickness_varchar` | Expands `ProductThickness.mm` and `OrderItem.thickness` to `VARCHAR(30)` for combo thickness combinations |

### Relations

```
Product 1 ──── * OrderItem * ──── 1 Order 1 ──── * OrderEvent
   (nullable — a deleted product keeps the line)      (timeline)

QuoteRequest (standalone)      Setting (key/value)      StaffUser (standalone)
```

```
┌───────────────────────────┐         ┌──────────────────────────────┐
│ Product                   │         │ Order                        │
│ ref, slug (unique)        │         │ customerName, phone, address │
│ nameFr/Ar, descFr/Ar      │         │ locale, deliveryMillimes     │
│ category, application     │         │ totalMillimes, status        │
│ dimensions, compatibility │         │ stockDeducted, callAttempts  │
│ cc, base priceMillimes    │         │ metaVisitor JSON             │
│ priceMillimes, stock      │         │ metaPurchaseSentAt           │
│ image, featured, active   │         └───────┬──────────┬───────────┘
└──────────┬────────────────┘                 │          │
           │ 0..1                             │ 1..*     │ 1..*
           ▼                                  ▼          ▼
     ┌───────────────┐                 ┌────────────┐ ┌─────────────┐
     │ OrderItem     │                 │ OrderItem  │ │ OrderEvent  │
     │ ref, name     │                 │ unitPrice  │ │ status?     │
     │ thickness?    │                 │ quantity   │ │ message     │
     │ unitPrice     │                 └────────────┘ │ actor?      │
     └───────────────┘                                └─────────────┘
```

### `QuoteRequest` — homepage quote/contact form

| Field | Type | Notes |
|---|---|---|
| `name`, `company?`, `email`, `phone` | VarChar | `company` optional; all trimmed and length-capped server-side |
| `subject` | VarChar(40) | One of `devis-sur-mesure`, `commande-standard`, `grande-serie`, `autre` |
| `message` | Text | Up to 5 000 chars |
| `locale` | VarChar(2) | `fr` or `ar`, the language the visitor used |
| `attachmentName` | VarChar(255) | Original file name, shown in the admin |
| `attachmentPath` | VarChar(64), unique | Stored file name (`<uuid>.<ext>`) inside `storage/private` |
| `status` | `QuoteStatus` | `NEW → IN_PROGRESS → QUOTED → CLOSED` |
| `adminNote` | Text | Internal note |
| `handledAt` | Timestamptz? | First time the request left `NEW`; feeds the average response time |

Indexes: `(status, createdAt)`, `(createdAt)`.

### `Product`

| Field | Type | Notes |
|---|---|---|
| `ref` | VarChar(40), unique | e.g. `JM-001`; upcased on save |
| `slug` | VarChar(120), unique | `slug(nameFr)-slug(ref)` |
| `nameFr`, `nameAr` | VarChar(200) | Both required |
| `descriptionFr`, `descriptionAr` | Text | Default `""` |
| `category` | VarChar(40) | Joint type: `culasse`, `chemise`, `chaudier`, `carter`, `marine` |
| `application` | VarChar(20) | `automobile`, `moto` or `marine`; default `automobile` |
| `kind` | VarChar(20) | `standard` or `combo`; default `standard` |
| `comboCulasseId?`, `comboChemiseId?` | Int? | For a combo, the linked standard culasse and chemise products (`ON DELETE SET NULL`) |
| `dimensions` | VarChar(200) | Free text, shown on the product sheet |
| `compatibility` | VarChar(200) | Vehicle/machine, searchable |
| `cc` | Int? | Engine displacement: `50`, `125` or `150` |
| `priceMillimes` | Int | **Base price** (used when the product has no `ProductThickness` row) |
| `stock` | Int, default 0 | `0` is shown as "sur commande", not "out of stock" |
| `image` | VarChar(300) | `/products/…` or `/api/uploads/<uuid>.<ext>` |
| `featured` | Bool | Shown on the homepage (max 4) |
| `active` | Bool | `false` hides it everywhere |

Indexes: `(category, active)`, `(application, active)`, `(kind, active)`, `(comboCulasseId)`,
`(comboChemiseId)`, `(active, featured)`, `(cc)`.

The material is no longer a column: it is written in `descriptionFr` / `descriptionAr` when the
product is created.

### `ProductThickness`

One row per selectable épaisseur, with its own price:

| Field | Type | Notes |
|---|---|---|
| `productId` | Int | Cascades with the product |
| `mm` | VarChar(10) | e.g. `"0.8"`; unique per product |
| `priceMillimes` | Int | Unit price for this épaisseur |
| `position` | Int | Display order in the admin and on the product page |

When a product has at least one row, the customer must choose an épaisseur and the chosen row's price
is used for the cart line. Combo products define their own priced épaisseurs (e.g. `0.8` or compound `0.8 + 0.5`
reflecting culasse and chemise thicknesses). Each épaisseur has its own selling price.

### Combo products

A combo is a normal `Product` row with `kind = "combo"`, its own ref, name, price, stock, image and
description, plus two links:

- `comboCulasseId` → a standard product whose `category` is `culasse`;
- `comboChemiseId` → a standard product whose `category` is `chemise`.

Each combo has its own priced épaisseurs (`ProductThickness`). When viewing a combo, the customer chooses
the épaisseur (e.g. joint culasse épaisseur and joint chemise épaisseur), and the unit price updates in
real-time according to the selected épaisseur. If a combo has components with thicknesses but no explicit
`ProductThickness` rows defined, the storefront automatically derives the available thicknesses from its
components.

It is sold as **one article**: one cart line, one quantity counted toward the volume tiers, one order
item. When a combo is ordered and the order is confirmed, stock is deducted from the combo **and** from
both component products (and restored if the order is cancelled/deleted).

### `Order`

| Field | Type | Notes |
|---|---|---|
| `customerName`, `phone`, `address` | VarChar | Required at checkout |
| `email?` | VarChar(160) | **Never collected by the current checkout UI** |
| `city?` | VarChar(120) | Legacy — no longer asked |
| `note?` | Text | Not collected at checkout; visible on the slip if set |
| `locale` | VarChar(2) | Checkout language |
| `deliveryMillimes` | Int | Included in `totalMillimes` |
| `discountMillimes` | Int | Quantity discount, already subtracted from `totalMillimes` |
| `totalMillimes` | Int | Discounted items + delivery |
| `status` | `OrderStatus` | See the state machine in [§10](#10-orders-and-cash-on-delivery) |
| `adminNote?` | Text | Internal |
| `stockDeducted` | Bool | `true` while the items are held out of `Product.stock` |
| `callAttempts`, `lastCallAt` | Int, Timestamptz? | Confirmation-call bookkeeping |
| `metaVisitor?` | JSONB | IP, UA, `_fbp`, `_fbc`, checkout URL — for the Purchase match |
| `metaPurchaseSentAt?` | Timestamptz? | Claim flag so the Purchase is sent at most once |

Indexes: `(status, createdAt)`, `(createdAt)`.

### `OrderItem`

Snapshot of what was bought so history survives product edits/deletes: `ref`, `name` (French),
`thickness`, `unitPriceMillimes` (chosen épaisseur price, before cart-level discounts), `quantity`.
`productId` is `ON DELETE SET NULL`; `orderId` cascades. Indexes on both.

### `OrderEvent`

Append-only timeline rendered on the order page: optional `status`, free-text `message` (≤300),
`actor` (admin name/e-mail, `null` for customer/system), `createdAt`. Index `(orderId, createdAt)`.

### `Setting`

`key` (PK, ≤60) · `value` (≤500) · `updatedAt`. All values are strings; numeric ones are parsed on
read. Keys are listed in [§19](#19-shop-settings).

### `StaffUser`

`name`, `email` (unique), `passwordHash` (`salt:hash` in hex), `active`, `lastLoginAt`,
`createdAt`. Staff can only reach orders and delivery slips.

### Enums

| `QuoteStatus` | Meaning |
|---|---|
| `NEW` | Just submitted, untouched |
| `IN_PROGRESS` | Opened by the owner |
| `QUOTED` | Quote sent |
| `CLOSED` | Done / archived |

| `OrderStatus` | Meaning |
|---|---|
| `NEW` | Placed on the site, waiting for the confirmation call |
| `NO_ANSWER` | Called, customer unreachable |
| `CONFIRMED` | Customer confirmed by phone — items now held out of stock |
| `SHIPPED` | Handed to the courier |
| `DELIVERED` | Delivered and paid |
| `RETURNED` | Refused / returned by the customer — stock restored |
| `CANCELLED` | Cancelled — stock restored |

---

## 7. Money pricing and delivery

### Millimes

The Tunisian dinar has **three decimals**, and every amount in the database and in code is an
integer number of millimes:

- `85000` ⇔ `85.000 TND`
- `formatPrice(millimes)` → `"85.000"` (`src/config/catalog.ts:32`)
- The currency label differs per locale: `TND` (fr) / `د.ت` (ar)
- Admin money inputs accept both `.` and `,` and are converted with `Math.round(value * 1000)`

### Cart pricing

`src/config/pricing.ts` is shared by the browser cart and `placeOrder`. Quantities are counted across
the **whole cart** (5 pieces of three different articles = 15 pieces):

| Minimum articles | Discount |
|---|---|
| 15 | 20 % |
| 30 | 25 % |

A combo is a **separate product** created by the admin (see [§6](#6-data-model)); it is priced like
any other article and counts as one article toward the tiers. There is no automatic combo discount
anymore. The quantity discount applies to the cart subtotal (before delivery); the order stores it in
`Order.discountMillimes`.

Each cart line uses the price of the chosen `ProductThickness` (or `Product.priceMillimes` when the
product has no épaisseur). The server always recomputes the prices and discounts from the database —
a tampered cart cannot change the total.

### Delivery

`src/config/delivery.ts`:

```ts
deliveryFor(subtotal, settings) =
  settings.freeDeliveryFromMillimes > 0 && subtotal >= freeDeliveryFrom
    ? 0
    : settings.deliveryFeeMillimes
```

Defaults (`src/lib/settings.ts`): fee **7.000 TND**, no free-delivery threshold. Both are editable in
`/admin/reglages`. The threshold is evaluated against the **discounted items subtotal**, before
delivery is added.

The checkout page shows the fee for information only; `placeOrder` re-reads the settings and stores
the authoritative values on the order.

---

## 8. Storefront

### URL map

| Path | Page | Content source |
|---|---|---|
| `/fr`, `/ar` | Homepage | `src/app/[lang]/page.tsx` |
| `/{lang}/produits` | Catalogue | `src/app/[lang]/produits/page.tsx` |
| `/{lang}/produits?q=&cat=&app=&cc=&stock=&sort=&page=` | Catalogue with filters | Same page |
| `/{lang}/produits/[slug]` | Product sheet | `.../produits/[slug]/page.tsx` |
| `/{lang}/commande` | Checkout (cart) | `.../commande/page.tsx` + `CheckoutView` |
| `/` | Locale redirect | `src/proxy.ts` |
| unknown path | Bilingual 404 | `src/app/[lang]/not-found.tsx` |

### Homepage

Composed of ten sections, all copy coming from the dictionary:

1. **Hero** — badge, headline (split for the orange accent), body, two CTAs, three pills, photo card
   with an "ISO 9001" chip.
2. **Stats strip** — four metrics (15 000 references, CNC/waterjet, <24 h quote, shipping).
3. **Category cards** — five cards hard-wired to the joint types (`CATEGORY_CARDS`,
   `[lang]/page.tsx:15`) with `public/products/*` images.
4. **Featured products** — the four newest `active && featured` products, ordered by `updatedAt`;
   two per row on mobile.
5. **Services** — standard catalogue vs. custom manufacturing, each with bullet lists and a CTA.
6. **Custom-manufacturing banner** — quote/call CTAs plus a decorative SVG dimension drawing.
7. **Why us** — four cards with footers.
8. **Process** — four numbered steps.
9. **Contact + quote form** (`#contact-devis`) — phone, WhatsApp, address, Google Maps embed, and the
   `QuoteForm`.
10. **Footer** — categories, service links, workshop details, legal line.

The header is fixed; `section[id]` has a 150 px `scroll-margin-top` so anchors land below it.

### Catalogue

- **Default sort**: newest first. Other sorts: price ascending/descending, name (French).
- **Search** `q` (≤100 chars): case-insensitive `contains` across `ref`, `nameFr`, `nameAr`,
  `compatibility`, `dimensions`; a purely numeric query also matches `cc` exactly.
- **Type** filter from the five joint types.
- **Article kind** filter: all articles or `Combos` (`kind=combo`).
- **Application** filter: `automobile`, `moto`, `marine`.
- **Displacement** filter: fixed `50`, `125`, `150` cc options (`cc=125,150` toggles).
- **Availability** `stock=1` (in stock) / `stock=0` (on order).
- **Pagination**: 12 products per page.
- Sidebar shows per-type, per-application and per-`cc` counts computed with `groupBy` over active
  products, plus an in-stock total. It collapses behind a "Filtres" summary on mobile and is always
  visible in the desktop sidebar.
- Active filters render as removable chips; "Effacer tout" resets.
- Combo banner linking to the ready-made combos (`?kind=combo`).
- Product grid: **2 cards per row on mobile**, 2 on tablet and 3 on wide screens; card images are
  forced to a 1:1 aspect ratio.
- Empty state message when nothing matches.

### Product sheet

- Breadcrumb, large image, reference chip, type, stock badge (`En stock` / `Sur commande`).
- Spec tiles: displacement, offered épaisseurs, compatibility, dimensions, application — only
  non-empty ones.
- `ProductBuyBox` (see [§9](#9-cart-and-checkout)) with one price per épaisseur.
- Three perks (shipping, cash payment, technical advice).
- Custom-manufacturing CTA back to the homepage form.
- Technical characteristics table (including the price of each épaisseur) + description.
- A combo product shows its two component joints (with links and prices), the separate-price total and
  the saving.
- For a standard culasse/chemise, combos that include this product are shown as a cross-sell.
- Up to 3 related products from the same type (or other combos), newest first.

`generateMetadata` sets the product name as page title; inactive/missing slugs 404.

### Search

`SearchBox` is a client component used in the header, the mobile menu and the catalogue form:

- Debounced 200 ms, aborts the previous request, fires from 2 characters.
- Opens a listbox with up to 6 results: thumbnail, localized name, ref, `cc`, price.
- Keyboard support: ↑/↓ to move, Enter to open the highlighted result, Escape to close.
- Footer row "Voir tous les résultats (n)" links to the catalogue with `?q=`.
- Enter with no selection submits the surrounding `<form>` if there is one, otherwise navigates to
  the catalogue.

### Bilingual and RTL rules

- All visible copy lives in `src/i18n/fr.ts` (source of truth) and `src/i18n/ar.ts`.
  `Dictionary` is derived from `fr` with widened string literals, so **a missing or extra Arabic key
  is a TypeScript error** — parity is enforced at compile time.
- `<html lang dir>` is set in `src/app/[lang]/layout.tsx`; Arabic gets `dir="rtl"`.
- Layout uses logical utilities (`ms-`, `pe-`, `start-`, `text-start`), so it mirrors automatically.
- Directional icons flip with the `flip` prop → `.flip-rtl { transform: scaleX(-1) }`.
- Letter-spacing is forced to `0` inside `[dir="rtl"]` because tracking breaks Arabic letter joining.
- The language switch rewrites the first path segment and keeps the query string.
- Prices keep Latin digits and are rendered inside `dir="ltr"` spans where mixed with Arabic.
- The 404 page shows both languages, since `not-found.tsx` receives no `params`.

---

## 9. Cart and checkout

### Cart state

`src/components/cart/CartProvider.tsx` — a React context persisted to `localStorage`:

| Aspect | Behaviour |
|---|---|
| Storage key | `topjoint-cart-v3` |
| Line identity | `` `${productId}:${thickness}` `` — the same gasket in two thicknesses is two lines |
| Quantity bounds | 1…999 (clamped on add, on `setQty`, on manual entry and on merge) |
| Stored fields | product id, slug, ref, both names, joint type, application, kind, unit price, image, thickness, `cc`, qty |
| Derived | `count`, `subtotalMillimes`, `tierDiscountMillimes`, `discountMillimes`, `totalMillimes` |
| Side effects | `add()` fires the Meta `AddToCart` event and opens the drawer unless `openDrawer: false` |
| Persistence | Loaded once on mount, written on every change, wrapped in `try/catch` |

### Adding to the cart

Three entry points share the same rules:

- `AddToCart` (product cards): thickness `<select>` with the price of each épaisseur, `QtyStepper`
  (− / + **and a manually typed number**), inline validation when no thickness is chosen.
- `ProductBuyBox` (product page): price of the selected épaisseur, épaisseur buttons showing their own
  price, quantity tier reminder, `QtyStepper`, "Ajouter au panier" and "Acheter maintenant"
  (adds then routes to checkout without opening the drawer).
- Buy-now skips the drawer but still stores the line.

When a product offers épaisseurs, one **must** be chosen — both the client and `placeOrder` enforce it,
and the chosen row's price is used. A combo product has its own price and is added as one line.

### Cart drawer

Right-side panel in French, left in Arabic (`end-0`, translate on `rtl`). Shows line unit price,
quantity stepper, line total, subtotal, quantity discount, total, cash-payment note, checkout CTA and
"continue shopping". Combo lines carry a "Combo" badge. Escape closes it; body scroll is locked while
open.

### Checkout

`/{lang}/commande` renders `CheckoutView` with the current delivery settings.

Form fields: **name, phone, address** (no e-mail, no city, no note) plus hidden `locale` and a hidden
JSON array of `{productId, qty, thickness}`.

Client-side display: line list, subtotal, quantity discount, delivery (or "Offerte"),
free-delivery progress hint, total. These figures are **display only** — the Server Action recomputes
them.

On success the view shows the order number, clears the cart and fires the browser `Purchase`.

### `placeOrder` — the authoritative path

1. Trim/cap `customerName`, `phone`, `address`; require all three.
2. Validate the phone against `/^[+\d][\d\s().-]{6,19}$/`.
3. Parse the hidden JSON, keep lines with an integer `productId` and `1 ≤ qty ≤ 999`.
4. Re-fetch those products **with `active: true`**; drop unknown/inactive ids.
5. Reject an épaisseur the product does not offer (and require one when options exist); use that
   row's `priceMillimes` as the unit price.
6. Run `priceCart` over all lines (quantity tiers counted across the cart) and store
   `discountMillimes`.
7. Read shop settings → `deliveryMillimes`; `total = discountedSubtotal + delivery`.
8. Capture `metaVisitor` from headers/cookies (`x-forwarded-for`/`x-real-ip`, user-agent, `_fbp`,
   `_fbc`) and the checkout URL.
9. Create the order + its items + the first `OrderEvent` (`Commande passée sur le site`) in one
   nested write.
10. `revalidatePath("/admin", "layout")`, then `after(() => sendOrderPurchase(order.id))`.
11. Return `{ status: "success", orderId, valueMillimes }`.

Failures return a stable error code (`required` / `phone` / `empty` / `server`) that the UI maps to
localized copy.

---

## 10. Orders and cash on delivery

### State machine

```
   NEW ──(call: confirmed)──► CONFIRMED ──► SHIPPED ──► DELIVERED
    │                           │             │
    │                           │             └──► RETURNED
    │                           └──► CANCELLED
    ├──(call: no answer)──► NO_ANSWER ──(recall)──► CONFIRMED / CANCELLED
    └──(call: cancelled)──► CANCELLED
```

| From | Statuses reachable from the order page |
|---|---|
| `NEW` | `NO_ANSWER`, `CONFIRMED`, `CANCELLED` (or any value picked in the select) |
| `NO_ANSWER` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED`, `RETURNED` |
| `DELIVERED`, `RETURNED`, `CANCELLED` | Terminal in practice — the select still allows any value |

The status `<select>` on the order page accepts **any** status; the quick buttons only offer the next
sensible steps.

- `deliverySteps` (`src/config/admin.ts:25`) drives the quick buttons:
  `CONFIRMED → SHIPPED | CANCELLED`, `SHIPPED → DELIVERED | RETURNED`.
- `toConfirmStatuses = ["NEW", "NO_ANSWER"]` — these show the call panel and the sidebar badge.
- `lostStatuses = ["CANCELLED", "RETURNED"]` — excluded from revenue figures.

### Stock rules

`stockHoldingStatuses = ["CONFIRMED", "SHIPPED", "DELIVERED"]`.

| Transition | Stock effect |
|---|---|
| Into `CONFIRMED` from `NEW`/`NO_ANSWER` | Items subtracted, `stockDeducted = true` |
| `CONFIRMED → SHIPPED → DELIVERED` | No change (already deducted) |
| Out of those three into `CANCELLED`/`RETURNED`/`NO_ANSWER`/`NEW` | Items added back, `stockDeducted = false` |
| Delete order while `stockDeducted` | Items added back before deletion |

Subtraction uses `GREATEST(stock - qty, 0)` so stock can never go negative. All of this happens in a
single `db.$transaction`.

**Stock is not enforced at checkout.** A product with `stock = 0` stays purchasable and is presented
as "sur commande"; this is intentional for made-to-order gaskets, but it means orders can exceed
stock. The dashboard's low-stock panel is the compensating control.

### Recording a confirmation call

`recordCall` takes an `outcome` plus an optional 200-character note:

| Outcome | New status | Event message |
|---|---|---|
| `confirmed` | `CONFIRMED` | "client joint, commande confirmée" |
| `no_answer` | `NO_ANSWER` | "pas de réponse" |
| `cancelled` | `CANCELLED` | "client joint, commande annulée" |

Every call increments `callAttempts`, stamps `lastCallAt`, and appends `Appel n°N : …` to the
timeline.

### Timeline events

`changeOrder` appends an `OrderEvent` for each observable change: status transition
(`Statut : A → B`), stock movement, delivery-fee change, note edit, call attempt. Recent events are
rendered newest-first on the order page.

### Delivery slip

`/admin/impression/commande/[id]` (also `/admin/impression` is on the staff allow-list) — an
A4-friendly, printer-styled page with the logo, company contacts, customer block, item table,
subtotal/delivery/total, and two signature lines ("paiement à la livraison", "signature du livreur").
A `PrintButton` calls `window.print()`.

---

## 11. Quote requests

### Public submission

`QuoteForm` (homepage `#contact-devis`) → `submitQuote`:

1. **Honeypot**: a hidden `website` field. If filled, the action returns success without touching the
   database (bots see no error).
2. Validate required `name`, `email`, `phone`, `message`, and a `subject` from the four allowed keys.
3. Regex checks: e-mail `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`, phone `/^[+\d][\d\s().-]{6,19}$/`.
4. Optional attachment: must pass `isAcceptable(file, "private")` (≤10 MB, extension whitelist), then
   is written to `storage/private` under a UUID name.
5. Insert the row with status `NEW` and the visitor's `locale`.
6. `revalidatePath("/admin", "layout")` so the sidebar badge increments.
7. On any failure the uploaded file is deleted again and `{ error: "server" }` is returned.

The form resets after success and shows a localized confirmation message.

### Admin handling

- **List** `/admin/demandes`: tabs per status, free-text search over name/company/e-mail/phone/message,
  subject filter, date range, 25 per page. Rows show language and a paperclip when a file exists.
- **Detail** `/admin/demandes/[id]`:
  - Opening a `NEW` request immediately moves it to `IN_PROGRESS` and stamps `handledAt` (see the
    caveat in [§23](#23-code-review-findings)).
  - Shows the message in its original direction, the attachment download link, and the customer block.
  - One-click **WhatsApp** (`wa.me`, adding `216` to 8-digit numbers), **call**, and **e-mail**
    (pre-filled subject `Votre demande #N — Top Joint`).
  - Internal note (≤5 000 chars) + status form.
  - Delete removes the row and its attachment.

`handledAt` is only stamped the first time a request leaves `NEW`; the dashboard's average response
time is computed from it.

---

## 12. Admin panel

### Roles

Two roles, one JWT claim (`role: "owner" | "staff"`).

| Capability | Owner | Staff |
|---|---|---|
| Dashboard, quotes, products, settings, team | ✔ | ✘ |
| Orders list + order detail | ✔ | ✔ |
| Change order status / note / delivery fee | ✔ | ✔ |
| Record confirmation calls | ✔ | ✔ |
| Print delivery slips | ✔ | ✔ |
| Delete an order | ✔ | ✘ |
| Delete a product / quote | ✔ | ✘ |

Strict enforcement points:

1. `src/proxy.ts` — redirects staff away from any `/admin` path outside the allow-list.
2. `requireOwner()` inside every owner page and every owner action (the real check).
3. `requireAdmin()` in the panel layout, the order page, and every order action.

A deactivated staff account is rejected on the next request even with a valid cookie, because
`requireAdmin` re-reads `StaffUser.active`.

### Navigation

The panel layout renders a sidebar with counters:

| Item | Owner only | Badge |
|---|---|---|
| Tableau de bord | ✔ | — |
| Demandes de devis | ✔ | count of `NEW` |
| Commandes | ✘ | count of `NEW` + `NO_ANSWER` |
| Produits | ✔ | — |
| Équipe | ✔ | — |
| Réglages | ✔ | — |

The sidebar footer shows the signed-in name/e-mail, a link to the live site and a logout form. On
mobile it becomes a horizontal scrolling bar.

### Pages

| Page | What it does |
|---|---|
| `/admin` | KPI dashboard (see [§13](#13-dashboard-metrics)) |
| `/admin/demandes` | Quote inbox with tabs, search, subject filter, date range, pagination |
| `/admin/demandes/[id]` | Quote detail, status + note, contact shortcuts, attachment, delete |
| `/admin/commandes` | Orders table: checkbox column, bulk status change, search by name/phone/e-mail/address/`#id`, status tabs, date range, revenue sum, call/print shortcuts |
| `/admin/commandes/[id]` | Call panel, delivery buttons, item table, status/note/delivery form, timeline, customer card, delete (owner) |
| `/admin/produits` | All products with inline stock edit, sortable headers, filters (search/type/state), bulk show/hide/feature, "Nouveau" |
| `/admin/produits/[id]` | Edit form (type, application, CC, priced épaisseurs), live link, delete |
| `/admin/produits/nouveau` | Empty form |
| `/admin/equipe` | Owner account row + staff list (activate/deactivate, reset password, delete) and a create form |
| `/admin/reglages` | Logo upload/reset, delivery fee, free-delivery threshold, Meta pixel ID, CAPI token, test event code |
| `/admin/impression/commande/[id]` | Printable delivery slip |
| `/admin/login` | E-mail + password form |

### Product management details

- Required: `ref` (upcased), `nameFr`, `nameAr`, a valid joint type (`culasse`, `chemise`,
  `chaudier`, `carter`, `marine`), a valid application (`automobile`, `moto`, `marine`) and a
  non-negative base price.
- `kind` is `standard` (default) or `combo`. A combo requires one existing standard product of type
  `culasse` and one of type `chemise`; it is saved as a separate article with its own ref, name,
  price, stock and description. The "Nouveau combo" button opens the form with the combo fields
  already selected, and the product list has a `Combos` filter.
- `cc` is chosen from `50`, `125`, `150` or left empty.
- Épaisseurs are managed as repeated `mm` / `mmPrice` rows: each row has its own price, rows can be
  added/removed, duplicates are rejected and a product can have up to 20. The material goes in the
  description fields.
- `slug` is regenerated from `nameFr` + `ref` on every save.
- Photo upload accepts JPG/PNG/WEBP ≤10 MB; the previous uploaded photo is deleted when replaced.
- Bulk actions: show, hide, feature, unfeature.
- Inline stock edit per row (never negative).
- The list loads **all** matching products (no pagination) — fine at 44 products, worth revisiting at
  scale.

### Login

- One form for both roles. Owner credentials come from `ADMIN_EMAIL`/`ADMIN_PASSWORD`; staff
  credentials are scrypt-verified against `StaffUser`.
- Wrong credentials return "Identifiants incorrects." after a fixed 600 ms delay.
- Owner → `/admin`, staff → `/admin/commandes`.
- The session cookie is `tj_admin`, HttpOnly, SameSite=Lax, Secure in production, 12 h TTL.

---

## 13. Dashboard metrics

`src/app/admin/(panel)/page.tsx`. Period selector: **7 jours / 30 jours (default) / 12 mois**.
All date maths is done in `Africa/Tunis` (UTC+1, no DST) by shifting UTC timestamps.

| KPI | Definition | Caveat |
|---|---|---|
| **Chiffre d'affaires** | `SUM(totalMillimes)` for orders created in the period, excluding `CANCELLED`/`RETURNED` | Includes `NEW`/`NO_ANSWER`, i.e. orders not yet confirmed — treat as *potential* revenue |
| **Commandes** | Count of the same order set | Same caveat |
| **Panier moyen** | Revenue ÷ order count | — |
| **Taux de confirmation** | Among orders that have been called (`decided` = everything except `NEW`/`NO_ANSWER`), the share not `CANCELLED` | `RETURNED` counts as confirmed, since the customer did confirm before returning |
| **Demandes traitées** | Share of quotes created in the period that reached `QUOTED` or `CLOSED`, plus the average `handledAt − createdAt` | Average is over all handled quotes created in the period |

Each KPI shows a period-over-period delta (same-length preceding window; "nouveau" when the previous
window was zero).

Other panels:

- **Sales chart** — one bar per day (or per month for 12 m), revenue height-scaled, hover tooltip with
  revenue and order count; excludes lost statuses.
- **Meilleures ventes** — top 5 `OrderItem.ref` by revenue in the period, with quantity.
- **À traiter** — quotes `NEW` older than 24 h; orders `NEW` older than 2 h; orders `NO_ANSWER` whose
  last call was 3 h+ ago; orders `CONFIRMED` not shipped for 2 days.
- **Stock faible** — active products with `stock ≤ 5` (max 8 shown), "Tout voir" links to
  `/admin/produits?state=low&sort=stock`.
- **Dernières demandes / commandes** — six most recent of each with status badges.
- **Quick banners** — unread quote and new-order counts linking to the filtered lists.

`LOW_STOCK = 5` and `PAGE_SIZE = 25` live in `src/config/admin.ts`.

---

## 14. Meta Pixel and Conversions API

Implemented by `src/components/site/MetaPixel.tsx` (browser) and `src/lib/meta.ts` (server).

### Events

| Event | Where it is fired | Browser | Server (CAPI) |
|---|---|---|---|
| `PageView` | Pixel init + every client-side navigation | ✔ | — |
| `ViewContent` | Product sheet mount (`MetaViewContent`) | ✔ | ✔ via `/api/meta/event` |
| `AddToCart` | `CartProvider.add()` | ✔ | ✔ via `/api/meta/event` |
| `InitiateCheckout` | Checkout mount, once the cart is loaded | ✔ | ✔ via `/api/meta/event` |
| `Purchase` | After a successful `placeOrder` + server-side `sendOrderPurchase` | ✔ | ✔ directly, not relayed |

### De-duplication

Both sides use the same `event_id`:

- Funnel events: a UUID generated in `trackMeta`.
- Purchase: `` `order-${orderId}` `` — the browser uses it explicitly, the server builds it the same
  way, so Meta counts one Purchase.

`/api/meta/event` deliberately **refuses** `Purchase`; the server entry point is the only sender of
the authoritative amount.

### Server matching data

`user_data` is built from the order's stored visitor plus the phone/name, hashed with SHA-256 where
required: `client_ip_address`, `client_user_agent`, `fbp`, `fbc`, `ph`, `fn`, `ln`, and
`country = sha256("tn")`. Phone numbers are reduced to digits, with `216` prepended to 8-digit local
numbers.

### Configuration

`/admin/reglages` → pixel ID, CAPI access token, optional test event code. Tracking is **off** unless
both the pixel ID and the token are present. The token is stored in the `Setting` table, is never sent
back to the browser, and the form keeps the saved value when the field is left blank.

### Failure behaviour

- Every CAPI call times out after 5 s and never throws; failures are logged to the server console.
- `sendOrderPurchase` first claims the order (`metaPurchaseSentAt IS NULL → now()`) so two rapid
  status changes cannot double-send.
- On rejection it clears the claim, but **nothing schedules a retry** (see
  [§23](#23-code-review-findings)).
- If the pixel script has not loaded yet, `ViewContent` and `InitiateCheckout` wait 1.5 s.

### Enabling it

1. Meta Events Manager → Data sources → your pixel → Settings → copy the pixel ID.
2. Same page → Conversions API → generate an access token.
3. Paste both into `/admin/reglages`, save. Status chips turn to "actif"/"active".
4. Optionally set a `TEST…` code to watch events in the Test events tab, then clear it.

---

## 15. Server Actions reference

All actions are `"use server"` and validate their own inputs. None relies on the proxy alone for
authorization.

### Public — `src/app/[lang]/actions.ts`

| Action | Inputs | Auth | Effect |
|---|---|---|---|
| `submitQuote` | name, company?, email, phone, subject, message, attachment?, locale, honeypot `website` | none | Validates, stores a private attachment, inserts `QuoteRequest` (`NEW`), revalidates admin |
| `placeOrder` | name, phone, address, locale, items JSON | none | Rebuilds the cart from the database, applies the quantity pricing and delivery, creates `Order` + `OrderItem[]` + first `OrderEvent`, schedules the Meta Purchase |

Both return `{ status: "idle" \| "success" \| "error", error?, orderId?, valueMillimes? }`.

### Admin — `src/app/admin/actions.ts`

| Action | Guard | Effect |
|---|---|---|
| `login` | — | Authenticates, sets the cookie, redirects by role; 600 ms delay on failure |
| `logout` | — | Deletes the cookie, redirects to `/admin/login` |
| `updateQuote` | owner | Sets status + note; stamps `handledAt` on first non-`NEW` |
| `deleteQuote` | owner | Deletes the row and its private attachment |
| `updateOrder` | owner/staff | Status, note, delivery fee; recalculates total; writes timeline events |
| `recordCall` | owner/staff | Confirmation-call outcome + optional note; increments counters |
| `setOrderStatus` | owner/staff | One-click status change keeping note and delivery |
| `bulkSetOrderStatus` | owner/staff | Applies one status to every ticked order (max 200, sequential) |
| `deleteOrder` | owner | Restores held stock, deletes the order (items/events cascade) |
| `saveProduct` | owner | Create/update product incl. slug, application/CC, priced épaisseurs, optional photo; replaces the variant rows |
| `deleteProduct` | owner | Deletes product + uploaded photo; `OrderItem.productId` becomes null |
| `updateStock` | owner | Inline stock edit |
| `bulkUpdateProducts` | owner | show / hide / feature / unfeature |
| `saveSettings` | owner | Logo upload/removal, delivery + Meta settings; blank token keeps the stored one, `removeToken` clears it |
| `createStaff` | owner | Validates, hashes password (≥8 chars), rejects owner e-mail and duplicates |
| `toggleStaff` | owner | Activate/deactivate |
| `resetStaffPassword` | owner | New scrypt hash (≥8 chars) |
| `deleteStaff` | owner | Removes the account |

`changeOrder` is the internal helper shared by the order actions: it wraps stock movement, total
recalculation, the status write and event generation in one transaction.

---

## 16. HTTP API reference

| Method | Route | Auth | Query / body | Response |
|---|---|---|---|---|
| `GET` | `/api/search` | public | `q` (≥2 chars, ≤100), `lang=fr\|ar` | `{ total, results[{slug, ref, name, image, price, cc, inStock}] }`, max 6 results ordered by `featured` first |
| `GET` | `/api/uploads/[name]` | public | `<uuid>.<ext>` | Image bytes, `Cache-Control: public, max-age=31536000, immutable`; 404 otherwise |
| `GET` | `/api/admin/files/[name]` | any valid admin session | `<uuid>.<ext>` | Attachment bytes with `Content-Disposition: attachment; filename*=UTF-8''<original>`, `private, no-store`; 401/404 |
| `POST` | `/api/meta/event` | public, same-origin | `{ name, id, url, customData? }` | `204`; `400` for unknown event names, `Purchase`, missing/oversized `id` (>64) or a cross-origin `url` |

The Meta relay runs the CAPI call in `after()`, so the browser never waits for Facebook.

---

## 17. File storage and uploads

`src/lib/storage.ts`.

| Bucket | Directory | Who writes | Allowed extensions | Public? |
|---|---|---|---|---|
| `public` | `storage/public` | Product photo upload (owner) | `.jpg .jpeg .png .webp` | Yes, via `/api/uploads/<name>` |
| `private` | `storage/private` | Quote attachment (visitor) | `.pdf .dxf .dwg .step .stp .jpg .jpeg .png .webp` | No, admin session required |

- Maximum size: **10 MB** per file; Next's Server Action body limit is raised to 12 MB in
  `next.config.ts` to leave headroom for multipart overhead.
- Stored names are always `<uuid>.<ext>`; `readUpload`/`deleteUpload` only accept
  `/^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/`, which blocks path traversal.
- Downloads use an explicit content-type map; unknown extensions fall back to
  `application/octet-stream`.
- Files live **outside `public/`** because Next only serves `public/` content that existed at build
  time.
- `storage/` is git-ignored and must be included in backups.

---

## 18. Authentication and security

### Sessions

- HS256 JWT signed with `AUTH_SECRET` (must be ≥32 chars; enforced at sign/verify time).
- Payload: `sub` (e-mail), `name`, `role`; 12 h expiry.
- Cookie `tj_admin`: HttpOnly, SameSite=Lax, Secure in production, path `/`.
- No refresh tokens and no server-side session store; revoking a *staff* account takes effect on the
  next request because the role is re-checked against the database.

### Passwords

- Owner: plaintext in `.env`, compared with `timingSafeEqual` after a length check.
- Staff: `scrypt(password, random 16-byte salt, 64)` stored as `salt:hash` hex, verified in constant
  time. Minimum 8 characters, enforced in the UI and the action.

### Guards

| Guard | Applies to |
|---|---|
| `proxy.ts` | All page requests: locale redirect, session presence, staff path allow-list |
| `requireAdmin()` | Panel layout, order detail, delivery slip, every order action |
| `requireOwner()` | Dashboard, quotes, products, settings, team, deletes |

### What is in place

- Parameterized Prisma queries and `$executeRaw` with bound values — no SQL injection surface found.
- All inputs are trimmed and length-capped before persistence.
- Upload validation by size + extension, UUID-only file names, traversal-proof reads.
- Admin routes are `noindex, nofollow`; the checkout page is `noindex`.
- Server Actions inherit Next's built-in origin checks, mitigating CSRF.
- Honeypot on the public quote form.

### What is not in place

- No login rate limiting or lockout (only a fixed 600 ms delay).
- No 2FA, no password policy beyond length, no session revocation list.
- No CSRF token (relies on Next's action protocol).
- No audit log beyond `OrderEvent.actor` on orders; quote/product/settings changes are unattributed.
- No cookie/consent banner; the Meta pixel loads automatically when configured.
- The CAPI token sits in plaintext in the `Setting` table (server-readable only).

---

## 19. Shop settings

`src/lib/settings.ts` — a typed wrapper over the `Setting` key/value table, editable at
`/admin/reglages`.

| Key | Type | Default | Used by |
|---|---|---|---|
| `deliveryFeeMillimes` | integer millimes | `7000` (7.000 TND) | Checkout display, `placeOrder`, delivery fee input |
| `freeDeliveryFromMillimes` | integer millimes | `0` (= never) | `deliveryFor`, checkout hint |
| `logoImage` | upload path | `""` (built-in mark) | Header, footer, admin sidebar, delivery slip, settings preview |
| `metaPixelId` | numeric string (6–20 digits) | `""` | `<MetaPixel>` render gate |
| `metaAccessToken` | string | `""` | CAPI calls only |
| `metaTestEventCode` | string | `""` | `test_event_code` in CAPI payloads |

Reads merge the stored rows over the typed defaults and ignore malformed numbers; unknown keys are
ignored. Writes go through `db.$transaction` of `upsert`s.

---

## 20. Environment variables

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✔ | `postgresql://topjoint:topjoint@localhost:5434/topjoint?schema=public` | Prisma datasource |
| `ADMIN_EMAIL` | ✔ | `admin@topjoint.tn` | Owner login |
| `ADMIN_PASSWORD` | ✔ | `change-me` | Owner password (plaintext, compared in constant time) |
| `AUTH_SECRET` | ✔ | long random string | JWT signing key, **≥32 characters** |
| `NODE_ENV` | auto | `production` | Enables the `Secure` cookie flag |

Startup does **not** validate `.env`; a missing `AUTH_SECRET` throws on the first login attempt
(`AUTH_SECRET must be set (32+ characters)`), and a bad `DATABASE_URL` surfaces as a Prisma
connection error on the first query.

---

## 21. Database operations

### Local

```bash
npm run db:up        # PostgreSQL 18 container, host port 5434
npm run db:migrate   # after editing schema.prisma (creates a migration)
npm run db:seed      # upsert the 41 seed products
npm run db:studio    # visual data browser
```

### Production

```bash
npm run db:deploy    # prisma migrate deploy — no schema prompts
```

### Backup and restore

The database **and** `storage/` must be backed up together — attachments are referenced by filename
only.

```bash
# Backup
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
tar czf storage-$(date +%F).tar.gz storage/

# Restore
pg_restore -d "$DATABASE_URL" --clean --if-exists backup-YYYY-MM-DD.dump
tar xzf storage-YYYY-MM-DD.tar.gz
```

### Notes

- `prisma/dev.db` is a leftover SQLite file from an early prototype. The datasource is PostgreSQL and
  nothing reads this file — it can be deleted.
- Timestamps are `timestamptz(3)`; all display formatting uses `Africa/Tunis`.
- Enum changes require a migration; Postgres cannot add several enum values and use them in one
  transaction on old versions (already handled by the dedicated migration).

---

## 22. Deployment

### Recommended: a VPS

1. Node.js 20+ and PostgreSQL 14+ installed (or a managed database).
2. `npm ci` (or `npm install`) — this also runs `prisma generate` through the build step.
3. Set the four environment variables (see [§20](#20-environment-variables)).
4. `npm run db:deploy` then `npm run build`.
5. `npm start` behind nginx/Caddy over HTTPS, supervised by PM2 or systemd.
6. Persist `storage/` on a real volume, owned by the app user, writable.

**Reverse-proxy requirements:** forward `X-Forwarded-For` (Meta matching and CAPI use it) and allow
request bodies up to ~12 MB. Serve over HTTPS so the `Secure` cookie is set and
`crypto.randomUUID` is available.

### Vercel caveat

Local-disk storage does **not** work on serverless: quote attachments and admin photo uploads would be
lost, and the default filesystem is read-only apart from `/tmp`. To deploy on Vercel you must first
replace `src/lib/storage.ts` with object storage (S3/R2/Vercel Blob) and keep the same
`saveUpload`/`readUpload`/`deleteUpload` contract. Database-wise, Neon/Supabase work unchanged.

### Docker

`docker-compose.yml` provides **only** PostgreSQL (port 5434, user/password/db all `topjoint`, named
volume `pgdata`). The application itself is not containerized; a production Dockerfile would need to
copy `prisma/` and `public/`, run `prisma migrate deploy` at boot, and mount `storage/`.

### Post-deploy checklist

- [ ] `AUTH_SECRET` is ≥32 random characters and not the example value
- [ ] `ADMIN_PASSWORD` changed from the default
- [ ] HTTPS terminates in front of the app
- [ ] `storage/` exists, is writable, and is in the backup job
- [ ] `pg_dump` + `storage/` backup scheduled
- [ ] Meta pixel/token entered in `/admin/reglages` (if running ads)
- [ ] Real brand phone/WhatsApp/address set in `src/config/site.ts`
- [ ] Seed placeholder prices replaced with real ones

---

## 23. Code review findings

Verified by reading every source file and running `tsc --noEmit` (clean). Ordered by impact.

| # | Severity | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| 1 | **Medium** | Opening a quote **mutates the database during render**. In App Router, `<Link>` prefetch can render this page without a human visit, so requests may flip to "En cours" on their own and `handledAt` is stamped wrongly | `src/app/admin/(panel)/demandes/[id]/page.tsx:16-20`; links in `demandes/page.tsx:66,69` | Move the transition to an explicit action ("Marquer comme vu") or a client `useEffect` POST, and keep render pure |
| 2 | **Medium** | No login rate limiting. Only a fixed 600 ms delay guards the owner password | `src/app/admin/actions.ts:23-26` | Add IP+account throttling at the proxy or in the action; consider a lockout counter |
| 3 | **Medium** | Uploads are on the app server's local disk, which breaks on serverless and depends entirely on volume + backup discipline | `src/lib/storage.ts:10,32-39`; README "Where things are" | Abstract the bucket behind an interface and add an S3/R2 driver before any Vercel deployment |
| 4 | **Medium** | Meta Purchase is claimed (`metaPurchaseSentAt`) **before** the network call; if the process dies mid-call the claim stays set and the event is lost. The code comment promises a retry that no caller implements (`sendOrderPurchase` is only invoked once, from `placeOrder`) | `src/lib/meta.ts:100-131`; only caller `src/app/[lang]/actions.ts:126` | Add a retry job/admin button for `metaPurchaseSentAt = null` orders, or claim after a successful send with an idempotency key |
| 5 | **Low** | "Chiffre d'affaires" includes unconfirmed `NEW`/`NO_ANSWER` orders, so the headline figure can overstate collected revenue | `src/app/admin/(panel)/page.tsx:105` | Label it "CA potentiel" or add a confirmed-only variant |
| 6 | **Low** | Stock is never checked at checkout and confirmation clamps at 0, so overselling is silent | `src/app/[lang]/actions.ts:94-104`; `src/app/admin/actions.ts:75` | Warn when `qty > stock`, or record the shortfall as an event |
| 7 | **Low** | `saveProduct` reports "Cette référence existe déjà." for **any** unique violation, including the slug | `src/app/admin/actions.ts:239-241` | Inspect `err.meta.target` and report the right field |
| 8 | **Low** | Bulk order status runs up to 200 separate transactions; a large courier update is slow and partially applied on error | `src/app/admin/actions.ts:148-154` | One transaction, or a single `updateMany` + batched stock adjustment |
| 9 | **Low** | The hero image points at a Google-hosted (`lh3.googleusercontent.com`) URL that can expire or be rate-limited | `src/app/[lang]/page.tsx:11` | Ship the image in `public/` |
| 10 | **Low** | The quantity tiers (15/20 %, 30/25 %) are constants in `src/config/pricing.ts`, not editable in the admin | `src/config/pricing.ts:12-18` | Move them to `Setting` rows if marketing wants to change them without a deploy |
| 11 | **Low** | No `sitemap.xml`, `robots.txt`, per-page canonical/hreflang or OpenGraph images; only root-level `alternates` | `src/app/[lang]/layout.tsx:27-36` | Use Next's `sitemap.ts`/`robots.ts` and per-page metadata |
| 12 | **Low** | `crypto.randomUUID()` requires a secure context; on plain-HTTP LAN deployments with the pixel enabled, `trackMeta` would throw during add-to-cart | `src/components/site/MetaPixel.tsx:32` | Guard with `globalThis.crypto?.randomUUID` and a fallback id |
| 13 | **Low** | Order e-mail, city and note columns exist but the checkout never collects them, so they are always empty | `src/components/cart/CheckoutView.tsx` form fields; `prisma/schema.prisma:83-86` | Add optional fields or drop the columns |
| 14 | **Info** | No tests, no linter, no CI, no git repository in `topjoint-web/` — regressions rely on manual checks | whole project | Add Vitest/Playwright for the money + order-status logic first, then GitHub Actions running `tsc` + build |
| 15 | **Info** | Quote attachments are downloadable by **any** authenticated session (staff included); only UUID unguessability protects them | `src/app/api/admin/files/[name]/route.ts:10` | Require `role === "owner"` for the private bucket |
| 16 | **Info** | Admin product list has no pagination (loads every match) | `src/app/admin/(panel)/produits/page.tsx:42` | Add `take/skip` when the catalogue grows |
| 17 | **Info** | `prisma/dev.db` (SQLite, 94 KB) is a stale artifact; the app uses PostgreSQL | `prisma/dev.db` | Delete it |

---

## 24. Design drift and roadmap

### Where the code stands vs. `PLAN.md`

| `PLAN.md` claim | Reality |
|---|---|
| Catalogue filters: category + **material** | Material was dropped (it belongs in the description); filters are now joint type, application (automobile/moto/marine), displacement (50/125/150 cc) and availability |
| Admin pages: dashboard, quotes, orders, products | Adds **Équipe** (staff accounts), **Réglages** (settings), and printable **delivery slips** |
| Admin auth: single `.env` account | Adds a full staff tier with scrypt hashes and order-only permissions |
| Phase 1: cash-on-delivery orders | Implemented, plus call tracking, stock holding, bulk status updates and an order timeline |
| Phase 2: payment, notifications, accounts, SEO | Still open — but **Meta Pixel + Conversions API** was implemented ahead of the plan |
| Deploy: VPS or Vercel | Disk storage makes Vercel a code change, not just a config change (see [§22](#22-deployment)) |

### Suggested next steps

1. Fix findings 1–4 above; they affect data correctness, not cosmetics.
2. Add tests around `priceCart`, `deliveryFor`, and the `changeOrder` stock transitions — the three
   places where a bug costs money.
3. Owner notifications on new quotes/orders (Resend/SMTP + WhatsApp Cloud API).
4. Online payment (Konnect / Flouci / ClicToPay), with the COD path kept as an option.
5. SEO pack: `sitemap.ts`, `robots.ts`, per-product metadata, OpenGraph images, `hreflang` per page.
6. Real content: replace `src/config/site.ts` placeholders, seed prices/stock, workshop photos; upload
   the real logo in `/admin/reglages` (the built-in mark is drawn in `src/components/site/Logo.tsx`).
7. Object storage driver if hosting moves to a serverless platform.
8. A lightweight audit trail for quote/product/settings changes, mirroring `OrderEvent`.

---

## 25. Verification status

What was actually run while writing this document:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **Passes**, exit code 0, no diagnostics |
| `TODO`/`FIXME`/`HACK` markers in `src/` | None found |
| Source files read | All 65 TS/TSX files under `src/`, `prisma/schema.prisma`, `prisma/seed.ts`, migrations, and every config file |
| `prisma migrate status` | Not verifiable here: the Prisma CLI needs to copy its engine binary into `node_modules`, which this environment's file sandbox blocks. Run it locally where the project owns its `node_modules` |
| Production build | Not run (needs a reachable PostgreSQL and writes `.next/`) |
| Runtime smoke test | Not run (no database in this environment) |

**Conclusion:** the codebase is type-consistent and internally coherent; the open items are behavioural
and operational, not compile-time.

---

## 26. Glossary

| Term | Meaning |
|---|---|
| **Millime** | 1/1000 of a Tunisian dinar; every amount is stored as an integer millime |
| **TND** | Tunisian dinar (`د.ت` in Arabic) |
| **COD** | Cash on delivery — the only payment method |
| **Devis** | Quote / quotation for custom manufacturing |
| **Bon de livraison** | Delivery slip printed for the courier |
| **Épaisseur** | Gasket thickness in mm, selectable per product |
| **Cylindrée (cc)** | Engine displacement used to match gaskets to vehicles |
| **Joint de culasse** | Head gasket |
| **Joint d'embase / chemise** | Cylinder base / sleeve gasket |
| **Joint chaudier** | Boiler / heater gasket |
| **Joint carter** | Crankcase gasket |
| **Joint marine** | Marine engine gasket |
| **Combo** | A ready-made article joining one culasse gasket + one chemise gasket of the same model |
| **RSC** | React Server Components (default in the App Router) |
| **Server Action** | A server function callable directly from a form/component |
| **CAPI** | Meta Conversions API — server-side ad-event delivery |
| **`fbp` / `fbc`** | Meta browser cookies used to match ad clicks to purchases |
| **RTL / LTR** | Right-to-left (Arabic) / left-to-right layout direction |

---

## Appendix A — Seeded catalogue

`prisma/seed.ts` upserts **44 products** built from `public/products/p01…p41.jpg`, all with
`stock = 10` and placeholder prices:

| Group | Photos | Ref prefix | Type | Application | Base price | Featured |
|---|---|---|---|---|---|---|
| Labelled head gaskets (Majesty, X-Max, Liberty, SH, DTR, Sunis, Dayun, Ovetto…) | 1–5, 7–13 | `JM-0xx` | `culasse` | `moto` | 14.000 TND | 1, 3, 7 |
| Unlabelled head gaskets | 6, 14–24, 40 | `JM-0xx` | `culasse` | `moto` | 12.000 TND | — |
| Twin-cylinder head gaskets | 25–29 | `JC-0xx` | `culasse` | `automobile` | 28.000 TND | 25 |
| Cylinder base gaskets | 30–34, 36–39 | `JE-0xx` | `chemise` | `automobile` | 4.500 TND | — |
| Engine-crankcase gasket | 35 | `JP-035` | `carter` | `automobile` | 6.500 TND | — |
| Exhaust sealing rings (set) | 41 | `JD-041` | `carter` | `automobile` | 3.500 TND | — |
| Boiler gasket | 38 | `JG-101` | `chaudier` | `automobile` | 18.000 TND | — |
| Outboard marine gasket | 40 | `JN-101` | `marine` | `marine` | 22.000 TND | — |
| Combo culasse + chemise (`JC-025` + `JE-030`) | 25 | `CB-001` | `culasse` | `automobile` | 30.500 TND | ✔ |

Head-gasket groups get priced épaisseurs `0.8` (base), `1.0` (base + 1 TND) and `1.2` (base + 2 TND);
chemise gaskets get `0.5` / `0.8`; the chaudier and marine examples have two priced épaisseurs each.
The seeded combo `CB-001` joins `JC-025` and `JE-030` at 30.500 TND (32.500 TND bought separately).
Slugs are `slug(nameFr)-slug(ref)`; re-running the seed is safe (upsert by `ref`), but it **overwrites**
price/stock/épaisseur/combo edits made in the admin.

---

## Appendix B — Status labels

### Quote statuses (`src/config/admin.ts`)

| Key | French label |
|---|---|
| `NEW` | Nouveau |
| `IN_PROGRESS` | En cours |
| `QUOTED` | Devis envoyé |
| `CLOSED` | Clôturé |

### Order statuses

| Key | French label |
|---|---|
| `NEW` | À confirmer |
| `NO_ANSWER` | Injoignable |
| `CONFIRMED` | Confirmée |
| `SHIPPED` | Expédiée |
| `DELIVERED` | Livrée |
| `RETURNED` | Retournée |
| `CANCELLED` | Annulée |

### Quote subjects

| Key | French label |
|---|---|
| `devis-sur-mesure` | Devis sur mesure |
| `commande-standard` | Pièce standard |
| `grande-serie` | Grand volume / sous-traitance |
| `autre` | Autre question |

---

## Appendix C — Route map

| Route | Access | Rendering |
|---|---|---|
| `/` | Public | Redirect (locale) |
| `/{fr,ar}` | Public | Dynamic RSC |
| `/{fr,ar}/produits` | Public | Dynamic RSC |
| `/{fr,ar}/produits/[slug]` | Public | Dynamic RSC |
| `/{fr,ar}/commande` | Public | Dynamic RSC |
| `/admin/login` | Public | Client component |
| `/admin` | Owner | Dynamic RSC |
| `/admin/demandes`, `/admin/demandes/[id]` | Owner | Dynamic RSC |
| `/admin/commandes`, `/admin/commandes/[id]` | Owner + staff | Dynamic RSC |
| `/admin/produits`, `/[id]`, `/nouveau` | Owner | Dynamic RSC |
| `/admin/equipe` | Owner | Dynamic RSC |
| `/admin/reglages` | Owner | Dynamic RSC |
| `/admin/impression/commande/[id]` | Owner + staff | Dynamic RSC, print stylesheet |
| `/api/search` | Public | Route handler |
| `/api/uploads/[name]` | Public | Route handler |
| `/api/admin/files/[name]` | Admin session | Route handler |
| `/api/meta/event` | Public, same-origin | Route handler |

---

*End of document. Source of truth is the code; if the two disagree after a change, the code wins —
update this file.*
