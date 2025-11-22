/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
