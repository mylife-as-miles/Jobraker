/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_ENVIRONMENT?: string
  readonly VITE_ANALYTICS_ID?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_ENABLE_ANALYTICS?: string
  readonly VITE_ENABLE_NOTIFICATIONS?: string
  readonly VITE_ENABLE_REAL_TIME?: string
  readonly VITE_COMPOSIO_GMAIL_CONFIG_ID?: string
  readonly VITE_COMPOSIO_GITHUB_CONFIG_ID?: string
  readonly VITE_COMPOSIO_GOOGLEDRIVE_CONFIG_ID?: string
  readonly VITE_COMPOSIO_GOOGLEDOCS_CONFIG_ID?: string
  readonly VITE_COMPOSIO_CALENDLY_CONFIG_ID?: string
  readonly VITE_COMPOSIO_CAL_CONFIG_ID?: string
  readonly VITE_COMPOSIO_REDDIT_CONFIG_ID?: string
  readonly VITE_COMPOSIO_TWITTER_CONFIG_ID?: string
  readonly VITE_COMPOSIO_HACKERNEWS_CONFIG_ID?: string
  readonly VITE_COMPOSIO_NOTION_CONFIG_ID?: string
  readonly VITE_COMPOSIO_GOOGLECALENDAR_CONFIG_ID?: string
  readonly VITE_COMPOSIO_LINKEDIN_CONFIG_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
