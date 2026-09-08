type SubscriptionTier = "Free" | "Starter" | "Basics" | "Pro" | "Ultimate";

const normalizeTier = (tier: string | null | undefined): SubscriptionTier => {
  switch ((tier || "").trim()) {
    case "Starter":
    case "Starter Plan":
      return "Starter";
    case "Basics":
    case "Basic":
      return "Basics";
    case "Pro":
    case "Professional":
      return "Pro";
    case "Ultimate":
    case "Ultimate Plan":
    case "Executive":
    case "Enterprise":
      return "Ultimate";
    default:
      return "Free";
  }
};

const STANDALONE_INTEGRATION_TIERS = new Set<SubscriptionTier>([
  "Basics",
  "Pro",
  "Ultimate",
]);

const PAID_COMPOSIO_ACTIONS = new Set(["initiate", "execute", "debug-configs"]);

export function canUseStandaloneEmailIntegrations(
  tier: string | null | undefined,
  email: string | null | undefined,
) {
  return (
    STANDALONE_INTEGRATION_TIERS.has(normalizeTier(tier)) &&
    typeof email === "string" &&
    email.trim().length > 0
  );
}

export function canUseComposioAction(args: {
  tier: string | null | undefined;
  action: unknown;
  integrationSlug?: string | null;
  purpose?: string | null;
}) {
  const action = typeof args.action === "string" ? args.action : "";
  if (!PAID_COMPOSIO_ACTIONS.has(action)) return true;

  const tier = normalizeTier(args.tier);
  if (STANDALONE_INTEGRATION_TIERS.has(tier)) return true;
  if (tier !== "Starter") return false;

  return (
    action === "initiate" &&
    args.integrationSlug === "gmail" &&
    args.purpose === "recruiter_cold_outreach"
  );
}
