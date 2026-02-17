# Analytics Sources Filtering Implementation

## Summary
Updated analytics sources count to only include jobs from whitelisted/allowed job source domains.

## Problem
Previously, the analytics "Sources" metric counted ALL unique `source_type` values from the jobs table, which could include:
- Random/unknown sources
- Manually added jobs
- Non-approved job boards
- Any value that somehow got into the database

This made the analytics metric inaccurate and didn't reflect the actual job search strategy.

## Solution
Implemented domain filtering in `useAnalyticsData.ts` to only count sources that match the allowed job source domains.

### Allowed Job Source Domains
```typescript
const allowedDomains = [
  'remote.co',
  'remotive.com', 
  'remoteok.com',
  'jobicy.com',
  'levels.fyi'
];
```

These domains match the whitelisted sources in the backend `jobs-search` function.

### Code Changes

**File: `src/hooks/useAnalyticsData.ts`** (Lines 235-246)

**Before:**
```typescript
const sourcesSet = new Set<string>();
for (const j of jobs) { 
  if (j.source_type) sourcesSet.add(j.source_type); 
}
const sources = sourcesSet.size;
```

**After:**
```typescript
// Filter sources by allowed job source domains only
const allowedDomains = ['remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 'levels.fyi'];
const sourcesSet = new Set<string>();
for (const j of jobs) {
  if (j.source_type && allowedDomains.includes(j.source_type.toLowerCase())) {
    sourcesSet.add(j.source_type);
  }
}
const sources = sourcesSet.size;
```

## Features

### ✅ Domain Filtering
- Only counts sources from the 5 approved job boards
- Case-insensitive matching (`toLowerCase()`)
- Prevents counting from random/unknown sources

### ✅ Backward Compatible
- Still handles `null`/`undefined` `source_type` values gracefully
- Uses `Set` to deduplicate (e.g., multiple jobs from "remotive.com" count as 1 source)
- No breaking changes to existing analytics logic

### ✅ Accurate Metrics
- Analytics now reflects only legitimate, approved job board sources
- Aligns with the actual job search strategy
- Provides accurate visibility into which approved sources are being used

## Technical Details

### Case-Insensitive Matching
The implementation uses `toLowerCase()` to ensure matching works regardless of how the source_type is stored in the database:
- "Remotive.com" ✅
- "remotive.com" ✅
- "REMOTIVE.COM" ✅

### Deduplication
Uses `Set` data structure to automatically deduplicate sources:
```typescript
// If you have 50 jobs from remotive.com and 30 from remoteok.com
// sourcesSet.size will be 2, not 80
```

### Performance
- O(n) complexity where n = number of jobs in the filtered period
- Set operations are O(1) for add/has
- Array.includes() for 5 domains is negligible

## Related Files

- **Frontend Hook**: `src/hooks/useAnalyticsData.ts`
- **Backend Function**: `backend/supabase/supabase/functions/jobs-search/index.ts` (lines 55-60)
- **Analytics UI**: `src/components/analytics/AnalyticsContent.tsx` (displays the metric)
- **Analytics Page**: `src/pages/AnalyticsPage.tsx` (renders analytics content)

## Testing Scenarios

### Scenario 1: All Jobs from Allowed Sources
```typescript
Jobs: [
  { source_type: 'remotive.com' },
  { source_type: 'remoteok.com' },
  { source_type: 'levels.fyi' }
]
Result: sources = 3 ✅
```

### Scenario 2: Mixed Sources (Allowed + Random)
```typescript
Jobs: [
  { source_type: 'remotive.com' },
  { source_type: 'random-site.com' },  // ❌ Not allowed
  { source_type: 'levels.fyi' }
]
Result: sources = 2 ✅ (only counts allowed domains)
```

### Scenario 3: Multiple Jobs from Same Source
```typescript
Jobs: [
  { source_type: 'remotive.com' },
  { source_type: 'remotive.com' },
  { source_type: 'remotive.com' }
]
Result: sources = 1 ✅ (Set deduplication)
```

### Scenario 4: No Jobs or No Matching Sources
```typescript
Jobs: []
Result: sources = 0 ✅

Jobs: [{ source_type: 'random.com' }]
Result: sources = 0 ✅ (no allowed domains)
```

### Scenario 5: Case Variations
```typescript
Jobs: [
  { source_type: 'Remotive.com' },
  { source_type: 'REMOTEOK.COM' },
  { source_type: 'Remote.co' }
]
Result: sources = 3 ✅ (case-insensitive matching)
```

## Future Improvements

### 1. Shared Constants
Consider extracting allowed domains to a shared constants file:
```typescript
// src/constants/jobSources.ts
export const ALLOWED_JOB_SOURCES = [
  'remote.co',
  'remotive.com',
  'remoteok.com',
  'jobicy.com',
  'levels.fyi'
] as const;
```

### 2. Dynamic Configuration
Load allowed domains from user settings (job_source_settings table) instead of hardcoding:
```typescript
// Fetch from database
const { data } = await supabase
  .from('job_source_settings')
  .select('allowed_domains')
  .eq('id', userId)
  .single();
```

### 3. Backend Consistency
Ensure backend and frontend use the exact same allowed domains list to avoid discrepancies.

## Conclusion

Analytics sources count now accurately reflects only approved job board sources, providing:
- ✅ Accurate visibility into job source diversity
- ✅ Alignment with job search strategy
- ✅ Clean, reliable metrics
- ✅ No counting of random/unknown sources

The implementation is efficient, backward-compatible, and production-ready.
