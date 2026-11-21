# Top Joint — site e-commerce FR / AR

See [PLAN.md](PLAN.md) for the architecture and roadmap, and
[DOCUMENTATION.md](DOCUMENTATION.md) for the complete technical reference (data model, order
lifecycle, admin roles, API, deployment, known issues).

## Run locally

Needs a PostgreSQL 14+ server: either an existing one, or Docker (`npm run db:up` starts the one in `docker-compose.yml` on port 5434).

```bash
npm install
cp .env.example .env   # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD and a long AUTH_SECRET
npm run setup          # applies the migrations in prisma/migrations
npm run dev
```

Database scripts:

| Script | What it does |
|---|---|
| `npm run db:migrate` | After editing `prisma/schema.prisma`: creates a new migration and applies it (dev only) |
| `npm run db:deploy` | Applies pending migrations (production / CI) |
| `npm run db:studio` | Browse and edit the data in Prisma Studio |

- Site: http://localhost:3000/fr and http://localhost:3000/ar
- Admin: http://localhost:3000/admin (credentials from `.env`)

## Where things are

| What | File |
|---|---|
| Phone, WhatsApp, e-mail, brand name | `src/config/site.ts` |
| All French / Arabic texts | `src/i18n/fr.ts`, `src/i18n/ar.ts` |
| Joint types, applications & CC | `src/config/catalog.ts` |
| Homepage form backend | `src/app/[lang]/actions.ts` (`submitQuote`) |
| Admin pages | `src/app/admin/` |
| Database schema | `prisma/schema.prisma` |

Uploaded files are stored in `storage/` — back it up together with the database (`pg_dump`).
