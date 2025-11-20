# Database Schema Fixes

## Issue: Missing Column Error
```
PGRST204: Could not find the 'walkthrough_chat' column of 'profiles' in the schema cache
```

## Resolution

### 1. Added Missing Column
Created migration: `backend/migrations/20251014000001_add_walkthrough_chat.sql`

```sql
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_chat" boolean DEFAULT false;
```

### 2. Updated TypeScript Interfaces

**File: `src/hooks/useProfileSettings.ts`**
```typescript
export interface Profile {
  // ... existing fields
  walkthrough_chat?: boolean;  // ← Added
}
```

**File: `src/types/supabase.ts`**
```typescript
profiles: {
  Row: {
    // ... existing fields
    walkthrough_chat?: boolean | null;  // ← Added
  };
}
```

### 3. Updated Composite Index
The walkthrough tracking index was updated to include the new column:
```sql
CREATE INDEX IF NOT EXISTS "profiles_walkthrough_incomplete_idx" 
ON "public"."profiles" USING btree (
  (not walkthrough_overview),
  (not walkthrough_applications),
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat)  -- ← Added
);
```

## Manual Migration Required

### Option 1: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste from `MANUAL_MIGRATIONS.sql`
3. Click "Run"

### Option 2: Direct SQL
```sql
-- Add column
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "walkthrough_chat" boolean DEFAULT false;

-- Recreate index
DROP INDEX IF EXISTS "profiles_walkthrough_incomplete_idx";

CREATE INDEX IF NOT EXISTS "profiles_walkthrough_incomplete_idx" 
ON "public"."profiles" USING btree (
  (not walkthrough_overview),
  (not walkthrough_applications),
  (not walkthrough_jobs),
  (not walkthrough_resume),
  (not walkthrough_analytics),
  (not walkthrough_settings),
  (not walkthrough_profile),
  (not walkthrough_notifications),
  (not walkthrough_chat)
);
```

## What This Column Does

The `walkthrough_chat` column tracks whether a user has completed the chat/AI assistant walkthrough. This is part of the onboarding flow that guides new users through various features:

- ✅ `walkthrough_overview` - Dashboard overview tour
- ✅ `walkthrough_applications` - Job applications section
- ✅ `walkthrough_jobs` - Job search and listings
- ✅ `walkthrough_resume` - Resume builder
- ✅ `walkthrough_analytics` - Analytics dashboard
- ✅ `walkthrough_settings` - Settings configuration
- ✅ `walkthrough_profile` - Profile setup
- ✅ `walkthrough_notifications` - Notifications center
- ✅ `walkthrough_chat` - **AI Chat Assistant** (NEW)

## Files Changed
- ✅ `/backend/migrations/20251014000001_add_walkthrough_chat.sql` - Database migration
- ✅ `/src/hooks/useProfileSettings.ts` - Profile interface
- ✅ `/src/types/supabase.ts` - Generated types
- ✅ `/MANUAL_MIGRATIONS.sql` - Quick reference for manual fixes

## Testing
After running the migration:
1. Check that the column exists:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'walkthrough_chat';
   ```
2. Verify the index was created:
   ```sql
   SELECT indexname 
   FROM pg_indexes 
   WHERE tablename = 'profiles' AND indexname = 'profiles_walkthrough_incomplete_idx';
   ```
3. Test the application - the error should no longer occur

## Related
- Previous walkthrough flags migration: `backend/migrations/20251001100000_alter_profiles_add_walkthrough_flags.sql`
- Commit: `75c6237`
