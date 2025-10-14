# Infinite Loop Fix - React Error #185

## Problem
Production app was crashing with "Minified React error #185: Maximum update depth exceeded". This error occurs when a component repeatedly triggers re-renders in an infinite loop.

## Root Cause
Multiple custom hooks had circular dependencies in their `useEffect` hooks:

```typescript
// ❌ PROBLEMATIC PATTERN
const fetchData = useCallback(async () => {
  // ... fetch and setState ...
}, [supabase, userId]);

useEffect(() => {
  if (userId) fetchData();
}, [userId, fetchData]); // ← fetchData in dependencies creates circular dependency
```

**Why this causes infinite loops:**
1. `fetchData` is recreated whenever its dependencies (`userId`) change
2. `useEffect` depends on both `userId` AND `fetchData`
3. When `fetchData` changes, it triggers the effect
4. The effect calls `fetchData` which may update state
5. State update triggers re-render
6. On re-render, `fetchData` is recreated (even if `userId` hasn't changed)
7. This triggers the effect again → infinite loop

## Solution
Remove the fetch function from useEffect dependencies. Since the fetch function already depends on `userId`, and the effect only calls it when `userId` exists, we only need `userId` in the dependencies:

```typescript
// ✅ FIXED PATTERN
const fetchData = useCallback(async () => {
  // ... fetch and setState ...
}, [supabase, userId]);

useEffect(() => {
  if (userId) fetchData();
}, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
```

## Files Fixed

### Settings Hooks
1. **`src/hooks/useSecuritySettings.ts`**
   - Fixed initial fetch effect
   - Fixed realtime subscription effects for backup codes and trusted devices

2. **`src/hooks/useNotificationSettings.ts`**
   - Fixed initial fetch effect

3. **`src/hooks/useAppearanceSettings.ts`**
   - Fixed initial fetch effect

4. **`src/hooks/usePrivacySettings.ts`**
   - Fixed initial fetch effect

### Profile Hooks
5. **`src/hooks/useProfileSettings.ts`**
   - Fixed initial fetch effects for profile and collections
   - Fixed realtime subscription effects

6. **`src/hooks/useProfileCollections.ts`**
   - Fixed initial fetch effect
   - Fixed realtime subscription effects

### Notification Hook
7. **`src/hooks/useNotifications.ts`**
   - Fixed initial fetch effect

### Resume Checker Dialog
8. **`src/client/pages/dashboard/resumes/ResumeCheckerDialog.tsx`** (previously fixed, re-fixed)
   - **First fix**: Removed selectedResume from useEffect dependencies, used a ref for initialization
   - **Second fix**: Removed unnecessary useMemo wrappers for experiencesData, educationData, skillsData
   - Arrays with `undefined` length dependencies were creating new references each render
   - Changed profileSummary dependencies to use JSON.stringify of IDs instead of array lengths

## Pattern to Avoid in Future

When using `useCallback` functions in `useEffect`:

```typescript
// ❌ DON'T DO THIS - unnecessary useMemo with array length
const data = useMemo(() => rawData?.items ?? [], [rawData?.items?.length]); // if items is undefined, length is undefined, creates new [] every render

// ✅ DO THIS INSTEAD - just use the data directly or use stable dependency
const data = rawData?.items ?? [];

// ❌ DON'T DO THIS - redundant dependencies
const fetchData = useCallback(/* ... */, [dep1, dep2]);
useEffect(() => { fetchData(); }, [dep1, dep2, fetchData]); // redundant

// ✅ DO THIS INSTEAD
const fetchData = useCallback(/* ... */, [dep1, dep2]);
useEffect(() => { fetchData(); }, [dep1, dep2]); // or just the essential deps

// ✅ OR use JSON.stringify for array/object dependencies
const summary = useMemo(() => buildSummary(items), [JSON.stringify(items.map(i => i.id))]);
```

## Verification
- ✅ All hooks updated
- ✅ No TypeScript/ESLint errors
- ✅ Changes committed and pushed
- ⏳ Deployment to Vercel in progress
- ⏳ Awaiting production verification

## Related Error
The 404 error for `en-BYNVaBwK.js` in the error log is unrelated to the infinite loop issue. This appears to be a missing locale/translation bundle that should be investigated separately.
