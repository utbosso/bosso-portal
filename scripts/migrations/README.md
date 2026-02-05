# Database Migrations

This directory contains SQL migration scripts for the BOSSO Portal database.

## How to Run Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file you want to run
4. Paste it into the SQL Editor
5. Click "Run" to execute the migration

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Run a specific migration
supabase db execute < scripts/migrations/your-migration-file.sql
```

## Available Migrations

### add-profile-fields.sql
Adds detailed member profile fields to the profiles table:
- `first_name` - User's first name
- `last_name` - User's last name
- `ut_eid` - University of Texas EID (unique identifier)
- `ut_email` - University of Texas email address
- `phone_number` - User's phone number

**When to run:** Required for the member profile feature in the settings page.

### Other Migrations
- `add-bosso-points-system.sql` - BOSSO points tracking system
- `add-event-categories-and-types.sql` - Event categorization
- `add-role-requirements-enforcement.sql` - Role-based point requirements
- `fix-points-total-calculation.sql` - Patch for older installs with incorrect total calculation

## Migration Order

Run migrations in this order if starting fresh:
1. `add-bosso-points-system.sql`
2. `add-event-categories-and-types.sql`
3. `add-role-requirements-enforcement.sql`
4. `add-profile-fields.sql`

If your database already ran older versions of the points/role migrations,
run `fix-points-total-calculation.sql` once to correct totals.

## Important Notes

- Always backup your database before running migrations
- Migrations are idempotent where possible (using `IF NOT EXISTS`)
- Review the migration file contents before executing
- Test migrations in a development environment first
