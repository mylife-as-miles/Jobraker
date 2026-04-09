# JobRaker API Reference

## Overview
JobRaker relies heavily on a serverless backend architecture using **Supabase**. The platform interacts with the database directly using Row Level Security (RLS) via the Supabase client, and heavily utilizes **Supabase Edge Functions** for specialized application logic, automated workflows, AI integrations, and payment processing.

Below is a comprehensive list of the APIs, Webhooks, and Edge Functions utilized in the JobRaker ecosystem.

---

## 1. Authentication APIs (Supabase Auth)
JobRaker uses Supabase's native authentication routes. The interaction is handled via `@supabase/auth-ui-react` and `@supabase/ssr`.
*   **Sign Up:** `POST /auth/v1/signup` (Email/Password, OAuth)
*   **Sign In:** `POST /auth/v1/token?grant_type=password`
*   **Sign Out:** `POST /auth/v1/logout`
*   **Session Refresh:** Token rotation via Refresh Tokens.

---

## 2. Supabase Edge Functions
These are deployed serverless functions housed in `backend/supabase/functions/`. They are typically invoked via `supabase.functions.invoke('function-name')`.

### Core Application & Automation
*   **`apply-to-jobs`**
    *   **Method:** POST
    *   **Description:** Orchestrates the core job application automation. It prepares user profile data, enriches it with a signed resume URL, and triggers the Skyvern agent to execute the application on the target job board.
*   **`get-run`**
    *   **Method:** GET
    *   **Description:** Polls the Skyvern API to fetch the run status of an ongoing automated application. Returns telemetry such as screenshots, recording URLs, and parsed output states.
*   **`skyvern-webhook`**
    *   **Method:** POST
    *   **Description:** Webhook handler that receives asynchronous callbacks from Skyvern upon the completion, failure, or timeout of an automated application run. Updates the database `applications` status.

### Job Discovery & Matching
*   **`jobs-cron`**
    *   **Method:** POST / CRON
    *   **Description:** A scheduled recurring cron job that ingests new job listings from external sources (leveraging Firecrawl for scraping when necessary).
*   **`get-jobs`**
    *   **Method:** GET
    *   **Description:** Lightweight read endpoint to quickly fetch recent, verified job listings from the database.
*   **`jobs-search`**
    *   **Method:** POST
    *   **Description:** Advanced job search query handler incorporating full-text search and specific filters (location, salary, remote status).
*   **`process-and-match`**
    *   **Method:** POST
    *   **Description:** Live search and extraction pipeline handling multi-source parsing. Matches newly ingested jobs against active users.
*   **`calculate-match-score`**
    *   **Method:** POST
    *   **Description:** Compares a specific Job Description against a user's resume/profile to generate an AI confidence "Match Score" (0-100) and extracts keyword overlaps.
*   **`evaluate-job-fit`**
    *   **Method:** POST
    *   **Description:** Performs a detailed, verbose analysis of a user's fit for a role, providing actionable feedback on missing skills or potential red flags.

### Resume & Profile Intelligence
*   **`parse-resume`**
    *   **Method:** POST
    *   **Description:** Receives a raw resume file (PDF, DOCX, TXT) and uses LLMs to extract the content into structured JSON (Education, Experience, Skills) for the user's profile.
*   **`analyze-resume`**
    *   **Method:** POST
    *   **Description:** Analyzes a parsed resume for general improvements, structural weaknesses, and missing critical sections.
*   **`tailor-resume`**
    *   **Method:** POST
    *   **Description:** Generates a custom, targeted version of a user's resume that emphasizes skills and experiences specifically relevant to a provided Job Description.
*   **`generate-cover-letter`**
    *   **Method:** POST
    *   **Description:** Uses an LLM to automatically generate a persuasive, highly-personalized cover letter based on the user's profile and the target job description.
*   **`polish-content`** / **`generate-title`**
    *   **Method:** POST
    *   **Description:** Utility endpoints for AI content enhancements, grammar improvements, and auto-generating role titles.

### Payments & Credits
*   **`init-payment`**
    *   **Method:** POST
    *   **Description:** Generates a checkout session via a payment provider (e.g., Paystack). Returns a checkout URL for the user to purchase application credits.
*   **`paystack-webhook`**
    *   **Method:** POST
    *   **Description:** Listens for payment provider webhooks (e.g., `charge.success`). Verifies the transaction signature and securely credits the user's account in the database via atomic RPCs.

### Auxiliary & Integrations
*   **`interview-session`**
    *   **Method:** POST / WebSocket
    *   **Description:** Manages the AI-driven mock interview simulation and chat interactions.
*   **`schedule-interview`**
    *   **Method:** POST
    *   **Description:** Integrates with calendar APIs to tentatively hold dates for upcoming employer interviews.
*   **`firecrawl-health`**
    *   **Method:** GET
    *   **Description:** Diagnostic check on the Firecrawl scraping infrastructure.
*   **`composio-gmail-auth`**
    *   **Method:** POST
    *   **Description:** Authenticates user actions via Composio for external integrations, such as reading Gmail for interview follow-ups.
*   **`list-users`**
    *   **Method:** GET (Admin Only)
    *   **Description:** Admin-only endpoint for fetching users in the platform.

---

## 3. Database APIs (PostgreSQL / PostgREST)
Because JobRaker uses Supabase, the frontend regularly calls the generated REST API directly, secured by Row-Level Security (RLS) policies.

*   `GET /rest/v1/jobs` (Fetch jobs)
*   `GET /rest/v1/profiles` (Fetch user profile data)
*   `GET /rest/v1/profile_experiences`
*   `GET /rest/v1/profile_education`
*   `GET /rest/v1/profile_skills`
*   `GET /rest/v1/applications` (Fetch user application statuses)

### Key RPC Functions
The database includes custom Postgres SQL functions (RPCs) utilized by the application to bypass standard REST limitations or ensure atomic transactions:
*   `rpc('deduct_credits', { amount: 1 })`: Atomically decreases the user's credit balance when an application is successfully initiated.
*   `rpc('add_credits', { amount: 10 })`: Used by the payment webhook to grant credits securely.

## 4. Real-time Subscriptions (WebSockets)
JobRaker uses Supabase Realtime to push live updates to the client:
*   **Channel (`applications`)**: Subscribes to `UPDATE` events on the `applications` table to reflect live changes in Skyvern execution statuses (e.g., `draft_status` changing from `processing` to `sent`).
*   **Channel (`profile_*`)**: Stream instantly updates to user profile elements (skills, education, experiences) across multiple sessions.
