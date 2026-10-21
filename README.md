# BOSSO Portal

Member and administrative software for the **Business of Sports Student Organization at UT Austin**.

**[Portal](https://bosso-portal.vercel.app/) · [Organization website](https://txbosso.com/)**

As Technical Director, I lead development of a centralized platform for an approximately 160-member organization. The portal brings event attendance, task assignments, documents, opportunities, and member administration into one application. Organization size describes the community served, rather than a measured active-user count.

The public source is available for review. Portal access requires membership and approval; use the documentation to understand the workflows without requesting access to organization data.

## Tech Stack

- **Framework**: Next.js 14 (App Router; see `package.json` for the declared version)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Google OAuth + Email/Password)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment template and configure a development Supabase project:
   ```bash
   cp .env.example .env.local
   ```
   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Never use production member data for a public demo. Email, calendar, and payment features require their own optional credentials.

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable React components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
└── types/              # TypeScript type definitions

scripts/
├── setup/              # Database setup SQL scripts
├── migrations/         # Database migration scripts
└── utils/              # Utility scripts (scrapers, cleanup)

public/                 # Static assets (logos, images)
```

## Features

- **Authentication**: Google OAuth and email/password signup with registration codes
- **User Roles**: General Member, Analyst, Project Manager, Board Member, Admin
- **Dashboard**: Personalized member dashboard
- **Calendar**: Event management with attendance tracking
- **Tasks**: Task assignment and tracking system
- **Documents**: Shared and personal document management
- **Applications**: Job/opportunity application tracking
- **Networking**: Contact database for industry connections
- **Resources**: Learning resources repository
- **Announcements**: Org-wide communication
- **Feedback**: Member feedback submission system
- **Admin Panel**: User management and approval system

## Architecture and access control

The browser uses Supabase Auth for identity and a public client key for permitted data access. Server routes handle privileged operations; the service-role client is explicitly server-only. Role checks and PostgreSQL row-level security govern member and administrative workflows.

```text
Member browser → Next.js pages and server routes → Supabase Auth / PostgreSQL
                                      ├────────→ Email and calendar services
                                      └────────→ Stripe checkout and webhooks
```

SQL migrations live in `supabase/migrations/`. Historical table/setup scripts live in `scripts/setup/`. These scripts document the application's evolution; a fresh database bootstrap has not yet been consolidated into a single verified migration sequence. Point local development at a prepared development database and review the [migration checklist](docs/SUPABASE-MIGRATION-CHECKLIST.md) before applying schema changes.

## Verification

```bash
npm run type-check
npm test
```

The application-checks workflow runs type checking and role-boundary tests. The separate scheduled TeamWork workflow collects opportunities. It uses Ubuntu 24.04, which is compatible with the locked Playwright version. The retired opportunities workflow referenced a command and scraper that are no longer present; TeamWork is the supported collection job.

## Historical database setup

All database setup scripts are in the `scripts/setup/` folder. Run them in your Supabase SQL editor in this order:

1. `add-role-types.sql` - Creates user role types
2. `add-signup-security-system.sql` - Sets up registration codes
3. `create-*.sql` files - Creates various tables
4. `enable-profiles-rls.sql` - Enables row-level security

## Contact

For questions or support, contact the BOSSO board at external@txbosso.com. The [user guide](docs/BOSSO-Portal-User-Guide.md) explains member and administrator workflows.
