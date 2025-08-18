// Minimal Lingui i18n mock used by the client app.
// Provide `i18n._` so calls like i18n._(msg`...`) work at runtime.
export const i18n = {
  // no-op loader
  loadAndActivate: (_: { locale: string; messages: Record<string, string> }) => {},
  // return the provided string or id as-is
  _: (id: any) => (typeof id === "string" ? id : String(id ?? "")),
} as const;

export default i18n;
