# Bugfix: Firecrawl Action Types Case Sensitivity

## Issue
Jobs search was failing with a 400 error from Firecrawl API:
```
Invalid literal value, expected "wait" (received "Wait")
Invalid literal value, expected "scroll" (received "Scroll")
```

## Root Cause
The Firecrawl v2 Search API requires action `type` values to be **lowercase**, but we were sending them with capitalized first letters.

### Incorrect (Before):
```typescript
actions: [
  { type: "Wait", milliseconds: 1000 },
  { type: "Scroll", direction: "down", count: 2 }
]
```

### Correct (After):
```typescript
actions: [
  { type: "wait", milliseconds: 1000 },
  { type: "scroll", direction: "down", count: 2 }
]
```

## Fix Applied
Updated `/backend/supabase/supabase/functions/jobs-search/index.ts`:
- Changed `type: "Wait"` → `type: "wait"`
- Changed `type: "Scroll"` → `type: "scroll"`

## Validation
The Firecrawl API validates actions against these exact type values:
- `"wait"` - Wait for specified milliseconds
- `"click"` - Click an element (requires `selector`)
- `"screenshot"` - Take a screenshot
- `"write"` - Type text (requires `text`)
- `"press"` - Press a key (requires `key`)
- `"scroll"` - Scroll the page (requires `direction`)
- `"scrape"` - Scrape content
- `"executeJavascript"` - Run JS (requires `script`)
- `"pdf"` - Generate PDF

All type values **must be lowercase**.

## Deployment
✅ Deployed to production: `yquhsllwrwfvrwolqywh`

## Testing
To verify the fix:
1. Go to Jobs page
2. Click "Find New Jobs"
3. Enter any search query (e.g., "AI Developer")
4. Should now successfully search without 400 error
5. Check Debug panel for successful Firecrawl response

## Related Files
- `/backend/supabase/supabase/functions/jobs-search/index.ts` - Fixed action types
- `/src/screens/Dashboard/pages/JobPage.tsx` - UI displays results

## Lessons Learned
- Always check API documentation for exact field value requirements
- Case sensitivity matters in API schemas
- Firecrawl uses Zod validation which is strict about literal types
