# Implementation Plan: Analytics Insights

## Overview

This plan implements six new insight cards for the Analytics page, driven by a new `useInsightsData` hook. The approach is strictly additive — no existing components or hooks are modified. We start by setting up the test framework (vitest + fast-check), then build the pure computation functions with property tests, followed by the hook, individual card components, the wrapper section, and finally the integration into the existing Analytics page.

## Tasks

- [x] 1. Set up vitest and fast-check testing infrastructure
  - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `fast-check` as dev dependencies
  - Create `vitest.config.ts` at the project root configured for React (jsdom environment, path aliases matching `vite.config.ts`)
  - Add a `"test"` script to `package.json` (`vitest --run`)
  - Create `src/__tests__/insights/` directory with a smoke test to verify the setup works
  - _Requirements: 7.1_

- [ ] 2. Implement pure computation functions for insights data
  - [x] 2.1 Create `src/hooks/insightsComputations.ts` with exported pure functions
    - Implement `computeScoreTrend(items: {date: Date, score: number}[], granularity, period)` → `ScoreTrendPoint[]`
    - Implement `computeOverallAvgAndDelta(currentScores: number[], previousScores: number[])` → `{ overallAvgScore, scoreDelta }`
    - Implement `computeScoreDistribution(scores: number[])` → `ScoreDistributionBucket[]`
    - Implement `computeTimeline(applications, jobs)` → `TimelineEvent[]`
    - Implement `computeWeeklyDigest(applications, jobs)` → `WeeklyDigest | null`
    - Implement `computeSkillGaps(userSkills: string[], jobSkillSets: string[][])` → `SkillGapItem[]`
    - Implement `generateJourneyNarrative(metrics)` → `string`
    - Export all TypeScript interfaces (`ScoreTrendPoint`, `ScoreDistributionBucket`, `TimelineEvent`, `WeeklyDigest`, `SkillGapItem`, `InsightsData`) from this file
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2_

  - [ ]* 2.2 Write property test: Score trend bucketing preserves all scores
    - **Property 1: Score trend bucketing preserves all scores**
    - Generate arbitrary arrays of `{date, score}` items and valid granularities; assert sum of bucket counts equals input count and each bucket avgScore equals arithmetic mean of its scores
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test: Overall average score and period delta are correct
    - **Property 2: Overall average score and period delta are correct**
    - Generate two arbitrary arrays of match scores; assert `overallAvgScore` equals rounded arithmetic mean and `scoreDelta` equals difference of averages
    - **Validates: Requirements 1.3**

  - [ ]* 2.4 Write property test: Score distribution bucketing with correct counts and percentages
    - **Property 3: Score distribution bucketing with correct counts and percentages**
    - Generate arbitrary arrays of integers 0–100; assert each score lands in exactly one bucket, sum of counts equals input length, and percentages are correct
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.5 Write property test: Timeline is sorted, capped, and complete
    - **Property 4: Timeline is sorted, capped, and complete**
    - Generate arbitrary application objects with dates; assert output is sorted newest-first, length ≤ 20, and every event has non-undefined `jobTitle`, `status`, `date`
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 2.6 Write property test: Status changes produce distinct timeline milestones
    - **Property 5: Status changes produce distinct timeline milestones**
    - Generate applications where `updated_at > applied_date` with non-initial status; assert at least two events per such application
    - **Validates: Requirements 3.3**

  - [ ]* 2.7 Write property test: Weekly digest selects correct week with accurate metrics and deltas
    - **Property 6: Weekly digest selects correct week with accurate metrics and deltas**
    - Generate applications and jobs spanning at least two complete calendar weeks; assert the selected week is the most recent complete Monday–Sunday, counts are accurate, and deltas are correct
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.8 Write property test: Skill gaps are absent from user skills, frequency-ordered, and capped
    - **Property 7: Skill gaps are absent from user skills, frequency-ordered, and capped**
    - Generate arbitrary user skill sets and job skill sets; assert results exclude user skills, are ordered by descending frequency, and length ≤ 10
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 2.9 Write property test: Journey narrative contains all required data points
    - **Property 8: Journey narrative contains all required data points**
    - Generate metrics objects with `totalApplications > 0`; assert narrative string contains total applications, interview rate, top match score, most active source, and trend direction
    - **Validates: Requirements 6.1**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the `useInsightsData` hook
  - [x] 4.1 Create `src/hooks/useInsightsData.ts`
    - Import pure computation functions from `insightsComputations.ts`
    - Accept `period`, `granularity`, and `analyticsData` (return type of `useAnalyticsData`) as parameters
    - Query `parsed_resumes` from Supabase for the authenticated user (with AbortController for cleanup)
    - Extract match scores from `analyticsData` snapshot (jobs `raw_data.match_insights.score` with fallback to `applications.match_score`)
    - Extract skill keywords from job `raw_data.match_insights.summary` and `title` fields
    - Call each pure computation function and assemble the `InsightsData` return object
    - Expose independent `loading` and `error` states
    - Handle all error scenarios from the design (malformed `raw_data`, no resume, no data, unmount during fetch)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 4.2 Write unit tests for `useInsightsData` hook
    - Test loading and error state transitions with mocked Supabase client
    - Test that empty analytics data produces empty insight states
    - Test that malformed `raw_data` does not crash the hook
    - _Requirements: 7.4_

- [x] 5. Implement insight card components
  - [x] 5.1 Create `src/components/analytics/insights/ScoreTrendCard.tsx`
    - Render a Recharts `LineChart` plotting `scoreTrend` data points
    - Display `overallAvgScore` and `scoreDelta` as a numeric badge (matching `MatchScoreAnalytics` badge style)
    - Show empty-state when fewer than 2 data points
    - Show loading skeleton when `loading` is true
    - Use `motion.div` entrance animation, `Card` component, Lucide icons, and Tailwind classes matching existing cards
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.2, 8.3, 8.5_

  - [x] 5.2 Create `src/components/analytics/insights/ScoreDistributionCard.tsx`
    - Render a Recharts `BarChart` with four buckets (90–100, 75–89, 60–74, <60)
    - Label each bar with count and percentage
    - Show empty-state when no score data exists
    - Show loading skeleton when `loading` is true
    - Use consistent styling conventions (motion, Card, Lucide, Tailwind)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.2, 8.3, 8.5_

  - [x] 5.3 Create `src/components/analytics/insights/ApplicationTimelineCard.tsx`
    - Render a vertical timeline of up to 20 `TimelineEvent` items, newest-first
    - Display job title, company, status, match score (when available), and date for each event
    - Visually distinguish status-change milestones from initial application events
    - Show empty-state when no timeline events exist
    - Show loading skeleton when `loading` is true
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.2, 8.3, 8.5_

  - [x] 5.4 Create `src/components/analytics/insights/WeeklyDigestCard.tsx`
    - Display weekly summary metrics: applications, jobs discovered, interviews, avg match score
    - Show delta indicators (positive/negative) comparing to prior week
    - Show empty-state when `weeklyDigest` is null
    - Show loading skeleton when `loading` is true
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.2, 8.3, 8.5_

  - [x] 5.5 Create `src/components/analytics/insights/SkillGapCard.tsx`
    - Display up to 10 skill gap items ranked by frequency
    - Show "upload a resume" prompt when `hasResume` is false
    - Show "strong alignment" positive message when no gaps are found but resume exists
    - Show loading skeleton when `loading` is true
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.2, 8.3, 8.5_

  - [x] 5.6 Create `src/components/analytics/insights/JourneySummaryCard.tsx`
    - Display the `narrative` string as a styled paragraph
    - Show empty-state when narrative is empty or no data exists
    - Show loading skeleton when `loading` is true
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.2, 8.3, 8.5_

- [x] 6. Create the InsightsSection wrapper component
  - [x] 6.1 Create `src/components/analytics/insights/InsightsSection.tsx`
    - Accept `period` and `insights` (InsightsData) as props
    - Render a section header (e.g., "Deeper Insights") with a Lucide icon badge
    - Lay out the six cards in a responsive Tailwind grid matching existing patterns (e.g., `grid-cols-1 lg:grid-cols-2 xl:grid-cols-12`)
    - Pass the appropriate data slices to each card component
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate insights into the Analytics page
  - [x] 8.1 Update `Analytics.tsx` to call `useInsightsData`
    - Import `useInsightsData` from `src/hooks/useInsightsData`
    - Call `useInsightsData(period, granularity, analytics)` after the existing `useAnalyticsData` call
    - Pass the `insights` result to `AnalyticsContent` as a new prop
    - No changes to existing props, state, or logic
    - _Requirements: 7.2, 7.5, 8.4_

  - [x] 8.2 Update `AnalyticsContent.tsx` to render `InsightsSection`
    - Import `InsightsSection` from `./insights/InsightsSection`
    - Accept the new `insights` prop
    - Append `<InsightsSection period={period} insights={insights} />` after the existing card grid sections
    - No changes to existing imports, components, or layout
    - _Requirements: 8.1, 8.4_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All pure computation logic is isolated in `insightsComputations.ts` for easy testing
- The integration tasks (8.1, 8.2) are strictly additive — only new imports and JSX are appended
