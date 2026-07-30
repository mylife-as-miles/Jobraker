export type ComposioAccount = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeComposioSlug(value: unknown): string {
  return asString(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Lifecycle of a Composio connected account as far as the product cares:
 * - `active`: authorization finished, tools can run against it.
 * - `pending`: a shell row Composio creates the moment we call `link()`. The
 *   user has not authorized anything yet, so it must never read as connected.
 * - `inactive`: expired, failed, revoked, or otherwise unusable.
 */
export type ComposioAccountState = "active" | "pending" | "inactive";

const ACTIVE_STATUSES = new Set(["ACTIVE", "CONNECTED", "ENABLED"]);
const PENDING_STATUSES = new Set([
  "INITIALIZING",
  "INITIALIZED",
  "INITIATED",
  "PENDING",
  "CREATED",
  "AWAITING_AUTH",
  "AWAITING_AUTHORIZATION",
]);

export function classifyConnectedAccountStatus(status: unknown): ComposioAccountState {
  const normalized = asString(status).toUpperCase();
  // Some list endpoints omit `status` entirely; those rows only ever show up
  // for accounts that already completed authorization.
  if (!normalized || ACTIVE_STATUSES.has(normalized)) return "active";
  if (PENDING_STATUSES.has(normalized)) return "pending";
  return "inactive";
}

export function normalizeConnectedAccount(account: ComposioAccount) {
  const authConfig = asRecord(account.authConfig) ?? asRecord(account.auth_config);
  const toolkit = asRecord(account.toolkit);
  const app = asRecord(account.app);
  const user = asRecord(account.user);
  const entity = asRecord(account.entity);
  const metadata = asRecord(account.metadata) ?? asRecord(account.meta_data) ?? {};
  const connectionParams = asRecord(account.connectionParams) ??
    asRecord(account.connection_params) ?? asRecord(account.data) ?? {};

  const providerCandidates = [
    authConfig?.provider,
    account.toolkitSlug,
    account.toolkit_slug,
    account.appSlug,
    account.app_slug,
    account.appName,
    account.app_name,
    toolkit?.slug,
    toolkit?.name,
    app?.slug,
    app?.name,
    account.appUniqueId,
    account.app_unique_id,
  ];
  const providers = providerCandidates
    .map(normalizeComposioSlug)
    .filter(Boolean);

  const identifierCandidates = [
    connectionParams.account_name,
    connectionParams.email,
    connectionParams.username,
    connectionParams.accountName,
    metadata.account_name,
    metadata.email,
    metadata.username,
    metadata.accountName,
    account.name,
  ];

  const ownerCandidates = [
    account.userId,
    account.user_id,
    account.entityId,
    account.entity_id,
    user?.id,
    entity?.id,
    metadata.userId,
    metadata.user_id,
    metadata.entityId,
    metadata.entity_id,
  ];

  const status = asString(account.status).toUpperCase();

  return {
    raw: account,
    id: asString(account.id) || null,
    userId: ownerCandidates.map(asString).find(Boolean) ?? null,
    authConfigId: asString(account.authConfigId) ||
      asString(account.auth_config_id) || asString(authConfig?.id) || null,
    providers: [...new Set(providers)],
    status,
    state: classifyConnectedAccountStatus(status),
    identifier: identifierCandidates.map(asString).find(Boolean) ?? null,
  };
}

/**
 * Keeps only the accounts Composio attributes to this user.
 *
 * There is deliberately no "return everything if nothing matched" fallback:
 * one of the upstream listing endpoints is workspace-wide, so a permissive
 * fallback would show (and allow deleting) other tenants' connections.
 */
export function filterConnectedAccountsForUser(
  accounts: ComposioAccount[],
  userId: string,
) {
  const expectedUserId = asString(userId);
  if (!expectedUserId) return [];

  return accounts.filter(
    (account) => normalizeConnectedAccount(account).userId === expectedUserId,
  );
}

function matchesIntegration(
  normalized: ReturnType<typeof normalizeConnectedAccount>,
  options: { slug?: unknown; authConfigId?: unknown },
) {
  const targetSlug = normalizeComposioSlug(options.slug);
  const targetConfigId = asString(options.authConfigId);
  const configMatches = Boolean(targetConfigId) &&
    normalized.authConfigId === targetConfigId;
  const slugMatches = Boolean(targetSlug) &&
    normalized.providers.includes(targetSlug);
  return configMatches || slugMatches;
}

export function findConnectedAccountsForIntegration(
  accounts: ComposioAccount[],
  options: { slug?: unknown; authConfigId?: unknown },
) {
  return accounts.filter((account) =>
    matchesIntegration(normalizeConnectedAccount(account), options),
  );
}

/**
 * Resolves the account that should drive the UI for one integration, plus the
 * state it is in. An `active` account always wins over a `pending` shell so a
 * stale abandoned attempt can never mask a real connection.
 */
export function resolveIntegrationConnection(
  accounts: ComposioAccount[],
  options: { slug?: unknown; authConfigId?: unknown },
): { account: ComposioAccount | null; state: ComposioAccountState } {
  const matches = findConnectedAccountsForIntegration(accounts, options);
  const active = matches.find(
    (account) => normalizeConnectedAccount(account).state === "active",
  );
  if (active) return { account: active, state: "active" };

  const pending = matches.find(
    (account) => normalizeConnectedAccount(account).state === "pending",
  );
  if (pending) return { account: pending, state: "pending" };

  return { account: null, state: "inactive" };
}

/**
 * Returns a fully authorized account only. A half-finished OAuth attempt is
 * not a connection — reporting one as connected is what made the settings UI
 * flip to "Connected" while the consent popup was still open.
 */
export function findActiveConnectedAccount(
  accounts: ComposioAccount[],
  options: { slug?: unknown; authConfigId?: unknown },
) {
  const { account, state } = resolveIntegrationConnection(accounts, options);
  return state === "active" && account ? account : undefined;
}
