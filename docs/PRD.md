# JobRaker Product Requirements Document (PRD)

## 1. Product Overview
**JobRaker** is the world's first fully autonomous job application platform. It fundamentally shifts the job search paradigm from a manual, high-volume effort to a precision-based, automated approach. By leveraging advanced AI, JobRaker matches candidates to high-fit roles and completely automates the tedious form-filling and submission processes through Skyvern, ensuring every application is tailored, accurate, and high quality.

## 2. Target Audience & User Archetypes
### Primary: The Strategic Professional
*   **Behavior:** Focuses on quality over quantity. Aims to apply to 10-20 highly relevant roles per week. Despises repetitive data entry across an endless myriad of applicant tracking systems (e.g., Workday, Lever, Greenhouse).
*   **Pain Point:** Spends 30-45 minutes tailoring a single application, only to get ghosted.
*   **Goal:** Reduce application time to minutes, with the platform doing the heavy lifting without sacrificing the quality of the submission.

### Secondary: The High-Volume Applicant
*   **Behavior:** Seeks to maximize exposure by applying to 100+ applications a day.
*   **System Handling:** While supported, the platform discourages pure "spray and pray" due to API costs, rate limits, and lower conversion rates. JobRaker enforces rate limits and credit systems to curb abuse while steering users toward precision.

## 3. Core Features & Workflow (Assisted Autonomy Loop)
1. **Discovery:** The user defines search criteria (location, salary, role). The system utilizes **Firecrawl** and other ingestions to fetch and organize available jobs.
2. **AI Triage & Match Scoring:** The system calculates a backend Match Score using AI. It compares the job description against the user's parsed resume and skills, surfacing high-match opportunities and hiding or flagging poor matches.
3. **Application Drafting:** When a user initiates an application, **Skyvern** takes over. The agent navigates the target job site, automatically fills in the forms using the user's profile data, and uploads the resume.
4. **Optimization:** The system dynamically tailors the resume and generates a custom cover letter (using LLMs) specific to the job description.
5. **Review & Execution:** The AI prepares a draft. The user can review the package and launch the final submission, or the system can auto-submit depending on user trust settings.
6. **Telemetry & Tracking:** The system captures screenshots, tracks the application status, and organizes all applications on the user dashboard.

## 4. Core System Modules
*   **Authentication & Onboarding:** Multi-provider auth (email, Google, LinkedIn) and smart profile building (parsing resumes via PDF/DOCX).
*   **Dashboard & Analytics:** Real-time metrics tracking success rates, response times, and application stages.
*   **Profile & Resume Management:** Dynamic resume builder with multiple templates, skills gap analysis, and real-time database synchronization via Supabase Realtime.
*   **Interview & Chat Assistant:** AI-powered interview preparation, career path planning, and salary negotiation insights.

## 5. System vs. Human Responsibilities
| Feature | System Responsibility | Human Responsibility |
| :--- | :--- | :--- |
| **Search** | Scrape & Aggregate via Firecrawl and APIs | Define criteria & filter out noise |
| **Matching** | Score & Rank fit using AI (0-100) | Verify suggestions & discard irrelevant roles |
| **Application** | Navigate, Extract Form, Auto-Fill, Upload via Skyvern | Review accuracy and initiate submission |
| **Tailoring** | Generate custom cover letters, tweak resume points | Personalize tone and review constraints |

## 6. AI Decision Boundaries & Failure Handling
*   **Validation Check:** The AI will not submit an application automatically if crucial data is missing (e.g., a required portfolio link that isn't in the user's profile).
*   **Suggestions:** The AI proactively suggests updates: "This role emphasizes AWS; your resume lists GCP. Should we update the context?"
*   **Fallback Logic:** If the Skyvern automation fails (e.g., due to complex CAPTCHAs), it retries automatically. If it continually fails, it provides the user with a direct link and clipboard-ready data to finish manually.
*   **Credit Conservation:** Payment and credit deductions use strictly atomic RPC transactions in Supabase to prevent credit loss on failed submissions.

## 7. Trust & Explainability
*   **Match Transparency:** Users can see exactly which keywords and skills overlapped to generate their match score.
*   **Receipts:** JobRaker stores a screenshot or PDF receipt of the filled application in the database to verify what was sent.
*   **Confirmation:** Follow-up webhooks track confirmation pages or parse incoming emails (via Gmail MCP) to verify the application was successfully received by the employer.

## 8. Success Metrics
*   **North Star:** Applications Submitted Successfully Per Active User Per Week.
*   **Quality Metric:** Interview Conversion Rate (derived from successful applications).
*   **Efficiency:** Average Time Saved (targeting 20+ minutes saved per application).
*   **Reliability:** Automation Success Rate (successful Skyvern executions vs. total attempts).

## 9. Next Generation Roadmap (v2.0+)
*   **True Autonomy:** Complete "Set and Forget" mode for trusted sites (Lever, Greenhouse) where the success rate is >99%, completely bypassing manual review.
*   **Interview Scheduling Agent:** Automatically parsing email requests for interviews and scheduling them via connected calendars.
*   **Deep Research Application:** AI agents researching company news to tailor cover letters based on current events and recent company funding rounds.
