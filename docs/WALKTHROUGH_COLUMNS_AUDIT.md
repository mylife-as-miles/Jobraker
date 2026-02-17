# Walkthrough Columns Audit

## Summary
Audit of all walkthrough-related columns in the `profiles` table to identify potential mismatches or missing columns.

## Current Walkthrough Columns

### ✅ Already in Database (from migration 20251001100000)
1. `walkthrough_overview` - Dashboard overview
2. `walkthrough_applications` - Job applications (NOTE: page uses singular 'application')
3. `walkthrough_jobs` - Job listings/search
4. `walkthrough_resume` - Resume builder
5. `walkthrough_analytics` - Analytics dashboard
6. `walkthrough_settings` - Settings configuration
7. `walkthrough_profile` - Profile setup
8. `walkthrough_notifications` - Notifications center

### ✅ Recently Added
9. `walkthrough_chat` - AI Chat assistant (migration 20251014000001)
10. `walkthrough_cover_letter` - Cover letter builder (migration 20251014000002)
    - **Note**: Stored as `walkthrough_cover_letter` (underscore) but referenced in code as `"walkthrough_cover-letter"` (hyphen)

## Pages with Registered Walkthroughs

Based on `useRegisterCoachMarks` calls:

| Page Route | Page ID Used | Expected Column | Column Exists | Status |
|-----------|--------------|-----------------|---------------|--------|
| `/dashboard/` (overview) | N/A | `walkthrough_overview` | ✅ Yes | Missing registration |
| `/dashboard/application` | `application` | `walkthrough_application` | ❌ **MISMATCH** | Uses `walkthrough_applications` (plural) |
| `/dashboard/analytics` | `analytics` | `walkthrough_analytics` | ✅ Yes | ✅ OK |
| `/dashboard/notifications` | `notifications` | `walkthrough_notifications` | ✅ Yes | ✅ OK |
| `/dashboard/resume` | `resume` | `walkthrough_resume` | ✅ Yes | ✅ OK |
| `/dashboard/chat` | `chat` | `walkthrough_chat` | ✅ Yes | ✅ OK |
| `/dashboard/profile` | `profile` | `walkthrough_profile` | ✅ Yes | ✅ OK |
| `/dashboard/cover-letter` | `cover-letter` | `walkthrough_cover-letter` | ✅ Yes (as `walkthrough_cover_letter`) | ✅ OK |
| `/dashboard/settings` | N/A | `walkthrough_settings` | ✅ Yes | Missing registration |
| `/dashboard/jobs` | N/A | `walkthrough_jobs` | ✅ Yes | Missing registration |

## Issues Found

### 🔴 Issue 1: Application vs Applications Mismatch
**Problem**: 
- Database column: `walkthrough_applications` (plural)
- Page ID used: `application` (singular)
- Generated flag: `walkthrough_application` (would look for singular)

**Impact**: 
- When user completes the application page walkthrough, it tries to set `walkthrough_application` (singular)
- But the database only has `walkthrough_applications` (plural)
- This could cause a database error or silent failure

**Solution Options**:
1. Add `walkthrough_application` column (singular) to database
2. Change page ID from `'application'` to `'applications'` in ApplicationPage.tsx
3. Add alias handling in the code

**Recommended**: Add `walkthrough_application` column for backwards compatibility

### 🟡 Issue 2: Missing Walkthrough Registrations
The following pages have columns defined but no walkthrough coach marks registered:
- `overview` - Column exists but no `useRegisterCoachMarks` found
- `settings` - Column exists but no `useRegisterCoachMarks` found  
- `jobs` - Column exists but no `useRegisterCoachMarks` found

**Impact**: Low - columns exist, just not used yet
**Status**: Probably planned for future implementation

## Recommended Actions

### High Priority
1. **Fix Application Mismatch**
   ```sql
   ALTER TABLE "public"."profiles" 
   ADD COLUMN IF NOT EXISTS "walkthrough_application" boolean DEFAULT false;
   ```
   This ensures both singular and plural work.

### Optional
2. **Consider consistency**: Decide on singular vs plural for all pages
3. **Add missing registrations**: Implement walkthroughs for overview, settings, jobs pages

## Code Behavior

### How Walkthroughs Work
```typescript
// In TourProvider.tsx
const walkthroughFlagForPage = (p: string) => `walkthrough_${p}` as const;

// Example:
// page: 'application' → generates 'walkthrough_application'
// page: 'analytics' → generates 'walkthrough_analytics'
```

### Profile Interface
```typescript
// src/hooks/useProfileSettings.ts
export interface Profile {
  walkthrough_overview?: boolean;
  walkthrough_applications?: boolean;  // ← Plural!
  walkthrough_jobs?: boolean;
  // ... etc
}
```

### Setting Walkthrough Complete
```typescript
const completeWalkthrough = async (key: keyof Profile) => {
  if (!key.startsWith('walkthrough_')) return;
  // Updates the profile with { [key]: true }
};
```

## Database Schema

### Current Index
```sql
CREATE INDEX profiles_walkthrough_incomplete_idx ON public.profiles USING btree (
  (not walkthrough_overview),
  (not walkthrough_applications),  -- Note: plural
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat),
  (not walkthrough_cover_letter)
);
```

## Migration Needed

```sql
-- Add singular 'application' column to fix mismatch
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_application" boolean DEFAULT false;

-- Update index to include new column
DROP INDEX IF EXISTS "profiles_walkthrough_incomplete_idx";

CREATE INDEX IF NOT EXISTS "profiles_walkthrough_incomplete_idx" ON "public"."profiles" USING btree (
  (not walkthrough_overview),
  (not walkthrough_application),   -- Singular
  (not walkthrough_applications),  -- Plural (keep for backwards compat)
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat),
  (not walkthrough_cover_letter)
);
```

## Files Checked
- ✅ `src/hooks/useProfileSettings.ts` - Profile interface
- ✅ `src/types/supabase.ts` - Generated types
- ✅ `src/providers/TourProvider.tsx` - Tour logic
- ✅ `src/screens/Dashboard/pages/*.tsx` - All dashboard pages
- ✅ `src/client/pages/dashboard/**/*.tsx` - Client pages
- ✅ `backend/migrations/20251001100000_alter_profiles_add_walkthrough_flags.sql` - Original migration
- ✅ `backend/migrations/20251014000001_add_walkthrough_chat.sql` - Chat addition
- ✅ `backend/migrations/20251014000002_add_walkthrough_cover_letter.sql` - Cover letter addition

## Testing Checklist

After applying the fix migration:

- [ ] Navigate to `/dashboard/application` (Applications page)
- [ ] Complete the walkthrough tour
- [ ] Check database: `SELECT walkthrough_application FROM profiles WHERE id = '<user_id>';`
- [ ] Verify value is `true`
- [ ] Check no errors in browser console
- [ ] Verify tour doesn't auto-start again on page revisit

## Related Files
- `MANUAL_MIGRATIONS.sql` - Quick reference for all pending migrations
- `DATABASE_SCHEMA_FIXES.md` - General schema fix documentation
