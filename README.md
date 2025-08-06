# JobRaker

> The world's first fully autonomous job application platform. Our AI searches, applies, and optimizes your job hunt 24/7 while you focus on what matters most.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Autonomous Job Search:** Our AI continuously scans thousands of job boards and company websites to find opportunities that match your profile 24/7.
- **Auto-Apply Technology:** Automatically submit tailored applications to relevant positions while you sleep. No manual work required.
- **Dynamic Resume Optimization:** AI automatically customizes your resume for each application, optimizing keywords and formatting for maximum ATS compatibility.
- **Smart Analytics Dashboard:** Track application success rates, response times, and optimize your job search strategy with real-time insights.
- **Intelligent Filtering:** Advanced AI filters ensure applications only go to legitimate, high-quality positions that match your criteria.
- **Real-Time Monitoring:** Get instant notifications about application status, interview requests, and new opportunities as they happen.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/jobraker.git
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root of the project and add the following environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

## Usage

To start the development server, run:

```bash
npm run dev
```

This will start the application on `http://localhost:5173`.

## Project Structure

The project is a single-page application built with React and Vite. The main entry point is `src/index.tsx`. The application is divided into the following main directories:

- `src/components`: Contains reusable UI components.
- `src/screens`: Contains the different pages of the application.
- `src/lib`: Contains the Supabase client and other utility functions.
- `src/hooks`: Contains custom React hooks.
- `src/styles`: Contains global CSS styles.

## Technologies Used

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [GSAP](https://greensock.com/gsap/)
- [Lucide React](https://lucide.dev/guide/react)
- [Recharts](https://recharts.org/)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have any improvements or suggestions.

## License

This project is licensed under the MIT License.
