# BOSSO Role Requirements Implementation

## Overview

This document describes the implementation of role-based point requirements according to the official BOSSO Membership Tiers, Roles & Eligibility system.

## Membership Tiers & Requirements

| Tier | Role | Points Required | Status & Eligibility |
|------|------|----------------|---------------------|
| **Inactive Member** | General Member | 0-99 points<br/>(or fewer than 25 in any category) | • Not considered active<br/>• Not eligible for advancement or leadership |
| **Active General Member** | General Member | 100-149 points<br/>(with category minimums) | • Active BOSSO member<br/>• Eligible to apply for Analyst roles |
| **Active Analyst** | Analyst | 150-199 points<br/>(with category minimums) | • Active BOSSO member<br/>• Eligible to reapply as Analyst<br/>• Eligible to apply for PM roles |
| **Leadership Eligible** | Analyst/PM/Board | 200+ points<br/>(with category minimums) | • Active BOSSO member<br/>• Eligible for PM and Board roles<br/>• Sustained, high-impact contribution |

### Category Minimums

For all active tiers (100+ points), users must have:
- **25+ points in Membership**
- **25+ points in Professional/Education**
- **25+ points in Social**
- **25+ points in Philanthropy**

## Implementation Files

### 1. Membership Tier System (`src/lib/membership-tiers.ts`)

Defines:
- `MEMBERSHIP_TIERS` - Tier definitions with point ranges
- `ROLE_REQUIREMENTS` - Specific requirements for each role
- `meetsRoleRequirements()` - Check if user qualifies for a role
- `getMembershipTier()` - Get appropriate tier based on points

### 2. Database Migration (`scripts/migrations/add-role-requirements-enforcement.sql`)

Creates:
- `check_role_requirements(user_uuid, target_role)` - SQL function to validate role changes
- `validate_role_change()` - Trigger function that prevents invalid promotions
- Database trigger on `profiles.role` column

**Behavior:**
- ✅ **Allows demotions** without restriction (e.g., Board → PM, Analyst → General)
- ✅ **Allows lateral moves** (e.g., PM → PM)
- ❌ **Blocks promotions** that don't meet point requirements
- ✅ **Admin role** has no restrictions

### 3. Admin Page Enhancement (TODO)

Need to add:
- Role dropdown in user management table
- Point requirement validation before saving
- Visual indicators showing if user meets requirements
- Error messages explaining why a promotion is blocked

## Role Requirements Summary

```typescript
const ROLE_REQUIREMENTS = {
  general_member: {
    minPoints: 100, // General members need 100+ points to be active
    requiresCategoryMinimums: true, // 25+ in each category
  },
  analyst: {
    minPoints: 150,
    requiresCategoryMinimums: true, // 25+ in each category
  },
  project_manager: {
    minPoints: 200,
    requiresCategoryMinimums: true,
  },
  board_member: {
    minPoints: 200,
    requiresCategoryMinimums: true,
  },
  admin: {
    minPoints: 0,
    requiresCategoryMinimums: false,
  },
}
```

**Important Note**: General members with <100 points or missing category minimums are considered "Inactive Members" but can still have the `general_member` role. They just won't be considered "active" and won't be eligible for advancement.

## Testing the System

### Step 1: Run Database Migration

```bash
# Go to Supabase Dashboard → SQL Editor
# Run: scripts/migrations/add-role-requirements-enforcement.sql
```

### Step 2: Test Role Validation Function

```sql
-- Check if a user meets Analyst requirements (150+ pts, 25+ each category)
SELECT * FROM check_role_requirements('user-uuid-here', 'analyst');

-- Check if a user meets PM requirements (200+ pts, 25+ each category)
SELECT * FROM check_role_requirements('user-uuid-here', 'project_manager');
```

### Step 3: Test Role Change Trigger

```sql
-- This should succeed if user has 150+ points with category minimums
UPDATE profiles SET role = 'analyst' WHERE id = 'user-uuid-here';

-- This should fail with error message if points insufficient
-- Error: "Role promotion not allowed: Need 150+ total points (currently 120)"
```

### Step 4: Test from Admin UI (after implementation)

1. Go to Admin → Users
2. Try to promote a user to Analyst who has < 150 points
3. Should show error: "User needs 150+ points and 25+ in each category"

## Error Messages

The system provides helpful error messages:

- `"Need 150+ total points (currently 120)"` - Insufficient total points
- `"Need 25+ points in Membership (currently 15)"` - Missing category minimum
- `"Need 25+ points in Professional/Education (currently 20)"` - Missing category minimum
- `"Need 25+ points in Social (currently 10)"` - Missing category minimum
- `"Need 25+ points in Philanthropy (currently 5)"` - Missing category minimum

## Next Steps

1. ✅ Create membership tier system
2. ✅ Create database migration with enforcement
3. ⏳ Add role change UI to admin page
4. ⏳ Add point requirement indicators
5. ⏳ Test role promotions with various point levels
6. ⏳ Test category minimum enforcement

## Notes

- The system only validates **promotions** (moving up in hierarchy)
- **Demotions** are always allowed (admins can demote anyone)
- **Admins** can be set regardless of points
- The trigger runs **before** the update, so invalid changes are prevented
- Users can see their tier status on their profile/attendance page
