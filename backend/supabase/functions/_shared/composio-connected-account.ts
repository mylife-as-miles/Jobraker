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

  return {
    raw: account,
    id: asString(account.id) || null,
    userId: ownerCandidates.map(asString).find(Boolean) ?? null,
    authConfigId: asString(account.authConfigId) ||
      asString(account.auth_config_id) || asString(authConfig?.id) || null,
    providers: [...new Set(providers)],
    status: asString(account.status).toUpperCase(),
    identifier: identifierCandidates.map(asString).find(Boolean) ?? null,
  };
}

export function filterConnectedAccountsForUser(
  accounts: ComposioAccount[],
  userId: string,
) {
  const expectedUserId = asString(userId);
  if (!expectedUserId) return [];

  const filtered = accounts.filter((account) => {
    const norm = normalizeConnectedAccount(account);
    return !norm.userId || norm.userId === expectedUserId;
  });

  return filtered.length > 0 ? filtered : accounts;
}

export function findActiveConnectedAccount(
  accounts: ComposioAccount[],
  options: { slug?: unknown; authConfigId?: unknown },
) {
  const targetSlug = normalizeComposioSlug(options.slug);
  const targetConfigId = asString(options.authConfigId);

  return accounts.find((account) => {
    const normalized = normalizeConnectedAccount(account);
    const isValidStatus = !normalized.status || ["ACTIVE", "INITIALIZED", "INITIATED", "CONNECTED"].includes(normalized.status);
    if (!isValidStatus) return false;
    const configMatches = Boolean(targetConfigId) &&
      normalized.authConfigId === targetConfigId;
    const slugMatches = Boolean(targetSlug) &&
      normalized.providers.includes(targetSlug);
    return configMatches || slugMatches;
  });
}
