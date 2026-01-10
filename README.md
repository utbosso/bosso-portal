# BOSSO Portal

Business of Sports Student Organization member portal at UT Austin.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Google OAuth + Email/Password)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables (see `.env.example`)

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

## Database Setup

All database setup scripts are in the `scripts/setup/` folder. Run them in your Supabase SQL editor in this order:

1. `add-role-types.sql` - Creates user role types
2. `add-signup-security-system.sql` - Sets up registration codes
3. `create-*.sql` files - Creates various tables
4. `enable-profiles-rls.sql` - Enables row-level security

## Contact

For questions or support, contact the BOSSO board at external@txbosso.com
