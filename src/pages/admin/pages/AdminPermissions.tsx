import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  Minus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabaseClient";
import { getCurrentUserAdminSubRole } from "@/lib/adminUtils";
import { useUserActivities } from "../hooks/useAdminStats";

type AdminSubRole = "owner" | "editor" | "reader";
type PermissionState = "allowed" | "restricted" | "unavailable";

type Capability = {
  id: string;
  label: string;
  hint?: string;
  permissions: Record<AdminSubRole, PermissionState>;
};

type CapabilityGroup = {
  id: string;
  label: string;
  capabilities: Capability[];
};

const ADMIN_ROLES: Array<{
  id: AdminSubRole;
  name: string;
  description: string;
}> = [
  {
    id: "owner",
    name: "Owner",
    description: "Full platform control, including system settings and role changes.",
  },
  {
    id: "editor",
    name: "Editor",
    description: "Can operate the platform and manage customers without owner-only changes.",
  },
  {
    id: "reader",
    name: "Reader",
    description: "Read-only access to operational, customer, and financial insights.",
  },
];

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "operations",
    label: "Operations",
    capabilities: [
      {
        id: "overview",
        label: "View dashboard, activity, and performance",
        hint: "Read platform health and operational metrics.",
        permissions: { owner: "allowed", editor: "allowed", reader: "allowed" },
      },
      {
        id: "jobs",
        label: "Manage job intelligence and queues",
        permissions: { owner: "allowed", editor: "allowed", reader: "restricted" },
      },
      {
        id: "support",
        label: "Manage customer support conversations",
        permissions: { owner: "allowed", editor: "allowed", reader: "restricted" },
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    capabilities: [
      {
        id: "users.view",
        label: "View users and account activity",
        permissions: { owner: "allowed", editor: "allowed", reader: "allowed" },
      },
      {
        id: "users.manage",
        label: "Manage customer accounts and credits",
        hint: "Includes account maintenance, plan changes, and support actions.",
        permissions: { owner: "allowed", editor: "allowed", reader: "restricted" },
      },
      {
        id: "roles.assign",
        label: "Change administrator roles",
        hint: "Owner-only. Role enforcement is applied by Supabase policies.",
        permissions: { owner: "allowed", editor: "restricted", reader: "unavailable" },
      },
    ],
  },
  {
    id: "finance",
    label: "Billing & finance",
    capabilities: [
      {
        id: "finance.view",
        label: "View subscriptions, revenue, and usage",
        permissions: { owner: "allowed", editor: "allowed", reader: "allowed" },
      },
      {
        id: "finance.manage",
        label: "Manage credits and provider balances",
        permissions: { owner: "allowed", editor: "allowed", reader: "restricted" },
      },
      {
        id: "finance.export",
        label: "Export financial and usage data",
        permissions: { owner: "allowed", editor: "allowed", reader: "allowed" },
      },
    ],
  },
  {
    id: "system",
    label: "System",
    capabilities: [
      {
        id: "settings",
        label: "Change system settings",
        permissions: { owner: "allowed", editor: "restricted", reader: "unavailable" },
      },
      {
        id: "database",
        label: "Access database administration",
        hint: "Owner-only database tools and maintenance operations.",
        permissions: { owner: "allowed", editor: "unavailable", reader: "unavailable" },
      },
    ],
  },
];

type AdminMember = {
  id: string;
  name: string;
  email: string;
  role: AdminSubRole;
};

export default function AdminPermissions() {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const { activities, loading, error, refetch } = useUserActivities();
  const [callerRole, setCallerRole] = useState<AdminSubRole | null>(null);
  const [activeRole, setActiveRole] = useState<AdminSubRole>("editor");
  const [query, setQuery] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, AdminSubRole>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error">("success");

  useEffect(() => {
    void getCurrentUserAdminSubRole().then((role) => {
      setCallerRole(role);
      if (role) setActiveRole(role);
    });
  }, []);

  const adminMembers = useMemo<AdminMember[]>(() => {
    return activities.flatMap((user: any) => {
      const adminRole = user.user_roles?.find((role: any) => role.role === "admin");
      if (!adminRole) return [];

      const role = roleOverrides[user.id] || (adminRole.admin_sub_role as AdminSubRole) || "reader";
      return [{
        id: user.id,
        name: user.full_name || user.email.split("@")[0],
        email: user.email,
        role,
      }];
    });
  }, [activities, roleOverrides]);

  const roleCounts = useMemo(() => {
    return ADMIN_ROLES.reduce<Record<AdminSubRole, number>>(
      (counts, role) => {
        counts[role.id] = adminMembers.filter((member) => member.role === role.id).length;
        return counts;
      },
      { owner: 0, editor: 0, reader: 0 },
    );
  }, [adminMembers]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return CAPABILITY_GROUPS.map((group) => ({
      ...group,
      capabilities: group.capabilities.filter((capability) => {
        if (
          normalizedQuery &&
          !`${capability.label} ${capability.hint || ""}`.toLowerCase().includes(normalizedQuery)
        ) {
          return false;
        }

        if (differencesOnly) {
          const states = ADMIN_ROLES.map((role) => capability.permissions[role.id]);
          return states.some((state) => state !== states[0]);
        }

        return true;
      }),
    })).filter((group) => group.capabilities.length > 0);
  }, [differencesOnly, query]);

  const visibleCapabilities = filteredGroups.reduce(
    (total, group) => total + group.capabilities.length,
    0,
  );
  const totalCapabilities = CAPABILITY_GROUPS.reduce(
    (total, group) => total + group.capabilities.length,
    0,
  );
  const canManageRoles = callerRole === "owner";

  const changeMemberRole = async (member: AdminMember, nextRole: AdminSubRole) => {
    if (!canManageRoles || nextRole === member.role) return;
    if (member.id === (await supabase.auth.getUser()).data.user?.id && nextRole !== "owner") {
      setStatusKind("error");
      setStatusMessage("You cannot remove your own owner access from this page.");
      return;
    }

    if (!window.confirm(`Change ${member.name}'s admin role to ${roleLabel(nextRole)}?`)) return;

    setSavingMemberId(member.id);
    setStatusMessage(null);
    const { error: updateError } = await supabase
      .from("user_roles")
      .update({ admin_sub_role: nextRole, updated_at: new Date().toISOString() })
      .eq("user_id", member.id)
      .eq("role", "admin");

    if (updateError) {
      setStatusKind("error");
      setStatusMessage(updateError.message || "Unable to update this administrator role.");
    } else {
      setRoleOverrides((current) => ({ ...current, [member.id]: nextRole }));
      setStatusKind("success");
      setStatusMessage(`${member.name} is now an ${roleLabel(nextRole)} admin.`);
      void refetch();
    }
    setSavingMemberId(null);
  };

  return (
    <div className='mx-auto max-w-7xl space-y-6 pb-12'>
      <header className='relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/[0.1] via-background to-background p-5 shadow-[0_18px_50px_-36px_rgba(47,217,104,0.45)] sm:p-6'>
        <div className='pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-brand/10 blur-3xl' />
        <div className='relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div className='flex items-start gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand'>
              <ShieldCheck className='h-5 w-5' aria-hidden />
            </div>
            <div>
              <p className='text-[10px] font-semibold uppercase tracking-[0.22em] text-brand/80'>
                System · Access control
              </p>
              <h1 className='mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl'>
                Roles & permissions
              </h1>
              <p className='mt-1 max-w-2xl text-sm text-gray-400'>
                Review the enforced admin access model and manage administrator assignments.
              </p>
            </div>
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={() => void refetch()}
            disabled={loading}
            className='w-full border-brand/30 text-gray-300 hover:border-brand hover:bg-brand/10 hover:text-brand sm:w-auto'
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh roles
          </Button>
        </div>
      </header>

      {callerRole && !canManageRoles ? (
        <div className='flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/[0.06] p-4 text-sm text-gray-300'>
          <Lock className='mt-0.5 h-4 w-4 shrink-0 text-brand' aria-hidden />
          <p>
            You have {roleLabel(callerRole)} access. The matrix is live and readable, but only Owner admins can change administrator assignments.
          </p>
        </div>
      ) : null}

      {statusMessage ? (
        <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm text-gray-200 ${statusKind === "success" ? "border-brand/25 bg-brand/[0.08]" : "border-white/[0.14] bg-white/[0.04]"}`} role='status'>
          {statusKind === "success" ? <Check className='mt-0.5 h-4 w-4 shrink-0 text-brand' aria-hidden /> : <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-gray-300' aria-hidden />}
          {statusMessage}
        </div>
      ) : null}

      <div className='grid gap-5 xl:grid-cols-[245px_minmax(0,1fr)]'>
        <aside className='space-y-3'>
          <p className='px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500'>Admin roles</p>
          <div className='grid gap-2 sm:grid-cols-3 xl:grid-cols-1'>
            {ADMIN_ROLES.map((role) => {
              const isActive = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  type='button'
                  onClick={() => setActiveRole(role.id)}
                  className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                    isActive
                      ? "border-brand/35 bg-brand/[0.09] shadow-[0_12px_30px_-26px_rgba(47,217,104,0.7)]"
                      : "border-white/[0.08] bg-white/[0.025] hover:border-brand/20 hover:bg-white/[0.045]"
                  }`}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${isActive ? "bg-brand/15 text-brand" : "bg-white/[0.06] text-gray-400"}`}>
                      <ShieldCheck className='h-3.5 w-3.5' aria-hidden />
                    </span>
                    <span className='rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-gray-400'>
                      {roleCounts[role.id]}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${isActive ? "text-white" : "text-gray-200"}`}>{role.name}</p>
                  <p className='mt-1 line-clamp-2 text-xs leading-5 text-gray-500'>{role.description}</p>
                </button>
              );
            })}
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={() => navigate("/admin/users")}
            className='w-full justify-between border-white/[0.1] text-gray-300 hover:border-brand/30 hover:bg-brand/10 hover:text-brand'
          >
            Manage all users
            <ArrowRight className='h-4 w-4' />
          </Button>
        </aside>

        <section className='min-w-0'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <label className='flex h-10 flex-1 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.025] px-3 focus-within:border-brand/45 focus-within:ring-1 focus-within:ring-brand/25'>
              <Search className='h-4 w-4 text-gray-500' aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Filter capabilities…'
                className='h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600'
              />
              <span className='font-mono text-[10px] tabular-nums text-gray-500'>
                {visibleCapabilities}/{totalCapabilities}
              </span>
            </label>
            <button
              type='button'
              role='switch'
              aria-checked={differencesOnly}
              onClick={() => setDifferencesOnly((current) => !current)}
              className='inline-flex h-10 items-center justify-between gap-3 rounded-lg border border-white/[0.1] bg-white/[0.025] px-3 text-left transition-colors hover:border-brand/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'
            >
              <span className='font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400'>Only differences</span>
              <span className={`relative h-5 w-9 rounded-full transition-colors ${differencesOnly ? "bg-brand" : "bg-white/[0.12]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${differencesOnly ? "translate-x-4" : "translate-x-0.5"}`} />
              </span>
            </button>
          </div>

          <div className='mt-4 overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.025] shadow-[0_20px_55px_-42px_rgba(0,0,0,0.9)]'>
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[740px] border-collapse text-sm'>
                <thead className='bg-background/90 backdrop-blur'>
                  <tr className='border-b border-white/[0.08]'>
                    <th className='min-w-[310px] px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500'>
                      Capability
                    </th>
                    {ADMIN_ROLES.map((role) => (
                      <th
                        key={role.id}
                        className={`w-[120px] border-l border-white/[0.06] px-3 py-3 text-center ${activeRole === role.id ? "bg-brand/[0.06]" : ""}`}
                      >
                        <button
                          type='button'
                          onClick={() => setActiveRole(role.id)}
                          className={`font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${activeRole === role.id ? "text-brand" : "text-gray-500 hover:text-gray-200"}`}
                        >
                          {role.name}
                        </button>
                        <span className='mt-1 block font-mono text-[10px] tabular-nums text-gray-600'>{roleCounts[role.id]} admins</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => (
                    <CapabilityRows key={group.id} group={group} activeRole={activeRole} />
                  ))}
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={ADMIN_ROLES.length + 1} className='px-4 py-14 text-center text-sm text-gray-500'>
                        No capabilities match “{query}”.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.08] px-4 py-3'>
              <PermissionLegend state='allowed' label='Allowed' />
              <PermissionLegend state='restricted' label='Restricted' />
              <PermissionLegend state='unavailable' label='Unavailable' />
              <span className='ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-gray-600'>
                Highlighting {roleLabel(activeRole)} access
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className='overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.025]'>
        <div className='flex flex-col gap-3 border-b border-white/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
          <div className='flex items-start gap-3'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-gray-400'>
              <Users className='h-4 w-4' aria-hidden />
            </div>
            <div>
              <h2 className='text-base font-semibold text-white'>Administrators</h2>
              <p className='mt-0.5 text-xs text-gray-500'>Live assignments from the admin role directory.</p>
            </div>
          </div>
          <span className='font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500'>{adminMembers.length} total</span>
        </div>

        {loading ? (
          <div className='flex items-center justify-center gap-2 px-4 py-12 text-sm text-gray-500'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Loading administrators…
          </div>
        ) : error ? (
          <div className='flex items-start gap-3 p-5 text-sm text-gray-400'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-brand' />
            <div>
              <p>Administrator assignments could not be loaded.</p>
              <p className='mt-1 text-xs text-gray-600'>{error}</p>
            </div>
          </div>
        ) : adminMembers.length === 0 ? (
          <div className='p-8 text-center text-sm text-gray-500'>No administrator assignments were found.</div>
        ) : (
          <div className='divide-y divide-white/[0.06]'>
            {adminMembers.map((member) => (
              <div key={member.id} className='flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium text-gray-100'>{member.name}</p>
                  <p className='mt-0.5 truncate text-xs text-gray-500'>{member.email}</p>
                </div>
                {canManageRoles ? (
                  <label className='flex items-center gap-2 text-xs text-gray-500'>
                    <span className='sr-only'>Admin role for {member.name}</span>
                    <select
                      value={member.role}
                      disabled={savingMemberId === member.id}
                      onChange={(event) => void changeMemberRole(member, event.target.value as AdminSubRole)}
                      className='h-9 rounded-lg border border-white/[0.1] bg-background px-2.5 text-sm text-gray-200 outline-none transition-colors focus:border-brand/45 focus:ring-1 focus:ring-brand/25 disabled:cursor-wait disabled:opacity-60'
                    >
                      {ADMIN_ROLES.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </label>
                ) : (
                  <span className='inline-flex w-fit rounded-full border border-brand/25 bg-brand/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand'>
                    {roleLabel(member.role)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CapabilityRows({ group, activeRole }: { group: CapabilityGroup; activeRole: AdminSubRole }) {
  return (
    <>
      <tr className='border-y border-white/[0.06] bg-white/[0.02]'>
        <td colSpan={ADMIN_ROLES.length + 1} className='px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500'>
          {group.label}
        </td>
      </tr>
      {group.capabilities.map((capability) => (
        <tr key={capability.id} className='border-b border-white/[0.045] last:border-0 hover:bg-white/[0.025]'>
          <td className='px-4 py-3'>
            <p className='text-[13px] font-medium text-gray-200'>{capability.label}</p>
            {capability.hint ? <p className='mt-0.5 text-xs leading-5 text-gray-600'>{capability.hint}</p> : null}
          </td>
          {ADMIN_ROLES.map((role) => (
            <td key={role.id} className={`border-l border-white/[0.045] px-3 py-3 text-center ${activeRole === role.id ? "bg-brand/[0.035]" : ""}`}>
              <PermissionCell state={capability.permissions[role.id]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function PermissionCell({ state }: { state: PermissionState }) {
  if (state === "allowed") {
    return <span className='inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand/15 text-brand' aria-label='Allowed'><Check className='h-3 w-3' strokeWidth={3} /></span>;
  }
  if (state === "restricted") {
    return <span className='inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-gray-500' aria-label='Restricted'><Minus className='h-3.5 w-3.5' /></span>;
  }
  return <span className='inline-flex h-5 w-5 items-center justify-center text-gray-600' aria-label='Unavailable'><Lock className='h-3 w-3' /></span>;
}

function PermissionLegend({ state, label }: { state: PermissionState; label: string }) {
  return <span className='inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500'><PermissionCell state={state} />{label}</span>;
}

function roleLabel(role: AdminSubRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
