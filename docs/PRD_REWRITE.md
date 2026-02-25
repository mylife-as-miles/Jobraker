# JobRaker Product Requirements Document (PRD)

**Version:** 1.0 (Realignment)
**Status:** DRAFT
**Author:** Jules (Senior Staff Product Architect)
**Date:** 2026-10-25

---

## 1. Product Thesis
**JobRaker is an intelligent application assistant that transforms the job search from a "volume game" into a "precision strike."** Instead of blindly spamming applications, it uses AI to find high-fit roles and automates the tedious form-filling process, ensuring every submission is tailored, accurate, and human-verified.

## 2. User Archetypes
### Primary: The Strategic Professional
*   **Behavior:** Values quality over quantity. Wants to apply to 10-20 specific roles per week but hates re-typing their resume into Workday/Lever/Greenhouse.
*   **Pain Point:** "I spend 45 minutes on one application just to get ghosted."
*   **Goal:** Reduce application time from 45 mins to 5 mins without sacrificing quality.

### Secondary: The High-Volume Seeker (De-prioritized)
*   **Behavior:** Wants to "spray and pray" 100 applications/day.
*   **Why De-prioritize:** High API costs (Skyvern/Firecrawl), high ban rate from job boards, low conversion.

## 3. Core Workflow (The "Assisted Autonomy" Loop)
1.  **Discovery:** User defines search criteria. System (Firecrawl) fetches jobs.
2.  **AI Triage:** System calculates a *backend* Match Score (LLM-based) to rank jobs. Low-match jobs are hidden or flagged.
3.  **Review:** User reviews high-match jobs. Clicks "Prepare Application".
4.  **Drafting:** System (Skyvern) navigates to the job site, fills the form, uploads resume, and *pauses* before submit (or submits to a draft state if possible).
5.  **Optimization:** System (LLM) generates a tailored cover letter and suggests resume tweaks based on the job description.
6.  **Execution:** User reviews the package and clicks "Launch". Skyvern submits.

## 4. System vs. Human Responsibilities
| Feature | System Responsibility | Human Responsibility |
| :--- | :--- | :--- |
| **Search** | Scrape & Aggregate (Firecrawl) | Define criteria & filter noise |
| **Matching** | Score & Rank (LLM) | Verify fit & discard bad matches |
| **Application** | Navigate, Fill Form, Upload (Skyvern) | Review accuracy, hit "Submit" |
| **Tailoring** | Generate Cover Letter, Tweak Resume | Personalize tone, add specific anecdotes |

## 5. AI Decision Boundaries
*   **The AI NEVER:** Submits an application without a "confidence check" or user approval (v1).
*   **The AI ALWAYS:** Flags missing information (e.g., "Job requires a portfolio URL, but your profile lacks one").
*   **The AI SUGGESTS:** "This job emphasizes 'React Native'. Your resume only says 'React'. Should we highlight mobile experience?"

## 6. Failure Handling Logic
*   **Search Failure:** If Firecrawl fails/rate-limits, fallback to a cached "Recent Jobs" list or notify user to try later (don't fail silently).
*   **Apply Failure (Skyvern):**
    *   **Retry:** Automatically retry 1x for network glitches.
    *   **Handoff:** If automation fails (e.g., complex captcha), provide the *direct link* to the user with form data copied to clipboard. "I couldn't finish this, but I did the heavy lifting. Click here to finish."
*   **Payment Failure:** Atomic transaction implementation (RPC) to prevent credit loss.

## 7. Trust & Explainability Model
*   **"Why this match?"** Show the specific keywords/skills that overlapped (already in UI, move to backend).
*   **"What did you send?"** Store a screenshot or PDF receipt of the filled application form in the `applications` table.
*   **"Did it work?"** link to the confirmation email or success page screenshot.

## 8. Data Model Enhancements
*   **`applications` Table:** Add `draft_status` (draft/ready/sent), `ai_confidence_score` (0-100), `user_review_notes` (text).
*   **`jobs` Table:** Add `hidden` (boolean) for low-quality matches.
*   **`credits` Table:** Ensure strictly transactional updates via RPC.

## 9. Metrics for Success
*   **North Star:** **Applications Submitted Per Active User Per Week.**
*   **Quality Metric:** **Interview Conversion Rate** (User self-reported or email parser detected).
*   **Efficiency:** **Time Saved** (Estimated 20 mins per app * Apps Submitted).
*   **Reliability:** **Automation Success Rate** (Successful Skyvern runs / Total attempts).

## 10. Roadmap

### Phase v1.0: Stabilization (Weeks 1-4)
*   **Objective:** Make the current "Command Center" reliable.
*   **Tasks:**
    *   Move "Match Score" logic to backend (Edge Function) for security and consistency.
    *   Fix `init-payment` to use a reliable exchange rate source (or fixed pricing).
    *   Implement robust error handling for Skyvern (Retry Queue).
    *   Remove dead "Gamification" and "Chat" code to reduce noise.

### Phase v1.5: Intelligence (Weeks 5-8)
*   **Objective:** Add the "High-Fidelity" features.
*   **Tasks:**
    *   Implement LLM-based Cover Letter generation (using `polish-content`).
    *   Add "Resume Tailoring" (dynamic resume PDF generation per job).
    *   Add "Draft Mode" for applications.

### Phase v2.0: True Autonomy (Months 3+)
*   **Objective:** Trusted "Set and Forget".
*   **Tasks:**
    *   Identify "Trusted Sources" (e.g., Greenhouse, Lever) where automation is 99% reliable.
    *   Allow "Auto-Submit" *only* for these trusted sources and high-match (>90%) jobs.
    *   Introduce "Interview Scheduling" agent.
