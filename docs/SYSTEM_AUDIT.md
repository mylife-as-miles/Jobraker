# JobRaker System Audit & Product Truth Extraction

**Date:** 2026-10-25
**Auditor:** Jules (Senior Staff Product Architect)

---

## Phase 1 — System Comprehension (The Audit)

### 1. Product Intent vs. Reality
*   **The Pitch:** "The world's first fully autonomous job application platform... applies while you sleep."
*   **The Reality:** JobRaker is a **Job Application Command Center** that triggers external automation scripts on demand. It is not a persistent autonomous agent. The user must actively search ("Find Jobs") and click "Auto Apply" to trigger a Skyvern workflow. It is a "human-in-the-loop" macro runner, not a "set-and-forget" agent.
*   **Assumptions:** The code assumes external services (Skyvern, Firecrawl) are 100% reliable and fast. It assumes job boards won't block the IP addresses of these scrapers (which they often do).

### 2. Architecture Reconstruction
*   **Data Flow:**
    *   **Search:** User Input → `jobs-search` Edge Function → **Firecrawl API** → Parse Results → `jobs` table (User's Queue).
    *   **Apply:** User Click → `apply-to-jobs` Edge Function → **Skyvern API** → `applications` table.
    *   **Credits:** User Purchase → Paystack (via `init-payment`) → Webhook → SQL Updates (`user_credits`).
*   **State Ownership:** "Jobs" (found) and "Applications" (submitted) are clearly separated tables. User profile state is scattered across `profiles`, `profile_experiences`, etc.
*   **AI Reasoning:** **Minimal.** The "AI Match Score" is a **client-side JavaScript function** (`computeJobMatchInsights` in `JobPage.tsx`) that performs simple keyword overlap (Search Terms vs. Job Description). It is *not* a sophisticated LLM analysis.
*   **Failure Modes:**
    *   **Search:** If Firecrawl is rate-limited or fails (common), the user gets zero jobs.
    *   **Apply:** If Skyvern fails mid-batch, the jobs are already deleted from the `jobs` table (moved to "applied" state visually), potentially losing the lead if the application didn't actually go through.

### 3. Hidden Features & Dead Code
*   **Gamification:** Tables for `gamification_events`, `user_streaks` exist in migrations but have zero business logic connecting them to the dashboard.
*   **Chat:** `ai_chat` and `chat_sessions` tables exist, and credit costs are defined for it, but the feature is gated/dormant.
*   **Resume Builder:** A complex "Artboard" store exists, but the "Auto Apply" flow simply passes a signed URL of the PDF. The granular data (experience, skills) is not actively used to *tailor* the application dynamically beyond basic form filling.

### 4. Contradictions
*   **"AI Powered":** The most "AI" part (Matching) is a regex/keyword script. The real AI (Skyvern's vision/navigation) is outsourced.
*   **"Autonomous":** The system requires constant user interaction to populate the queue and trigger batches. It doesn't "wake up" and apply on its own (Cron jobs exist but seem limited to data ingestion, not user-specific application).
*   **"Enterprise Grade":** The payment system uses a free, unauthenticated API (`open.er-api.com`) for currency conversion, which is a critical financial risk.

### 5. Production Readiness (Risks)
*   **Scalability Risk (High):** Each user action triggers a paid API call (Firecrawl search = $$$, Skyvern run = $$$$). The unit economics are dangerous. A "Free" user searching 10 times costs real money.
*   **Reliability Risk (High):** Dependency on Skyvern and Firecrawl is absolute. If they go down or change their API, JobRaker is dead in the water.
*   **Security Risk (Medium):** RLS is generally good. However, the `init-payment` function relies on a hardcoded exchange rate fallback if the free API fails, which could lead to undercharging.

---

## Phase 2 — Product Truth Extraction

### 1. The Product the Founders THINK They Built
An intelligent, autonomous AI agent that lives in the cloud, constantly hunting for jobs and applying to them with perfect custom tailored resumes, allowing the user to "wake up to interviews."

### 2. The Product the Code ACTUALLY Implements
A dashboard that wraps two external APIs (Firecrawl for search, Skyvern for browsing). It allows a user to manually curate a list of jobs and then "batch fire" a generic application script at them. It’s a **browser automation wrapper**.

### 3. The Product the Market Would UNDERSTAND
**"The Universal Easy-Apply Button."** A tool that lets you turn *any* job board into a "One-Click Apply" board by using an AI browser to do the clicking for you.

### 4. The Product That Could Realistically Succeed (The Pivot)
**"High-Fidelity Application Assistant."**
Instead of promising "1000 applications while you sleep" (which fails due to cost and anti-bot measures), promise **"10 perfect applications in 10 minutes."**
*   **Shift focus:** From *Quantity* (Autonomy) to *Quality* (Assistance).
*   **Core Value:** Use the "AI Match Score" (upgraded to real LLM) to *filter* the noise, then use Skyvern to *draft* the application for the user to review and hit "Send".
*   **Monetization:** Charge for the *convenience* and *intelligence*, not just the volume.
