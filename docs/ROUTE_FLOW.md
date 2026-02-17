# Application Route Flow

This document outlines the route flow of the application, from the landing page to authentication, onboarding, and the dashboard sub-pages.

## 1. Main Router

The main application router is located in `src/index.tsx`. It uses `react-router-dom` to define the top-level routes. The routes are protected using `PublicOnly` and `RequireAuth` components to manage access for authenticated and unauthenticated users.

## 2. Route Flow

### Step 1: Landing Page (Unauthenticated)

- **Route:** `/`
- **Component:** `LandingPage` (from `src/screens/LandingPage`)
- **Description:** This is the initial page for all users. It is only accessible to unauthenticated users.

### Step 2: Authentication (Unauthenticated)

- **Signup:**
    - **Route:** `/signup`
    - **Component:** `JobrackerSignup` (from `src/screens/JobrackerSignup`)
    - **Description:** The user registration page.
- **Login:**
    - **Route:** `/login`
    - **Component:** `Login` (from `src/screens/Login`)
    - **Description:** The user login page.

### Step 3: Onboarding (Authenticated)

- **Route:** `/onboarding`
- **Component:** `Onboarding` (from `src/screens/Onboarding`)
- **Description:** After a user signs up and logs in for the first time, they are redirected to the onboarding page. This route is protected and requires authentication.

### Step 4: Dashboard (Authenticated)

- **Route:** `/dashboard/*`
- **Component:** `Dashboard` (from `src/screens/Dashboard/Dashboard.tsx`)
- **Description:** This is the main page for authenticated users. The `Dashboard` component handles its own internal routing for sub-pages.

## 3. Dashboard Sub-page Routing

The `Dashboard` component does not use `react-router-dom` for its sub-pages. Instead, it uses a React state variable (`currentPage`) to manage the currently displayed page.

- **Navigation:** The sidebar in the `Dashboard` contains navigation links. Clicking a link updates the `currentPage` state.
- **Page Rendering:** A `renderPageContent` function in the `Dashboard` component uses a `switch` statement to render the appropriate sub-page component based on the value of `currentPage`.

The available dashboard pages are:
- `OverviewPage`
- `AnalyticsContent`
- `ChatPage`
- `ResumePage`
- `JobPage`
- `ApplicationPage`
- `SettingsPage`
- `NotificationPage`
- `ProfilePage`

These components are located in `src/screens/Dashboard/pages/`.

## 4. Client App Integration

The main router in `src/index.tsx` also integrates routes from a "client" application located in `src/client`. This includes:

- **Public Resumes:** `/:username/:slug`
- **Client Dashboard:** `/dashboard/resumes`, `/dashboard/settings`
- **Builder:** `/builder/:id`

This creates a unified application from two different code sources.
