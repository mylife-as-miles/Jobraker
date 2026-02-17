# Job Search UI - Visual Reference

## Job Card (List View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo]  Senior Software Engineer                                   │
│          TechCorp Inc                                                │
│          [Remote] [San Francisco] [indeed.com] 💰 $120k-$180k [⏰ 5d]│
└─────────────────────────────────────────────────────────────────────┘
```

### Badge Colors:
- **Remote**: Green border (`border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10`)
- **Location**: Gray (`border-[#ffffff20] text-[#ffffffa6] bg-[#ffffff0d]`)
- **Source**: Gray with favicon (`border-[#ffffff1e] text-[#ffffffa6] bg-[#ffffff08]`)
- **Salary**: Green with 💰 (`border-[#1dff00]/30 text-[#1dff00] bg-[#1dff00]/10`)
- **Deadline**: Color-coded urgency
  - Green: 7+ days
  - Yellow: 3-6 days
  - Red: <3 days

## Job Details (Expanded View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo]  Senior Software Engineer                                   │
│  96      TechCorp Inc                                                │
│          [Remote] [San Francisco] [indeed.com] Posted 2 days ago     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Job Description                                                     │
│  We are looking for a talented software engineer...                 │
│  • 5+ years experience                                              │
│  • React, TypeScript, Node.js                                       │
│  • Remote-first culture                                             │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  JOB PAGE PREVIEW                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                             │    │
│  │                [Screenshot of Job Page]                     │    │
│  │                                                             │    │
│  │  - Shows actual job posting as it appears on source site   │    │
│  │  - Captured at quality 80                                   │    │
│  │  - Includes company branding, full description              │    │
│  │                                                             │    │
│  └────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│  SOURCES                                                             │
│  • [favicon] indeed.com/jobs/senior-software-engineer-123           │
│                                                                      │
│  Application deadline: 5 days                                       │
│  Salary: $120,000 - $180,000                                        │
│                                                                      │
│  [View Original Posting] ────────────────────────────────────>      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Priorities

### Salary Display Logic:
1. **First**: Structured fields (`salary_min`, `salary_max`, `salary_currency`)
   - Format: "$50,000 - $80,000" (details) or "$50k-$80k" (card)
   - Supports: USD ($), GBP (£), EUR (€), CAD, AUD
   
2. **Fallback**: Raw string from `raw_data.scraped_data.salary` or `raw_data.salary`
   - Display as-is (may be unformatted)

### Deadline Display Logic:
1. **First**: `expires_at` (ISO timestamp)
2. **Fallback**: `raw_data.deadline` or `raw_data.applicationDeadline` (string)
3. **Formatting**: Via `formatDeadlineMeta()` function

### Screenshot Display:
- Source: `raw_data.screenshot`
- Format: Base64-encoded image or URL
- Fallback: "Screenshot unavailable" message
- Styling: Full-width with border and rounded corners

## Mobile Responsive Behavior

### Job Cards:
- Stack badges vertically on narrow screens
- Logo shrinks to 12x12 on mobile
- Text truncates with ellipsis

### Job Details:
- Screenshot scales to container width
- Salary and deadline stack vertically
- Action button full-width on mobile

## Example Data Structures

### Structured Salary (Backend Parsed):
```json
{
  "salary_min": 120000,
  "salary_max": 180000,
  "salary_currency": "USD"
}
```

### Raw Screenshot (in raw_data):
```json
{
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "scraped_data": {
    "salary": "$120,000 - $180,000/year",
    "deadline": "2025-10-15"
  }
}
```

## Implementation Details

### Currency Symbol Mapping:
```typescript
const currencySymbol = 
  currency === 'USD' ? '$' :
  currency === 'GBP' ? '£' :
  currency === 'EUR' ? '€' : currency;
```

### Salary Formatting (Card):
```typescript
// Convert to k notation for compact display
const min = salary_min >= 1000 ? `${Math.round(salary_min / 1000)}k` : salary_min;
const max = salary_max >= 1000 ? `${Math.round(salary_max / 1000)}k` : salary_max;
return `${currencySymbol}${min}-${max}`;
```

### Salary Formatting (Details):
```typescript
// Full formatting with thousands separators
return `${currencySymbol}${salary_min.toLocaleString()} - ${currencySymbol}${salary_max.toLocaleString()}`;
```

### Screenshot Error Handling:
```typescript
<img 
  src={screenshot} 
  alt="Job page screenshot" 
  onError={(e) => {
    // Hide image and show fallback message
    target.style.display = 'none';
    parent.innerHTML = '<div>Screenshot unavailable</div>';
  }}
/>
```

## Performance Considerations

1. **Screenshot Loading**: Images load lazily (browser default for `<img>`)
2. **Base64 Size**: May be large (100-500KB per screenshot)
3. **Render Optimization**: Screenshot only rendered when job is selected (detail view)
4. **Caching**: Browser caches base64 images naturally

## Future Enhancements

- [ ] Add screenshot zoom/modal view
- [ ] Lazy load screenshots with placeholder
- [ ] Compress screenshots server-side
- [ ] Add screenshot carousel if multiple available
- [ ] Add "No screenshot" placeholder image
- [ ] Add screenshot timestamp/freshness indicator
