# BOSSO Portal - Point Requirements Summary

## Role-Based Point Requirements

| Role | Minimum Total Points | Category Minimums | Status |
|------|---------------------|-------------------|---------|
| **General Member** | 100+ | 25+ in each category | Active |
| **Analyst** | 150+ | 25+ in each category | Active |
| **Project Manager** | 200+ | 25+ in each category | Leadership |
| **Board Member** | 200+ | 25+ in each category | Leadership |
| **Admin** | No requirements | No requirements | - |

## Category Requirements (All Roles Except Admin)

All active members must earn **at least 25 points** in each of these categories:

1. **Membership** (50+ points possible)
   - Membership Profile Creation: 5 pts
   - On-Time Dues Payment: 5 pts
   - Resume Book Submission: 5 pts
   - Semester Reflection: 5 pts
   - Profit Share Participation: 3 pts each (max 5)
   - Tabling/Recruitment: 3 pts each (max 5)

2. **Professional / Education** (100+ points possible)
   - General Meeting: 2 pts each (max 10)
   - Workshop Attendance: 10 pts each
   - Director/Board Coffee Chat: 5 pts each (max 3)
   - BOSS Conference Attendance: 15 pts
   - Case Competition Participation: 15 pts each
   - Member Project Participation: 25 pts each

3. **Social** (75+ points possible)
   - Semesterly Org-Wide Social: 15 pts
   - Project Team Social: 5 pts each (max 3)
   - Role-Based Social: 20 pts each
   - Org-Wide Social: 5 pts each (max 5)

4. **Philanthropy** (75+ points possible)
   - BOSS Volunteering Shift: 10 pts each
   - Individual Service Event: 5 pts each (max 3)
   - BOSSO Service Event: 5 pts each (max 4)
   - Multi-Org Service Event: 15 pts each (max 2)

## Membership Status Tiers

### Inactive Member (0-99 points OR missing category minimums)
- **Role**: General Member
- **Status**: Not considered active
- **Eligibility**: Not eligible for advancement or leadership
- **Requirements**: Need 100+ total points AND 25+ in each category

### Active General Member (100-149 points with category minimums)
- **Role**: General Member
- **Status**: Active BOSSO member
- **Eligibility**: Eligible to apply for Analyst roles
- **Requirements**: 100+ points AND 25+ in each category

### Active Analyst (150-199 points with category minimums)
- **Role**: Analyst
- **Status**: Active BOSSO member
- **Eligibility**: Eligible to reapply as Analyst, eligible to apply for PM roles
- **Requirements**: 150+ points AND 25+ in each category

### Leadership Eligible (200+ points with category minimums)
- **Role**: Analyst, Project Manager, or Board Member
- **Status**: Active BOSSO member
- **Eligibility**: Eligible for PM and Board roles
- **Requirements**: 200+ points AND 25+ in each category
- **Description**: Sustained, high-impact contribution

## How Point Requirements Are Enforced

### Database Level
- SQL trigger on `profiles.role` column
- Checks point requirements before allowing role changes
- **Blocks promotions** that don't meet requirements
- **Allows demotions** without restriction
- Provides specific error messages explaining what's missing

### Application Level
- Category points breakdown visible on Dashboard and Attendance pages
- Active/Inactive status badge
- Clear indicators showing progress towards requirements
- Visual progress bars for each category
- List of missing requirements if inactive

## Example Scenarios

### Scenario 1: New Member
- **Current**: 45 total points (15 Membership, 20 Professional, 5 Social, 5 Philanthropy)
- **Status**: ❌ Inactive Member
- **Missing**: 55 more total points, 10 more in Membership, 5 more in Professional, 20 more in Social, 20 more in Philanthropy
- **Can advance to Analyst?**: No

### Scenario 2: Active General Member
- **Current**: 120 total points (30 Membership, 40 Professional, 25 Social, 25 Philanthropy)
- **Status**: ✅ Active General Member
- **Missing**: Nothing for active status, need 30 more for Analyst
- **Can advance to Analyst?**: No (need 150+ points)

### Scenario 3: Analyst Candidate
- **Current**: 155 total points (30 Membership, 50 Professional, 40 Social, 35 Philanthropy)
- **Status**: ✅ Active (meets all minimums)
- **Missing**: Nothing
- **Can advance to Analyst?**: Yes ✓

### Scenario 4: Leadership Candidate
- **Current**: 210 total points (35 Membership, 75 Professional, 50 Social, 50 Philanthropy)
- **Status**: ✅ Active (meets all minimums)
- **Missing**: Nothing
- **Can advance to PM/Board?**: Yes ✓

## Testing Point Requirements

### Test 1: Check if user meets General Member requirements (100+ pts)
```sql
SELECT * FROM check_role_requirements('user-uuid', 'general_member');
-- Should return true if user has 100+ points and 25+ in each category
```

### Test 2: Check if user meets Analyst requirements (150+ pts)
```sql
SELECT * FROM check_role_requirements('user-uuid', 'analyst');
-- Should return true if user has 150+ points and 25+ in each category
```

### Test 3: Check if user meets PM requirements (200+ pts)
```sql
SELECT * FROM check_role_requirements('user-uuid', 'project_manager');
-- Should return true if user has 200+ points and 25+ in each category
```

### Test 4: Try to promote user without meeting requirements
```sql
-- This should FAIL with an error message
UPDATE profiles SET role = 'analyst' WHERE id = 'user-with-only-100-points';
-- Error: "Role promotion not allowed: Need 150+ total points (currently 100)"
```

## Implementation Files

1. **[membership-tiers.ts](src/lib/membership-tiers.ts)** - TypeScript tier definitions
2. **[add-role-requirements-enforcement.sql](scripts/migrations/add-role-requirements-enforcement.sql)** - Database enforcement
3. **[CategoryPointsBreakdown.tsx](src/components/CategoryPointsBreakdown.tsx)** - UI component
4. **[dashboard/page.tsx](src/app/dashboard/page.tsx)** - Dashboard integration
5. **[attendance/page.tsx](src/app/attendance/page.tsx)** - Attendance page integration

## Key Points

✅ **General Members** need 100+ points (not 0) to be considered "active"
✅ **Analysts** need 150+ points to hold the role
✅ **PMs and Board** need 200+ points to hold the role
✅ **All roles** (except admin) need 25+ points in EACH category
✅ Database automatically prevents invalid promotions
✅ UI shows clear progress indicators and missing requirements
✅ Admins have no point requirements and can be set regardless of points
