# Requirements Document

## Introduction

This feature extends the existing Analytics page (`/analytics`) with deeper insight cards that help users understand their job application journey. New components are **additive only** — they are appended below the current layout in `AnalyticsContent.tsx` without modifying any existing card, hook return shape, or styling. The insights leverage data already available in the `applications`, `jobs`, `parsed_resumes`, and `profiles` Supabase tables, focusing on three pillars: ATS/match-score analytics, application-journey memory and history tracking, and actionable journey insights.

## Glossary

- **Analytics_Page**: The existing screen at `/analytics` rendered by `Analytics.tsx` and `AnalyticsContent.tsx`.
- **Insights_Section**: A new additive section rendered below the existing cards inside `AnalyticsContent.tsx`.
- **Score_Trend_Card**: A new card that visualises how the user's average ATS/match score changes over time.
- **Score_Distribution_Card**: A new card that shows the distribution of match scores across buckets.
- **Application_Timeline_Card**: A new card that displays a chronological timeline of key application milestones.
- **Weekly_Digest_Card**: A new card that summarises the user's weekly application activity and progress.
- **Skill_Gap_Card**: A new card that surfaces the most-requested skills from job listings compared with the user's parsed resume skills.
- **Journey_Summary_Card**: A new card that provides a high-level narrative summary of the user's overall application journey.
- **Insights_Data_Hook**: A new React hook (`useInsightsData`) that computes all derived data for the Insights_Section without altering `useAnalyticsData`.
- **Match_Score**: A numeric 0–100 value stored in `jobs.raw_data.match_insights.score` or `applications.match_score`.
- **Parsed_Skills**: The `skills` string array stored in the `parsed_resumes` table for the authenticated user.
- **Period**: The user-selected time window (7d, 30d, 90d, ytd, 12m) already managed by the Analytics_Page.
- **Granularity**: The user-selected grouping interval (day, week, month) already managed by the Analytics_Page.

## Requirements

### Requirement 1: Score Trend Visualisation

**User Story:** As a job seeker, I want to see how my average ATS/match score evolves over time, so that I can gauge whether my applications are improving.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads with data, THE Score_Trend_Card SHALL render a line chart plotting the user's average Match_Score per Granularity bucket within the selected Period.
2. WHEN fewer than two Granularity buckets contain Match_Score data, THE Score_Trend_Card SHALL display an empty-state message indicating insufficient data.
3. THE Score_Trend_Card SHALL display the overall average Match_Score and the delta compared with the previous equivalent Period as a numeric badge.
4. WHEN the user changes the Period or Granularity, THE Score_Trend_Card SHALL re-render with the updated data within the same loading cycle as the existing cards.
5. THE Score_Trend_Card SHALL be appended to the Insights_Section without modifying any existing component or hook return value.

### Requirement 2: Score Distribution Breakdown

**User Story:** As a job seeker, I want to see how my match scores are distributed across quality buckets, so that I can understand the overall quality of my job matches.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads with Match_Score data, THE Score_Distribution_Card SHALL render a bar chart or histogram grouping scores into four buckets: 90–100, 75–89, 60–74, and below 60.
2. THE Score_Distribution_Card SHALL label each bucket with the count and percentage of total scored applications.
3. WHEN no Match_Score data exists for the selected Period, THE Score_Distribution_Card SHALL display an empty-state message.
4. THE Score_Distribution_Card SHALL be appended to the Insights_Section without modifying any existing component.

### Requirement 3: Application Journey Timeline

**User Story:** As a job seeker, I want to see a chronological timeline of my key application milestones, so that I can recall my history and track momentum.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads with application data, THE Application_Timeline_Card SHALL render a vertical timeline of the most recent 20 application events within the selected Period, ordered newest-first.
2. THE Application_Timeline_Card SHALL display for each event: the job title, company name, application status, Match_Score (when available), and the event date.
3. WHEN an application status changes (e.g., from "Applied" to "Interview"), THE Application_Timeline_Card SHALL treat the status change as a distinct milestone using the `updated_at` timestamp.
4. WHEN no application data exists for the selected Period, THE Application_Timeline_Card SHALL display an empty-state message.
5. THE Application_Timeline_Card SHALL be appended to the Insights_Section without modifying any existing component.

### Requirement 4: Weekly Activity Digest

**User Story:** As a job seeker, I want a concise weekly summary of my application activity, so that I can quickly understand my recent progress without scanning every chart.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads with data, THE Weekly_Digest_Card SHALL display a summary for the most recent complete calendar week containing: total applications submitted, total jobs discovered, number of interviews scheduled, and average Match_Score.
2. THE Weekly_Digest_Card SHALL compare each metric against the prior calendar week and display the delta as a positive or negative indicator.
3. WHEN no data exists for the most recent complete calendar week, THE Weekly_Digest_Card SHALL display an empty-state message.
4. THE Weekly_Digest_Card SHALL be appended to the Insights_Section without modifying any existing component.

### Requirement 5: Skill Gap Analysis

**User Story:** As a job seeker, I want to see which skills appear most often in my matched job listings but are missing from my resume, so that I can prioritise skill development.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads and the user has at least one parsed resume and at least one job with `raw_data` containing skill-related keywords, THE Skill_Gap_Card SHALL display up to 10 skills that appear in job listings but are absent from the user's Parsed_Skills.
2. THE Skill_Gap_Card SHALL rank missing skills by frequency of appearance across job listings within the selected Period.
3. WHEN the user has no parsed resume, THE Skill_Gap_Card SHALL display a prompt directing the user to upload and parse a resume.
4. WHEN no skill gaps are identified, THE Skill_Gap_Card SHALL display a positive-feedback message indicating strong skill alignment.
5. THE Skill_Gap_Card SHALL be appended to the Insights_Section without modifying any existing component.

### Requirement 6: Journey Summary Narrative

**User Story:** As a job seeker, I want a plain-language summary of my overall application journey for the selected period, so that I can quickly grasp my progress at a glance.

#### Acceptance Criteria

1. WHEN the Analytics_Page loads with data, THE Journey_Summary_Card SHALL display a short narrative paragraph (3–5 sentences) summarising: total applications, interview rate, top-performing match score, most active source, and trend direction.
2. THE Journey_Summary_Card SHALL generate the narrative from computed metrics without calling any external AI service.
3. WHEN no application or job data exists for the selected Period, THE Journey_Summary_Card SHALL display an empty-state message.
4. THE Journey_Summary_Card SHALL be appended to the Insights_Section without modifying any existing component.

### Requirement 7: Insights Data Hook

**User Story:** As a developer, I want a dedicated data hook for the insights section, so that the new analytics logic is isolated from the existing `useAnalyticsData` hook.

#### Acceptance Criteria

1. THE Insights_Data_Hook SHALL be implemented as a new React hook named `useInsightsData` in a separate file under `src/hooks/`.
2. THE Insights_Data_Hook SHALL accept the current Period, Granularity, and the existing analytics data object as parameters.
3. THE Insights_Data_Hook SHALL derive all insight computations (score trend, distribution, timeline, weekly digest, skill gaps, journey narrative) from the data already fetched by `useAnalyticsData` and from additional Supabase queries for `parsed_resumes` only.
4. THE Insights_Data_Hook SHALL expose a loading state and an error state independent of the existing analytics hook.
5. THE Insights_Data_Hook SHALL NOT modify the return type or behaviour of the existing `useAnalyticsData` hook.

### Requirement 8: Additive Layout Integration

**User Story:** As a developer, I want the new insight cards to integrate into the existing analytics layout additively, so that no current component, style, or data flow is altered.

#### Acceptance Criteria

1. THE Insights_Section SHALL be rendered as a new grid section appended after the existing cards inside `AnalyticsContent.tsx`.
2. THE Insights_Section SHALL follow the same responsive grid patterns (Tailwind CSS classes) and card styling conventions used by the existing analytics cards.
3. THE Insights_Section SHALL use Framer Motion entrance animations consistent with the existing cards.
4. WHEN the Insights_Section is added, THE existing KPI cards, InsightCard, IndustriesCard, MatchScoreAnalytics, and ResumeVersionSuccess components SHALL remain unchanged in code, props, and visual output.
5. THE Insights_Section SHALL use Recharts for any new chart visualisations and Lucide React for any new icons, matching the existing dependency set.
