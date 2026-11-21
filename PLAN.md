# Top Joint — site e-commerce (FR / AR)

Built from the Stitch template in `../stitch_atelier_joints_industrial_e_commerce/`
(home, catalogue, product sheet + mobile variants, `DESIGN.md`).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Actions) | One codebase for site + API + admin |
| Styling | Tailwind CSS 3.4 with the template's exact theme config | The Stitch HTML ports almost 1:1 |
| Database | Prisma 6 + PostgreSQL, versioned migrations in `prisma/migrations` | Same engine in dev and prod; enum statuses, case-insensitive search |
| i18n | `/fr/...` and `/ar/...` routes, typed dictionaries, `dir="rtl"` for Arabic | SEO-friendly, no extra dependency |
| Admin auth | Single admin account from `.env`, signed JWT cookie (`jose`) | Simple and secure enough for one shop |
| Files | Uploads stored on disk in `storage/` (quote attachments are private) | Works on any VPS |

## Bilingual / RTL rules

- Every visible string lives in `src/i18n/fr.ts` and `src/i18n/ar.ts` (same typed shape — a missing Arabic key is a compile error).
- Layout uses logical Tailwind utilities (`ms-`, `pe-`, `start-`, `text-start`) so it mirrors automatically in Arabic; directional icons flip with `rtl:-scale-x-100`.
- Arabic fonts (Cairo / IBM Plex Sans Arabic) are fallbacks in the same font stacks; letter-spacing is disabled in RTL (it breaks Arabic letter joining).
- Products have `nameFr/nameAr` and `descriptionFr/descriptionAr`; prices stay `85.000 TND` / `85.000 د.ت`.
- Language switcher in the header keeps you on the same page.

## Pages

**Public** (`/fr`, `/ar`)
1. Accueil — hero, stats strip, categories, featured stock products, services, custom-manufacturing banner, why us, process, about, contact + **quote form**.
2. Catalogue `/produits` — search (ref / name / vehicle), category + material filters, sort, pagination.
3. Fiche produit `/produits/[slug]` — gallery, price, stock, specs, quantity + add to cart, custom-quote CTA, related products.
4. Panier & commande `/panier` — cart (stored in browser), checkout form, **paiement à la livraison** → order saved for the admin.

**Admin** (`/admin`, French)
1. Tableau de bord — counters (new quote requests, pending orders, products), latest activity.
2. Demandes de devis — every homepage form submission: list with status filter (Nouveau / En cours / Devis envoyé / Clôturé), detail view, internal note, download of the attached file, one-click WhatsApp / e-mail / call reply.
3. Commandes — orders from the cart with items, totals, status.
4. Produits — create / edit / hide products in both languages, photo upload, price, stock, featured on homepage.

## Homepage form → admin flow

```
Visitor fills form (FR or AR) ──► Server Action validates (required fields, email, phone, honeypot anti-spam, file ≤ 10 MB)
        ──► QuoteRequest row saved (status NEW, language recorded) + attachment stored privately
        ──► Success message in the visitor's language
Admin dashboard ──► "Demandes" badge shows new count ──► open, set status, add note, reply via WhatsApp/e-mail
```

## Phases

- **Phase 1 (this delivery):** everything above, seeded with the real Top Joint product photos.
- **Phase 2:** e-mail/WhatsApp notification to the owner on each new request (Resend or SMTP), online payment (Konnect / Flouci / ClicToPay), customer accounts & order tracking, SEO (sitemap, hreflang, OpenGraph), real product data entry.
- **Deploy:** VPS (Node 20+, PM2 or Docker) with PostgreSQL, or Vercel + Neon Postgres + object storage for uploads.

## Open items for the owner

- Brand name, real phone / WhatsApp / address / e-mail → all in `src/config/site.ts`.
- Real prices and Arabic product names (seed values are placeholders — edit them in the admin).
- Replace template stock photos (hero, categories) with workshop photos.
