# Firecrawl Search API - Complete Implementation Guide

## Summary
Successfully implemented Firecrawl v2 Search API with AI-powered job extraction, screenshots, and structured data parsing.

## API Structure Clarification

### scrapeOptions.formats
The `formats` field accepts **BOTH** strings and objects:
```typescript
formats: [
  "markdown",                           // String format
  { type: "json", schema: {...} },      // Object format with options
  { type: "screenshot", quality: 80 }   // Object format with options
]
```

### Supported Format Types
1. **String formats**: `"markdown"`, `"html"`, `"rawHtml"`, `"links"`
2. **Object formats** (require `type` property):
   - `{ type: "json", schema: {...}, prompt: "..." }`
   - `{ type: "screenshot", fullPage: false, quality: 80 }`
   - `{ type: "summary" }`
   - `{ type: "changeTracking" }`

## Our Implementation

### Complete Payload Structure
```typescript
{
  query: "site:indeed.com OR site:linkedin.com ... Software Engineer Remote",
  limit: 10,
  sources: ["web"],
  tbs: "qdr:m",  // Last month
  location: "Remote",
  scrapeOptions: {
    // Basic options
    onlyMainContent: true,
    skipTlsVerification: true,
    removeBase64Images: true,
    blockAds: true,
    proxy: "auto",
    
    // Actions (must be lowercase!)
    actions: [
      { type: "wait", milliseconds: 1000 },
      { type: "scroll", direction: "down", count: 2 }
    ],
    
    // Formats (mixed strings and objects)
    formats: [
      {
        type: "json",
        schema: {
          title: "string",
          company: "string",
          salary: "string",
          location: "string",
          deadline: "string",
          apply_link: "string"
        },
        prompt: "Extract job listings including title, company, salary, location, deadline, and apply link."
      },
      {
        type: "screenshot",
        fullPage: false,
        quality: 80
      }
    ]
  }
}
```

## Critical Fixes Applied

### 1. Action Types Case Sensitivity ✅
**Issue**: Action `type` values were capitalized
**Fix**: Changed to lowercase
```typescript
// WRONG ❌
{ type: "Wait", milliseconds: 1000 }
{ type: "Scroll", direction: "down" }

// CORRECT ✅
{ type: "wait", milliseconds: 1000 }
{ type: "scroll", direction: "down" }
```

### 2. Formats Structure ✅
**Verified**: Using object format for JSON extraction is correct
```typescript
// CORRECT ✅
formats: [
  {
    type: "json",
    schema: { title: "string", company: "string", ... },
    prompt: "Extract job listings..."
  },
  {
    type: "screenshot",
    fullPage: false,
    quality: 80
  }
]
```

## Data Flow

### 1. Firecrawl Response Structure
```typescript
{
  success: true,
  data: [
    {
      url: "https://...",
      title: "Job Title",
      description: "...",
      scraped: {
        json: {
          title: "Senior Software Engineer",
          company: "TechCorp",
          salary: "$120,000 - $180,000",
          location: "Remote",
          deadline: "2025-10-15",
          apply_link: "https://..."
        },
        screenshot: "data:image/png;base64,..."
      }
    }
  ]
}
```

### 2. Data Extraction Logic
```typescript
// Priority order for extraction:
const title = item?.scraped?.json?.title || item.title || 'No title';
const company = item?.scraped?.json?.company || extractCompanyFromUrl(item.url);
const description = item.description || '';
const location = item?.scraped?.json?.location || '';
const salary = item?.scraped?.json?.salary || '';
const deadline = item?.scraped?.json?.deadline || '';
const apply_link = item?.scraped?.json?.apply_link || item.url;
const screenshot = item?.scraped?.screenshot || '';
```

### 3. Salary Parsing
```typescript
// Extract structured fields from salary string
// Input: "$120,000 - $180,000" or "£40k-60k" or "50-80k USD"
// Output: { salary_min: 120000, salary_max: 180000, salary_currency: "USD" }

// Supports:
- Multiple currencies: USD ($), GBP (£), EUR (€), CAD, AUD
- Range formats: "$50,000-$80,000", "50-80k", "50000 - 80000"
- "k" multipliers: 50k → 50000
- Single values: "$50,000+"
```

### 4. Database Storage
```typescript
{
  id: uuid,
  user_id: uuid,
  source_type: "firecrawl_search",
  source_id: url,
  title: string,
  company: string,
  description: string,
  location: string,
  salary_min: integer,
  salary_max: integer,
  salary_currency: string,
  expires_at: timestamp,
  apply_url: string,
  raw_data: {
    screenshot: "data:image/png;base64,...",
    scraped_data: {
      title: "...",
      company: "...",
      salary: "...",
      location: "...",
      deadline: "...",
      apply_link: "..."
    }
  }
}
```

## Testing Checklist

### Backend
- [x] Action types lowercase (`"wait"`, `"scroll"`)
- [x] Formats array with JSON schema object
- [x] Formats array with screenshot object
- [x] Data extraction from `item?.scraped?.json`
- [x] Salary parsing regex
- [x] Database insertion with all fields
- [x] Function deployed successfully

### Frontend
- [x] Build successful
- [x] Screenshot display component
- [x] Structured salary display
- [x] Deadline display
- [x] TypeScript errors resolved
- [ ] Test with real job search
- [ ] Verify screenshot loads
- [ ] Verify salary displays correctly

## Expected Results

When searching for "Software Engineer Remote":

1. **Search Phase**
   - Queries 15 job boards
   - Applies Firecrawl operators
   - Returns 10 URLs max per search

2. **Extraction Phase** (automatic in Search API)
   - AI extracts: title, company, salary, location, deadline, apply_link
   - Captures screenshot of job page
   - Returns structured JSON + base64 image

3. **Processing Phase**
   - Parses salary strings into min/max/currency
   - Converts deadline to expires_at timestamp
   - Filters for actual job postings

4. **Storage Phase**
   - Inserts jobs into database
   - Stores screenshot in raw_data
   - Upserts on conflict (user_id, source_id)

5. **Display Phase**
   - Shows job cards with salary badges
   - Displays screenshot in details view
   - Shows deadline with urgency colors

## Troubleshooting

### Issue: 400 Invalid request body
**Cause**: Action types capitalized or formats structure incorrect
**Fix**: Ensure action types lowercase, verify formats array structure

### Issue: No scraped JSON data
**Cause**: Firecrawl couldn't extract structured data
**Fix**: Fallback to basic search metadata (item.title, item.description)

### Issue: Screenshot not displaying
**Cause**: Base64 too large or invalid format
**Fix**: Check raw_data.screenshot field, verify base64 encoding

### Issue: Salary not parsed
**Cause**: Regex doesn't match format
**Fix**: Update regex in salary parsing logic to handle new formats

## Performance Considerations

1. **Search Limit**: 10 results max to stay within Firecrawl limits
2. **Screenshot Size**: ~100-500KB per job (base64 encoded)
3. **API Calls**: 1 search call = discovers + scrapes + extracts all jobs
4. **Database**: Upsert prevents duplicates via unique constraint

## Future Enhancements

- [ ] Add more salary formats (hourly rates, per-project)
- [ ] Implement screenshot compression
- [ ] Add retry logic for failed extractions
- [ ] Cache screenshots separately (object storage)
- [ ] Add job posting freshness tracking
- [ ] Implement incremental updates for existing jobs

## References

- Firecrawl v2 Search API: https://api.firecrawl.dev/v2/search
- Action types: wait, click, screenshot, write, press, scroll, scrape, executeJavascript, pdf
- Format types: markdown, html, rawHtml, links, json, screenshot, summary, changeTracking
- Schema format: JSON Schema compliant objects
