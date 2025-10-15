# Walkthrough Joyride Fixes - Comprehensive Audit & Implementation

## Overview
This document tracks the systematic fix of all walkthrough/joyride implementations across dashboard pages to ensure proper element targeting and tour functionality.

## Issues Found

### 1. **Generic Selectors Problem**
Many pages use selectors that are too generic or don't have proper `data-tour` attributes:
- Class selectors (`.conversation-scroll-area`)
- Generic element selectors (`textarea`, `h1:text(...)`)
- These fail when multiple similar elements exist

### 2. **Missing data-tour Attributes**
Elements referenced in coach marks don't consistently have `data-tour` attributes for reliable targeting.

### 3. **JobPage Missing Walkthrough**
JobPage has `walkthrough_jobs` column in database but no walkthrough implementation.

## Page-by-Page Fixes

### ✅ ApplicationPage
**Status**: GOOD - Already has proper IDs and data-tour attributes
- `#application-search` + `data-tour="application-search"` ✓
- `#application-view-toggle` + `data-tour="application-view-toggle"` ✓
- `#application-status-filters` + `data-tour="application-status-filters"` ✓
- `#application-gantt` + `data-tour="application-gantt"` ✓

**No changes needed** 

---

### 🔧 ChatPage
**Current Issues**:
1. `selector: '[data-chat-model-select]'` - Need to add this attribute to PromptInputModelSelect
2. `selector: '.conversation-scroll-area, .conversation-container'` - Too generic, need specific data-tour
3. `selector: 'textarea'` - Too generic, need specific data-tour on PromptInputTextarea

**Fix Plan**:
- Add `data-tour="chat-model-select"` to PromptInputModelSelect wrapper
- Add `data-tour="chat-transcript"` to Conversation/ConversationContent wrapper  
- Add `data-tour="chat-input"` to PromptInputTextarea wrapper

---

### 🔧 CoverLetterPage
**Current Selectors**:
```typescript
{ id: 'cover-header', selector: '#cover-header', ... }
{ id: 'cover-meta-panel', selector: '#cover-meta-panel', ... }
{ id: 'cover-editor', selector: '#cover-editor', ... }
{ id: 'cover-actions', selector: '#cover-actions', ... }
```

**Fix Plan**:
- Need to check if CoverLetter component has these IDs
- Add corresponding `data-tour` attributes

---

### 🔧 ResumePage
**Current Issues**:
1. `selector: 'h1:text("Resume Builder")'` - Pseudo-selector won't work in querySelector
2. `selector: '#resume-root, .resume-canvas'` - Need to verify these exist

**Fix Plan**:
- Already has `id="resume-builder-header"` and `data-tour="resume-builder-header"` ✓
- Already has `id="resume-canvas"` and `data-tour="resume-canvas"` ✓
- **Update selectors in useRegisterCoachMarks to use proper IDs**

---

### 🔧 AnalyticsPage
**Current Selectors**:
```typescript
{ id: 'analytics-controls', selector: '#analytics-controls', ... }
{ id: 'analytics-main-card', selector: '#analytics-main-card', ... }
```

**Fix Plan**:
- Verify both elements have matching `data-tour` attributes

---

### 🔧 NotificationPage
**Current Selectors**:
```typescript
{ id: 'notifications-search', selector: '#notifications-search', ... }
{ id: 'notifications-filters', selector: '#notifications-filters', ... }
{ id: 'notifications-list', selector: '#notifications-list', ... }
{ id: 'notifications-detail', selector: '#notifications-detail', ... }
```

**Fix Plan**:
- Verify all elements have matching `data-tour` attributes
- Check conditional step logic (click on notification card)

---

### 🔧 ProfilePage  
**Current Selectors**:
```typescript
{ id: 'profile-avatar', selector: '#profile-avatar', ... }
{ id: 'profile-quick-stats', selector: '#profile-quick-stats', ... }
{ id: 'profile-about', selector: '#profile-about', ... }
{ id: 'profile-experience', selector: '#profile-experience', ... }
```

**Fix Plan**:
- Verify all elements have matching `data-tour` attributes

---

### 🔧 OverviewPage
**Current Selectors**:
```typescript
{ id: 'apps-chart', selector: '#overview-apps-chart', ... }
{ id: 'status-toggle', selector: '#overview-status-filter-buttons', ... }
{ id: 'calendar-pane', selector: '#overview-calendar', ... }
{ id: 'notifications-panel', selector: '#overview-notifications', ... }
```

**Fix Plan**:
- Verify all elements have matching `data-tour` attributes

---

### 🔧 SettingsPage
**Current Selectors**:
```typescript
{ id: 'settings-tab-profile', selector: '#settings-tab-btn-profile', ... }
{ id: 'settings-tab-notifications', selector: '#settings-tab-btn-notifications', ... }
// ... more tabs
{ id: 'settings-tour-complete', selector: '#settings-tablist', ... }
```

**Fix Plan**:
- Verify all tab buttons have matching `data-tour` attributes
- Check tab switching logic with condition.type='click'

---

### 🆕 JobPage
**Status**: NO WALKTHROUGH IMPLEMENTATION

**Database Column**: `walkthrough_jobs` exists

**Proposed Walkthrough**:
```typescript
useRegisterCoachMarks({
  page: 'jobs',
  marks: [
    {
      id: 'jobs-search',
      selector: '#jobs-search',
      title: 'Search Jobs',
      body: 'Search across thousands of job postings by title, company, or keywords.'
    },
    {
      id: 'jobs-filters',
      selector: '#jobs-filters',
      title: 'Filter & Sort',
      body: 'Refine results by location, remote type, experience level, and match score.'
    },
    {
      id: 'jobs-card',
      selector: '.job-card:first-of-type',
      title: 'Job Details',
      body: 'Click any job to see the full description, company info, and apply directly.'
    },
    {
      id: 'jobs-ai-match',
      selector: '#jobs-ai-match',
      title: 'AI Match Score',
      body: 'Our AI analyzes each job against your profile and resume to show compatibility.'
    }
  ]
});
```

---

## Implementation Checklist

### Phase 1: Audit & Document
- [x] Identify all pages with walkthroughs
- [x] Document current selector patterns
- [x] Identify issues (generic selectors, missing attributes)

### Phase 2: Fix Existing Walkthroughs
- [ ] ChatPage - Add data-tour attributes to model select, conversation, input
- [ ] CoverLetterPage - Verify/add IDs and data-tour attributes
- [ ] ResumePage - Fix selector from text pseudo-selector to proper ID
- [ ] AnalyticsPage - Verify data-tour attributes
- [ ] NotificationPage - Verify data-tour attributes
- [ ] ProfilePage - Verify data-tour attributes  
- [ ] OverviewPage - Verify data-tour attributes
- [ ] SettingsPage - Verify data-tour attributes on tab buttons

### Phase 3: Add JobPage Walkthrough
- [ ] Add useRegisterCoachMarks to JobPage
- [ ] Add IDs and data-tour attributes to job search elements
- [ ] Test job walkthrough flow

### Phase 4: Testing
- [ ] Test each walkthrough individually
- [ ] Verify element highlighting works
- [ ] Verify tooltips position correctly
- [ ] Verify completion tracking updates database
- [ ] Test on mobile responsive layouts

### Phase 5: Documentation
- [ ] Update walkthrough best practices guide
- [ ] Document data-tour attribute naming convention
- [ ] Create maintenance guide

---

## Best Practices (Post-Fix)

1. **Always use both ID and data-tour attribute**:
   ```tsx
   <div id="feature-name" data-tour="feature-name">
   ```

2. **Selector Priority**:
   - Primary: `#id-name` (with matching data-tour)
   - Fallback: `[data-tour="name"]`
   - Avoid: class selectors, generic elements

3. **Naming Convention**:
   - Format: `{page}-{feature}` (e.g., `jobs-search`, `profile-avatar`)
   - Use kebab-case consistently
   - Keep names descriptive but concise

4. **Coach Mark Structure**:
   ```typescript
   {
     id: 'unique-mark-id',        // matches element
     selector: '#element-id',      // CSS selector
     title: 'Short Title',         // 2-4 words
     body: 'Helpful description.', // 1-2 sentences
     placement?: 'bottom',         // optional positioning
     condition?: {...},            // optional gating logic
     next?: 'next-mark-id'        // optional branching
   }
   ```

5. **Testing Checklist**:
   - [ ] Element exists in DOM before tour starts
   - [ ] Element is visible (not display:none)
   - [ ] Element is within viewport or can scroll into view
   - [ ] Tooltip doesn't overlap critical UI
   - [ ] Tour completes and sets database flag

---

## Migration Commands

After all fixes, ensure database migrations are applied:

```sql
-- Already migrated:
-- ALTER TABLE profiles ADD COLUMN walkthrough_chat BOOLEAN DEFAULT false;
-- ALTER TABLE profiles ADD COLUMN walkthrough_cover_letter BOOLEAN DEFAULT false;
-- ALTER TABLE profiles ADD COLUMN walkthrough_application BOOLEAN DEFAULT false;

-- Verify walkthrough_jobs exists (should already exist):
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'walkthrough_jobs';
```

---

## Completion Status

**Total Pages with Walkthroughs**: 10
- ApplicationPage ✅
- ChatPage ✅
- CoverLetterPage ✅
- ResumePage ✅
- AnalyticsPage ✅
- NotificationPage ✅
- ProfilePage ✅
- OverviewPage ✅
- SettingsPage ✅
- JobPage ✅

**Progress**: 10/10 pages verified (100%) ✅

---

## Summary of Changes

### Fixed Pages:

1. **ResumePage** - Fixed invalid selector `h1:text("Resume Builder")` → `#resume-builder-header`
2. **ChatPage** - Added `data-tour` attributes to:
   - `Conversation` component (chat-transcript)
   - `PromptInputTextarea` (chat-input)
   - `PromptInputModelSelect` (chat-model-select)
3. **CoverLetterPage** - Added `id="cover-editor"` and `data-tour="cover-editor"` to preview Card
4. **OverviewPage** - Added `data-tour` attributes to all 4 overview elements
5. **JobPage** - Implemented complete walkthrough with:
   - `#jobs-search` - Search input
   - `#jobs-location` - Location filter
   - `[data-tour="jobs-card"]` - First job card
   - `#jobs-ai-match` - AI match score card in detail view

### Already Compliant:
- **ApplicationPage** - All elements had proper IDs and data-tour attributes
- **AnalyticsPage** - Complete implementation  
- **NotificationPage** - Complete implementation
- **ProfilePage** - Complete implementation
- **SettingsPage** - Dynamic ID/data-tour generation for all tabs

---

## Notes

- TourProvider auto-starts walkthroughs when `onboarding_complete === true` and page-specific flag is false
- Walkthrough completion sets `walkthrough_{page}` flag via `completeWalkthrough()`
- Floating "Guided Tours" menu allows manual restart
- Joyride handles spotlight, tooltips, and navigation UI
- Condition gating (click, inputFilled) blocks next until user interacts

