# Resume Parse Email Column Fix

## Issue
When parsing resumes during onboarding, the application threw an error:
```
Could not find 'email' column of 'profiles' in schema cache
```

## Root Cause
The `profiles` table does not have an `email` column. Email addresses are stored in the `auth.users` table (managed by Supabase Auth), not in the `profiles` table.

The AI resume parser (`parseResumeProfile.ts`) was extracting the email from resumes, and the onboarding flow was attempting to save it to the `profiles` table, which caused the error.

## Actual Profiles Table Schema

```sql
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "job_title" "text",
    "experience_years" integer,
    "location" "text",
    "goals" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    "avatar_url" "text",
    -- Added by migration 20250929100000_alter_profiles_add_onboarding_and_fields.sql
    "onboarding_complete" boolean default false,
    "about" text,
    "education" jsonb,
    "skills" text[] default '{}',
    "experience" jsonb,
    "socials" jsonb
);
```

**Note**: `email` is stored in `auth.users.email`, not in the profiles table.

## Solution

### 1. Removed Email from Profile Upserts

**File**: `src/screens/Onboarding/Onboarding.tsx`

**AI Parsing Path (Line 300-315)**:
```typescript
// BEFORE (caused error)
profileData = {
  first_name: aiParsedData.firstName || null,
  last_name: aiParsedData.lastName || null,
  email: aiParsedData.email || (user as any).email || null,  // ❌ Column doesn't exist
  phone: aiParsedData.phone || null,
  // ...
};

// AFTER (fixed)
profileData = {
  first_name: aiParsedData.firstName || null,
  last_name: aiParsedData.lastName || null,
  phone: aiParsedData.phone || null,  // ✅ Removed email
  // ...
};
```

**Heuristic Parsing Path (Line 367-377)**:
```typescript
// BEFORE (caused error)
profileData = {
  first_name: null,
  last_name: null,
  email: analyzed.emails?.[0] || (user as any).email || null,  // ❌ Column doesn't exist
  phone: analyzed.phones?.[0] || null,
  // ...
};

// AFTER (fixed)
profileData = {
  first_name: null,
  last_name: null,
  phone: analyzed.phones?.[0] || null,  // ✅ Removed email
  // ...
};
```

### 2. Updated Documentation

**File**: `ONBOARDING_AI_SETUP.md`

Updated the profiles table schema documentation to:
- Remove `email` from the schema
- Add note explaining email is in `auth.users` table
- Include all actual columns: `goals`, `avatar_url`, `skills`, `education`, `experience`, `about`, `onboarding_complete`

## Email Access

To access the user's email in the application:

```typescript
// Get email from auth user
const { data: { user } } = await supabase.auth.getUser();
const email = user?.email;

// Or from session
const { data: { session } } = await supabase.auth.getSession();
const email = session?.user?.email;
```

## Verification

✅ Build succeeds: `npm run build` (20.24s)
✅ No TypeScript errors
✅ Email removed from both AI and heuristic parsing paths
✅ Documentation updated to reflect correct schema

## Impact

- **Resume parsing**: Now works correctly without trying to save email to profiles table
- **Email data**: Still extracted by AI parser but not persisted to profiles (correctly uses auth.users)
- **User experience**: No change - email is still accessible via `auth.users`
- **Database**: No schema changes needed (already correct)

## Related Files

- `src/screens/Onboarding/Onboarding.tsx` - Fixed profile upsert statements
- `src/services/ai/parseResumeProfile.ts` - Parser still extracts email (for future use/validation)
- `ONBOARDING_AI_SETUP.md` - Updated documentation
- `backend/migrations/20250929100000_alter_profiles_add_onboarding_and_fields.sql` - Migration that added missing columns
