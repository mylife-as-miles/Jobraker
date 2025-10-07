# JobRaker 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

> An AI-powered platform to automate your job search and application process. JobRaker finds relevant job postings, populates your personal queue, and helps you apply faster.

## ✨ Core Features

-   **🤖 AI-Powered Job Discovery**: Leverages Firecrawl to perform deep research and find relevant job postings based on your profile and search queries.
-   ** personalized Job Queue**: Every user gets a personal job queue where scraped jobs are stored and managed.
-   **🚀 Automated Application Workflow**: Integrates with Skyvern to automate the job application process (under development).
-   **📄 AI Cover Letter Generation**: Creates tailored cover letters for specific job applications.
-   **📝 Resume Management**: Build, upload, and manage multiple resumes.
-   **📊 Dashboard & Analytics**: A central hub to track your job search progress, applications, and profile settings.
-   **⚡ Real-time Updates**: Built on Supabase Realtime for a seamless, live experience.

## 🛠 Tech Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion
-   **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
-   **Third-Party Services**:
    -   **Firecrawl**: For web scraping and job discovery.
    -   **Skyvern**: For application automation.
    -   **OpenAI**: For AI-powered features like cover letter generation.

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18.0.0 or higher)
-   npm (v8.0.0 or higher)
-   Git
-   Supabase CLI

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mylife-as-miles/Jobraker.git
    cd Jobraker
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory and add your Supabase project credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Configure Backend Functions:**
    The Supabase Edge Functions require their own environment variables. These must be set in your Supabase project's dashboard under **Project Settings > Functions**.

    -   `SUPABASE_URL`: Your project URL.
    -   `SUPABASE_SERVICE_ROLE_KEY`: Your project's service role key.
    -   `FIRECRAWL_API_KEY`: Your API key for Firecrawl.
    -   `SKYVERN_API_KEY`: Your API key for Skyvern.
    -   `OPENAI_API_KEY`: Your API key for OpenAI.

### Running the Application

1.  **Start the frontend development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

2.  **Running Supabase Locally (Optional):**
    If you want to run the Supabase stack locally for development:
    ```bash
    # Make sure Docker is running
    npm run supabase:start
    ```
    This will spin up local instances of the database, auth, and other Supabase services.

## 🏗 Architecture Overview

This project is a modern web application with a React-based frontend and a serverless backend powered by Supabase Edge Functions.

### Frontend

The frontend is built with Vite and React. It features a rich user interface with a dashboard for managing jobs, applications, and user profiles. State management is handled through a combination of React hooks, Context API, and TanStack Query for server state.

### Backend (Supabase Edge Functions)

The core business logic resides in a set of serverless functions located in the `supabase/functions/` directory.

-   `process-and-match`: The main job discovery pipeline. It uses Firecrawl to scrape for jobs based on user queries and then saves them to the user's personal `jobs` table.
-   `apply-to-jobs`: Orchestrates the automated job application process by triggering Skyvern workflows.
-   `get-jobs`: A general-purpose endpoint for searching the public `job_listings` table.
-   `generate-cover-letter`: Uses OpenAI to generate cover letters.
-   `jobs-cron`: A scheduled function that periodically ingests jobs from various sources into the public `job_listings` table.
-   `skyvern-webhook`: A webhook handler for receiving asynchronous updates from Skyvern about the status of job applications.

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License.