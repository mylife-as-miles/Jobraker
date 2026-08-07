import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Link as LinkIcon,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "@/components/ui/modal";
import type { UseComposioIntegrationsResult } from "@/hooks/useComposioIntegrations";
import {
  INTEGRATION_CATEGORY_LABELS,
  INTEGRATION_CATEGORY_ORDER,
  INTEGRATION_STATE_COPY,
  type ComposioIntegration,
  type IntegrationCategory,
  type IntegrationStatus,
  type IntegrationViewState,
} from "@/lib/composioIntegrations";

const BUSY_STATES: IntegrationViewState[] = [
  "connecting",
  "authorizing",
  "verifying",
  "disconnecting",
];

function isBusyState(state: IntegrationViewState) {
  return BUSY_STATES.includes(state);
}

function relativeTime(date: Date | null): string | null {
  if (!date) return null;
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

type StatusPillProps = {
  state: IntegrationViewState;
};

const StatusPill = ({ state }: StatusPillProps) => {
  const copy = INTEGRATION_STATE_COPY[state];

  if (state === "loading") {
    return <Skeleton className='h-6 w-24 rounded-full' />;
  }

  const tone =
    state === "connected"
      ? "border-brand/30 bg-brand/10 text-brand"
      : state === "pending"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : isBusyState(state)
          ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
          : "border-border/50 bg-muted/40 text-muted-foreground";

  const icon =
    state === "connected" ? (
      <Check className='h-3.5 w-3.5 shrink-0' aria-hidden />
    ) : state === "pending" ? (
      <AlertTriangle className='h-3.5 w-3.5 shrink-0' aria-hidden />
    ) : isBusyState(state) ? (
      <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin' aria-hidden />
    ) : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
      role='status'
      aria-live='polite'
    >
      {icon}
      {copy.label}
    </span>
  );
};

type IntegrationCardProps = {
  integration: ComposioIntegration;
  state: IntegrationViewState;
  status: IntegrationStatus | undefined;
  locked: boolean;
  lockedReason?: string;
  onConnect: () => void;
  onDisconnect: () => void;
};

const IntegrationCard = ({
  integration,
  state,
  status,
  locked,
  lockedReason,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) => {
  const Icon = integration.icon;
  const copy = INTEGRATION_STATE_COPY[state];
  const busy = isBusyState(state);
  const isLoading = state === "loading";
  const isDisconnecting = state === "disconnecting";
  // While a disconnect is in flight the card keeps the layout it had, so the
  // control the user just pressed does not disappear out from under them.
  const wasActive = status?.state === "active";
  const isConnected = state === "connected" || (isDisconnecting && wasActive);
  const isPending = state === "pending" || (isDisconnecting && !wasActive);

  const connectLabel = isPending ? "Finish connecting" : "Connect";

  return (
    <div
      data-testid={`integration-card-${integration.slug}`}
      data-state={state}
      className={`group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm ring-1 ring-foreground/5 transition-all ${
        isConnected
          ? "border-brand/30"
          : isPending
            ? "border-amber-500/30"
            : "border-border/40 hover:border-brand/30 hover:bg-muted/40"
      }`}
    >
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex min-w-0 items-start gap-4'>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${integration.accentClass}`}
          >
            <Icon className={`h-6 w-6 ${integration.iconClass}`} aria-hidden />
          </div>

          <div className='min-w-0 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='text-sm font-medium text-foreground/95'>
                {integration.name}
              </h3>
              <StatusPill state={state} />
            </div>

            {isLoading ? (
              <Skeleton className='h-3.5 w-56' />
            ) : isConnected && status?.identifier ? (
              <p
                className='truncate text-xs font-medium text-brand/90'
                title={status.identifier}
              >
                {status.identifier}
              </p>
            ) : null}

            <p className='text-xs leading-relaxed text-muted-foreground'>
              {integration.description}
            </p>

            {copy.hint && !isLoading ? (
              <p
                className={`text-xs ${isPending ? "text-amber-300/90" : "text-sky-300/90"}`}
              >
                {copy.hint}
              </p>
            ) : null}

            {locked && lockedReason ? (
              <p className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Lock className='h-3 w-3 shrink-0' aria-hidden />
                {lockedReason}
              </p>
            ) : null}

            {!isLoading && integration.capabilities.length > 0 ? (
              <ul className='flex flex-wrap gap-1.5 pt-1'>
                {integration.capabilities.map((capability) => (
                  <li
                    key={capability}
                    className='rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground'
                  >
                    {capability}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className='flex shrink-0 flex-wrap items-center gap-2 sm:justify-end'>
          {isLoading ? (
            <Skeleton className='h-9 w-28 rounded-md' />
          ) : isConnected ? (
            <Button
              type='button'
              variant='outline'
              className='border-rose-500/35 text-rose-400 transition-all hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-300'
              onClick={onDisconnect}
              disabled={busy}
              aria-label={`Disconnect ${integration.name}`}
            >
              {isDisconnecting ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <Unplug className='mr-2 h-4 w-4' aria-hidden />
              )}
              {isDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          ) : (
            <>
              {isPending ? (
                <Button
                  type='button'
                  variant='ghost'
                  className='text-muted-foreground hover:text-foreground'
                  onClick={onDisconnect}
                  disabled={busy}
                  aria-label={`Cancel the pending ${integration.name} authorization`}
                >
                  {isDisconnecting ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden />
                  ) : null}
                  Cancel
                </Button>
              ) : null}
              <Button
                type='button'
                variant='outline'
                className='border-border/40 text-muted-foreground transition-all hover:border-brand/30 hover:bg-brand/10 hover:text-foreground'
                onClick={onConnect}
                disabled={busy || locked}
                aria-label={`${connectLabel} ${integration.name}`}
              >
                {busy && !isDisconnecting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden />
                ) : (
                  <LinkIcon className='mr-2 h-4 w-4' aria-hidden />
                )}
                {state === "connecting"
                  ? "Opening…"
                  : state === "authorizing"
                    ? "Waiting…"
                    : state === "verifying"
                      ? "Verifying…"
                      : connectLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export type IntegrationsPanelProps = {
  /**
   * Shared with the Notifications tab so Gmail cannot read as connected in one
   * place and disconnected in the other.
   */
  controller: UseComposioIntegrationsResult;
  /** Pro entitlement for Gmail-backed features. */
  hasEmailIntegrationAccess: boolean;
  loadingEmailIntegrationAccess: boolean;
};

export const IntegrationsPanel = ({
  controller,
  hasEmailIntegrationAccess,
  loadingEmailIntegrationAccess,
}: IntegrationsPanelProps): JSX.Element => {
  const {
    integrations,
    getStatus,
    getViewState,
    hasLoaded,
    isRefreshing,
    lastCheckedAt,
    connectedCount,
    refresh,
    connect,
    disconnect,
  } = controller;

  const [pendingDisconnect, setPendingDisconnect] =
    useState<ComposioIntegration | null>(null);

  const isIntegrationLocked = useCallback(
    (integration: ComposioIntegration) =>
      Boolean(integration.requiresEmailAccess) &&
      (loadingEmailIntegrationAccess || !hasEmailIntegrationAccess),
    [hasEmailIntegrationAccess, loadingEmailIntegrationAccess],
  );

  const grouped = useMemo(() => {
    const map = new Map<IntegrationCategory, ComposioIntegration[]>();
    for (const integration of integrations) {
      const bucket = map.get(integration.category) ?? [];
      bucket.push(integration);
      map.set(integration.category, bucket);
    }
    return INTEGRATION_CATEGORY_ORDER.filter((category) => map.has(category)).map(
      (category) => ({ category, items: map.get(category)! }),
    );
  }, [integrations]);

  const handleDisconnectRequest = useCallback(
    (integration: ComposioIntegration) => {
      // A pending shell has no granted access to revoke, so clearing it needs
      // no confirmation. Removing a live connection does.
      if (getViewState(integration.slug) === "pending") {
        void disconnect(integration);
        return;
      }
      setPendingDisconnect(integration);
    },
    [disconnect, getViewState],
  );

  const confirmDisconnect = useCallback(() => {
    const integration = pendingDisconnect;
    setPendingDisconnect(null);
    if (integration) void disconnect(integration);
  }, [disconnect, pendingDisconnect]);

  const checkedLabel = relativeTime(lastCheckedAt);

  return (
    <div
      id='settings-tab-integrations'
      data-tour='settings-tab-integrations'
      className='mb-20 space-y-6'
    >
      <div className='flex flex-col gap-4 rounded-xl border border-border/40 bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <h2 className='text-base font-medium text-foreground'>
            Connected accounts
          </h2>
          <p className='text-xs text-muted-foreground'>
            {hasLoaded
              ? `${connectedCount} of ${integrations.length} connected${
                  checkedLabel ? ` · checked ${checkedLabel}` : ""
                }`
              : "Checking your connections…"}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          className='shrink-0 border-border/40 text-muted-foreground hover:border-brand/30 hover:bg-brand/10 hover:text-foreground'
          onClick={() => void refresh()}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
          {isRefreshing ? "Checking…" : "Refresh status"}
        </Button>
      </div>

      {grouped.map(({ category, items }) => (
        <section key={category} className='space-y-3'>
          <h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            {INTEGRATION_CATEGORY_LABELS[category]}
          </h3>
          <div className='flex flex-col gap-3'>
            {items.map((integration) => (
              <IntegrationCard
                key={integration.slug}
                integration={integration}
                state={getViewState(integration.slug)}
                status={getStatus(integration.slug)}
                locked={isIntegrationLocked(integration)}
                lockedReason={
                  integration.requiresEmailAccess && !loadingEmailIntegrationAccess
                    ? "Available on Pro plans."
                    : undefined
                }
                onConnect={() => void connect(integration)}
                onDisconnect={() => handleDisconnectRequest(integration)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className='flex items-start gap-3 rounded-xl border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground'>
        <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-brand' aria-hidden />
        <p>
          Agent Mode reads connection status immediately. Tool execution uses the
          connected account and still requires explicit confirmation for posting,
          sending, applying, or other external side effects.
        </p>
      </div>

      <Modal
        open={Boolean(pendingDisconnect)}
        onClose={() => setPendingDisconnect(null)}
        title={`Disconnect ${pendingDisconnect?.name ?? ""}`}
        size='md'
      >
        <div className='space-y-4'>
          <div className='rounded-lg border border-rose-500/20 bg-rose-500/10 p-4'>
            <div className='flex items-start gap-3'>
              <AlertTriangle
                className='mt-0.5 h-5 w-5 shrink-0 text-rose-400'
                aria-hidden
              />
              <div className='space-y-1'>
                <p className='text-sm font-medium text-rose-300'>
                  Agent Mode will lose access to {pendingDisconnect?.name}.
                </p>
                <p className='text-xs text-rose-300/80'>
                  Any workflow that depends on it stops working until you
                  reconnect. Nothing already saved to JobRaker is deleted.
                </p>
              </div>
            </div>
          </div>
          <div className='flex justify-end gap-3'>
            <Button
              variant='outline'
              className='border-foreground/10 text-foreground/70 hover:bg-foreground/5'
              onClick={() => setPendingDisconnect(null)}
            >
              Keep connected
            </Button>
            <Button
              className='bg-rose-600 text-white hover:bg-rose-700'
              onClick={confirmDisconnect}
            >
              <Unplug className='mr-2 h-4 w-4' aria-hidden />
              Disconnect
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationsPanel;
