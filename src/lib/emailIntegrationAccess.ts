export const EMAIL_INTEGRATION_ALLOWED_EMAIL = "siscostarters@gmail.com";

export function isEmailIntegrationAllowed(email?: string | null): boolean {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase() === EMAIL_INTEGRATION_ALLOWED_EMAIL
  );
}
