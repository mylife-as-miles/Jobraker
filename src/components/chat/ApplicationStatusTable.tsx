import { useMemo, useState } from "react";
import { ArrowDownUp, Filter, TableProperties } from "lucide-react";

export type ApplicationStatusRecord = {
  id: string;
  company: string;
  role: string;
  status: string;
  location?: string;
  match?: number | null;
  appliedAt?: string;
  updatedAt?: string;
  nextStep?: string;
  runId?: string;
  recentEvents?: { subject?: string; receivedAt?: string; status?: string }[];
};

type SortKey = "company" | "role" | "status" | "match" | "applied" | "activity";

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value?: string) => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
    : "—";
};

const relativeDate = (value?: string) => {
  const date = parseDate(value);
  if (!date) return "No recent activity";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1d";
  return `${days}d`;
};

const statusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("interview") || normalized.includes("offer")) return "border-brand/30 bg-brand/10 text-brand";
  if (normalized.includes("reject") || normalized.includes("fail")) return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (normalized.includes("withdraw")) return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  return "border-sky-300/25 bg-sky-300/10 text-sky-200";
};

const tagsFor = (application: ApplicationStatusRecord) => {
  const tags: string[] = [];
  if (application.runId) tags.push("Auto applied");
  if (application.location?.toLowerCase().includes("remote")) tags.push("Remote");
  if (application.status.toLowerCase().includes("interview")) tags.push("Interview");
  if (application.nextStep?.toLowerCase().includes("follow")) tags.push("Follow-up");
  if ((application.match ?? 0) >= 80) tags.push("High match");
  return tags;
};

const latestActivity = (application: ApplicationStatusRecord) =>
  application.recentEvents?.[0]?.receivedAt || application.updatedAt || application.appliedAt;

const sortValue = (application: ApplicationStatusRecord, key: SortKey) => {
  switch (key) {
    case "match":
      return application.match ?? -1;
    case "applied":
      return parseDate(application.appliedAt)?.getTime() ?? 0;
    case "activity":
      return parseDate(latestActivity(application))?.getTime() ?? 0;
    case "company":
      return application.company.toLowerCase();
    case "role":
      return application.role.toLowerCase();
    case "status":
      return application.status.toLowerCase();
  }
};

const compareValues = (left: string | number, right: string | number) =>
  typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));

export const ApplicationStatusTable = ({
  applications,
}: {
  applications: ApplicationStatusRecord[];
}) => {
  const [statusFilter, setStatusFilter] = useState(false);
  const [highMatchOnly, setHighMatchOnly] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [lastThirtyDays, setLastThirtyDays] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "activity",
    direction: "desc",
  });

  const rows = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    return applications
      .filter((application) => {
        if (statusFilter && !application.status.toLowerCase().includes("interview")) return false;
        if (highMatchOnly && (application.match ?? -1) <= 80) return false;
        if (remoteOnly && !application.location?.toLowerCase().includes("remote")) return false;
        if (lastThirtyDays) {
          const appliedAt = parseDate(application.appliedAt)?.getTime() ?? 0;
          if (appliedAt < cutoff) return false;
        }
        return true;
      })
      .sort((left, right) => {
        const comparison = compareValues(sortValue(left, sort.key), sortValue(right, sort.key));
        return sort.direction === "asc" ? comparison : -comparison;
      });
  }, [applications, highMatchOnly, lastThirtyDays, remoteOnly, sort, statusFilter]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const filters = [
    { label: "Status: Interview", active: statusFilter, onClick: () => setStatusFilter((value) => !value) },
    { label: "Match: > 80%", active: highMatchOnly, onClick: () => setHighMatchOnly((value) => !value) },
    { label: "Location: Remote", active: remoteOnly, onClick: () => setRemoteOnly((value) => !value) },
    { label: "Applied: Last 30 days", active: lastThirtyDays, onClick: () => setLastThirtyDays((value) => !value) },
  ];

  return (
    <section className="my-4 overflow-hidden rounded-xl border border-border bg-background/40" aria-labelledby="application-status-table-title">
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <TableProperties className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h3 id="application-status-table-title" className="text-sm font-semibold text-foreground">Application status</h3>
            <p className="text-xs text-muted-foreground">{applications.length} tracked application{applications.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="size-3.5" aria-hidden="true" />
          {rows.length} shown
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border/70 px-4 py-2.5 [scrollbar-width:none]">
        {filters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={filter.active}
            onClick={filter.onClick}
            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
              filter.active
                ? "border-brand/35 bg-brand/10 text-brand"
                : "border-border bg-card text-muted-foreground hover:border-brand/30 hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left text-xs">
          <thead className="bg-foreground/[0.025] text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              {([
                ["Company", "company"],
                ["Role", "role"],
                ["Status", "status"],
                ["Match", "match"],
                ["Applied", "applied"],
                ["Activity", "activity"],
              ] as [string, SortKey][]).map(([label, key]) => (
                <th key={key} className="border-b border-border/70 px-3 py-2.5 font-medium first:sticky first:left-0 first:z-10 first:bg-card">
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    {label}
                    <ArrowDownUp className={`size-3 ${sort.key === key ? "text-brand" : "text-muted-foreground/50"}`} aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((application) => {
              const activity = latestActivity(application);
              const tags = tagsFor(application);
              return (
                <tr key={application.id} className="border-b border-border/50 last:border-0 hover:bg-brand/[0.035]">
                  <td className="sticky left-0 z-10 bg-card px-3 py-3 align-top">
                    <div className="font-semibold text-foreground">{application.company}</div>
                    {tags.length > 0 ? (
                      <div className="mt-1.5 flex max-w-52 flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-brand/20 bg-brand/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-brand">{tag}</span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top text-foreground/90">{application.role}</td>
                  <td className="px-3 py-3 align-top"><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${statusTone(application.status)}`}>{application.status}</span></td>
                  <td className="px-3 py-3 align-top font-semibold text-foreground">{application.match == null ? "—" : `${application.match}%`}</td>
                  <td className="px-3 py-3 align-top text-muted-foreground">{formatDate(application.appliedAt)}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-foreground/90">{relativeDate(activity)}</div>
                    {application.recentEvents?.[0]?.subject ? <div className="mt-0.5 max-w-44 truncate text-[11px] text-muted-foreground">{application.recentEvents[0].subject}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">No tracked applications match these filters.</div>
      ) : null}
    </section>
  );
};
