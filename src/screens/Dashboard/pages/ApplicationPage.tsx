import SortDropdown from "@/components/SortDropdown";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useApplications,
  type ApplicationStatus,
} from "../../../hooks/useApplications";
import { applyMicro1ReferralToUrl } from "../../../utils/micro1Referral";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/applicationState";

/** All + pipeline statuses for filters, URL params, and prefs */
const APPLICATION_STATUS_FILTERS = ["All", ...APPLICATION_STATUS_OPTIONS] as const;
import { Skeleton } from "../../../components/ui/skeleton";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";
import { scheduleInterviewViaEdge, type ScheduleInterviewResponse } from "../../../services/ai/scheduleInterview";
import { useGamification } from "../../../hooks/useGamification";
import {
  fetchJobEvaluationReport,
  type JobEvaluationReport as JobEvaluationReportData,
} from "../../../services/jobs/jobEvaluation";

import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { useToast } from "../../../components/ui/toast";
import { createClient } from "../../../lib/supabaseClient";

import {
  List as ListIcon,
  Search,
  Columns,
  ExternalLink,
  Link2,
  RefreshCw,
  GanttChart,
  Calendar as CalendarIcon,
  Table as TableIcon,
  Bot,
  ClipboardList,
  Lock,
  Mail,
  Zap,
  Trash2,
  Info,
  Clock,
} from "lucide-react";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
  KanbanCards,
  KanbanCard,
} from "../../../components/ui/kibo-ui/kanban";
import {
  ListProvider,
  ListGroup,
  ListHeader,
  ListItems,
  ListItem,
  type DragEndEvent as ListDragEndEvent,
} from "../../../components/ui/kibo-ui/list";
import {
  TableProvider,
  TableHeader as KTableHeader,
  TableHeaderGroup,
  TableHead as KTableHead,
  TableColumnHeader,
  TableBody as KTableBody,
  TableRow as KTableRow,
  TableCell as KTableCell,
  type ColumnDef,
} from "../../../components/ui/kibo-ui/table";
import Gantt, { GanttItem } from "../../../components/ui/kibo-ui/gantt";
import KiboCalendar, {
  CalendarEvent,
} from "../../../components/ui/kibo-ui/calendar";
import CalendarDayDetail from "../../../components/ui/kibo-ui/CalendarDayDetail";
import Modal from "../../../components/ui/modal";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { getProxiedLogoUrl } from "../../../lib/utils";

type SortOption = "score" | "recent" | "company" | "status";

function getCompanyInitials(company?: string | null, jobTitle?: string | null) {
  const source = (company || jobTitle || "")
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ");

  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials || "JR";
}

function resolveCompanyLogo(logo?: string | null) {
  const value = logo?.trim();
  if (!value) return null;
  return getProxiedLogoUrl(value) || null;
}

function compactText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function formatAiEvaluationNotes(
  evaluation: JobEvaluationReportData | null,
): string {
  if (!evaluation) return "";

  const fitLine = [
    `Match score: ${evaluation.confidence_score}%`,
    evaluation.exact_fit_evidence.length
      ? `Strengths: ${evaluation.exact_fit_evidence.slice(0, 2).join("; ")}`
      : "",
    evaluation.blockers.length
      ? `Needs attention: ${evaluation.blockers.slice(0, 2).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join(". ");

  const tailoringLine = evaluation.tailoring_suggestions.length
    ? `Tailoring: ${evaluation.tailoring_suggestions.slice(0, 2).join("; ")}`
    : "";

  return [fitLine, tailoringLine].filter(Boolean).join("\n\n").trim();
}

function getAiCompensationSummary(
  evaluation: JobEvaluationReportData | null,
): string {
  if (!evaluation) return "";

  const summary = compactText(evaluation.compensation.summary);
  const notes = evaluation.compensation.notes.slice(0, 2).join("; ");
  const signals = evaluation.compensation.signals.slice(0, 2).join("; ");

  return [summary, notes, signals]
    .map((item) => compactText(item))
    .filter((item) => item && item !== "Compensation not evaluated")
    .join(" ");
}

function CompanyMark({
  logo,
  company,
  jobTitle,
  size = "md",
}: {
  logo?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [didError, setDidError] = useState(false);
  const logoUrl = useMemo(() => resolveCompanyLogo(logo), [logo]);
  const initials = useMemo(
    () => getCompanyInitials(company, jobTitle),
    [company, jobTitle],
  );

  const sizeClass =
    size === "sm"
      ? "h-11 w-11 rounded-2xl"
      : size === "lg"
        ? "h-16 w-16 rounded-[1.35rem]"
        : "h-14 w-14 rounded-[1.15rem]";
  const paddingClass =
    size === "sm" ? "p-2.5" : size === "lg" ? "p-3.5" : "p-3";
  const textClass =
    size === "sm" ? "text-xs" : size === "lg" ? "text-lg tracking-[0.18em]" : "text-sm";

  return (
    <div
      className={[
        "relative isolate shrink-0 overflow-hidden border border-[#1dff00]/15",
        "bg-[radial-gradient(circle_at_top,_rgba(29,255,0,0.22),_rgba(10,14,18,0.98)_68%)]",
        "shadow-[0_14px_34px_rgba(0,0,0,0.28)]",
        sizeClass,
      ].join(" ")}
    >
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),transparent_45%)] opacity-60' />
      {logoUrl && !didError ? (
        <img
          src={logoUrl}
          alt=''
          loading='lazy'
          className={`relative h-full w-full object-contain ${paddingClass}`}
          onError={() => setDidError(true)}
        />
      ) : (
        <div className='relative flex h-full w-full items-center justify-center'>
          <span
            className={`font-semibold uppercase text-[#d8ffe2] ${textClass}`}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}

function getApplicationStatusColor(status: ApplicationStatus) {
  if (status === "Draft") return "#2dd4bf";
  if (status === "Applied") return "#1dff00";
  if (status === "Interview") return "#1dff00";
  if (status === "Offer") return "#10B981";
  if (status === "Rejected") return "#1dff00";
  if (status === "Failed") return "#f97316";
  if (status === "Terminated") return "#e11d48";
  if (status === "Withdrawn") return "#94A3B8";
  return "#6B7280";
}

function isQueuedApplication(status: ApplicationStatus, providerStatus?: string | null) {
  return status === "Pending" && providerStatus === "waiting";
}

function getApplicationStatusDisplay(status: ApplicationStatus, providerStatus?: string | null) {
  return isQueuedApplication(status, providerStatus) ? "Queued" : status;
}

function getApplicationStatusDisplayColor(
  status: ApplicationStatus,
  providerStatus?: string | null,
) {
  return isQueuedApplication(status, providerStatus)
    ? "#38bdf8"
    : getApplicationStatusColor(status);
}

function StatusBadge({
  status,
  providerStatus,
}: {
  status: ApplicationStatus;
  providerStatus?: string | null;
}) {
  const label = getApplicationStatusDisplay(status, providerStatus);
  const dc = getApplicationStatusDisplayColor(status, providerStatus);
  const badge = (
    <span
      className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border'
      style={{
        backgroundColor: `${dc}18`,
        borderColor: `${dc}45`,
        color: dc,
      }}
    >
      <span
        className='h-1.5 w-1.5 rounded-full shadow-[0_0_4px_currentColor]'
        style={{ backgroundColor: dc }}
      />
      {label}
    </span>
  );

  if (!isQueuedApplication(status, providerStatus)) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side='bottom' className='max-w-64 leading-relaxed'>
          This application is waiting for an automation slot. Higher tiers and
          concurrency boosts get more parallel runs.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ApplicationsListView({
  filtered,
  selectedStatus,
  update,
  refresh,
  setDetailId,
}: {
  filtered: Array<{
    id: string;
    job_title: string;
    company: string;
    location: string;
    status: ApplicationStatus;
    applied_date: string;
    interview_date: string | null;
    logo: string | null;
    app_url?: string | null;
    recording_url?: string | null;
    match_score?: number;
  }>;
  selectedStatus: "All" | ApplicationStatus;
  update: (
    id: string,
    patch: Partial<{ status: ApplicationStatus }>,
  ) => Promise<unknown>;
  refresh: () => Promise<unknown>;
  setDetailId: (id: string) => void;
}) {
  const statuses: ApplicationStatus[] = [...APPLICATION_STATUS_OPTIONS];

  return (
    <div className='overflow-hidden rounded-2xl border border-[#1dff00]/20 bg-gradient-to-br from-background via-background to-background shadow-[0_0_30px_rgba(29,255,0,0.15)] backdrop-blur-xl'>
      <div className='pointer-events-none absolute -top-20 left-0 h-64 w-64 rounded-full bg-[#1dff00]/10 blur-3xl opacity-40' />

      <ListProvider
        onDragEnd={async (e: ListDragEndEvent) => {
          const active = e.active?.data?.current as any;
          const over = e.over?.id as string | undefined;
          if (!active || !over || active.parent === over) return;
          const appId = active.id as string;
          try {
            await update(appId, { status: over as ApplicationStatus });
          } catch {
            await refresh();
          }
        }}
        className='divide-y divide-[#1dff00]/5'
      >
        {statuses.map((status) => {
          const rows = filtered.filter((a) => a.status === status);
          const color = getApplicationStatusColor(status);
          if (rows.length === 0 && selectedStatus !== "All") return null;

          return (
            <ListGroup
              key={status}
              id={status}
              className='flex flex-col'
            >
              <ListHeader
                name={status}
                color={color}
                className='sticky top-0 z-10 border-b border-[#1dff00]/10 bg-background/95 backdrop-blur-xl'
              >
                <div className='flex items-center gap-3 px-4 py-3'>
                  <div
                    className='h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]'
                    style={{ backgroundColor: color }}
                  />
                  <span className='text-sm font-semibold text-foreground/90'>
                    {status}
                  </span>
                  <span
                    className='ml-auto inline-flex items-center gap-1.5 rounded-lg border bg-foreground/5 px-2.5 py-1 text-xs font-medium'
                    style={{ borderColor: color + "40", color }}
                  >
                    {rows.length}
                  </span>
                </div>
              </ListHeader>

              <ListItems className='grid flex-none gap-3 p-3 sm:p-4'>
                {rows.length === 0 && (
                  <div className='rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.02] px-6 py-10 text-center'>
                    <div className='mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.04]'>
                      <div className='h-6 w-6 rounded-xl bg-gradient-to-br from-foreground/10 to-transparent' />
                    </div>
                    <div className='text-xs font-medium uppercase tracking-[0.16em] text-foreground/35'>
                      No {status.toLowerCase()} applications
                    </div>
                  </div>
                )}

                {rows.map((a, idx) => (
                  <ListItem
                    key={a.id}
                    id={a.id}
                    name={a.job_title}
                    index={idx}
                    parent={status}
                    className='group relative overflow-hidden rounded-[1.4rem] border-0 bg-transparent p-0 shadow-none'
                  >
                    <div
                      className='w-full cursor-pointer rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition-[border-color,box-shadow,transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#1dff00]/28 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.024))] hover:shadow-[0_22px_48px_rgba(0,0,0,0.32)] active:scale-[0.985]'
                      onClick={() => setDetailId(a.id)}
                    >
                      <div className='flex items-start gap-4'>
                        <CompanyMark
                          logo={a.logo}
                          company={a.company}
                          jobTitle={a.job_title}
                        />

                        <div className='min-w-0 flex-1'>
                          <div className='flex flex-wrap items-start justify-between gap-3'>
                            <div className='min-w-0'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <h3
                                  className='truncate text-base font-semibold text-foreground'
                                  title={a.job_title}
                                >
                                  {a.job_title}
                                </h3>
                                <MatchScoreBadge score={a.match_score} />
                              </div>
                              <div className='mt-1 truncate text-sm font-medium text-foreground/60'>
                                {a.company}
                              </div>
                            </div>

                            <span
                              className='inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors'
                              style={{
                                backgroundColor: color + "15",
                                borderColor: color + "3D",
                                color,
                              }}
                            >
                              {a.status}
                            </span>
                          </div>

                          <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground/45'>
                            <span className='inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1'>
                              <svg
                                className='h-3.5 w-3.5'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                                />
                              </svg>
                              {new Date(a.applied_date).toLocaleDateString()}
                            </span>

                            {a.location && (
                              <span className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1'>
                                <svg
                                  className='h-3.5 w-3.5 flex-shrink-0'
                                  fill='none'
                                  viewBox='0 0 24 24'
                                  stroke='currentColor'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                                  />
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                                  />
                                </svg>
                                <span className='truncate'>{a.location}</span>
                              </span>
                            )}

                            {a.interview_date && (
                              <span className='inline-flex items-center gap-1.5 rounded-full border border-[#1dff00]/20 bg-[#1dff00]/10 px-2.5 py-1 text-[#1dff00]'>
                                <svg
                                  className='h-3.5 w-3.5'
                                  fill='none'
                                  viewBox='0 0 24 24'
                                  stroke='currentColor'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                                  />
                                </svg>
                                Interview{" "}
                                {new Date(a.interview_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {(a.app_url || a.recording_url) && (
                            <div className='mt-3 flex flex-wrap items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100'>
                              {a.app_url && (
                                <a
                                  href={applyMicro1ReferralToUrl(a.app_url)}
                                  target='_blank'
                                  rel='noreferrer'
                                  onClick={(e) => e.stopPropagation()}
                                  className='inline-flex items-center gap-1.5 rounded-xl border border-[#1dff00]/25 bg-[#1dff00]/10 px-3 py-1.5 text-xs font-medium text-[#1dff00] transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-[#1dff00]/16 active:scale-95'
                                >
                                  <ExternalLink className='h-3.5 w-3.5' />
                                  Open role
                                </a>
                              )}
                              {a.recording_url && (
                                <a
                                  href={a.recording_url}
                                  target='_blank'
                                  rel='noreferrer'
                                  onClick={(e) => e.stopPropagation()}
                                  className='inline-flex items-center gap-1.5 rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium text-foreground/70 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-foreground/15 hover:bg-foreground/[0.08] hover:text-foreground active:scale-95'
                                >
                                  <Link2 className='h-3.5 w-3.5' />
                                  Recording
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </ListItem>
                ))}
              </ListItems>
            </ListGroup>
          );
        })}
      </ListProvider>
    </div>
  );
}

function ApplicationPage() {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError, info } = useToast();
  const {
    applications,
    exportCSV,
    update,
    remove,
    refresh,
    loading: appsLoading,
  } = useApplications();
  const gamificationHook = useGamification();

  // Debounced search state: raw input updates immediately; searchQuery drives filters.
  const [rawSearch, setRawSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    "All" | ApplicationStatus
  >("All");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [viewMode, setViewMode] = useState<
    "gantt" | "kanban" | "calendar" | "table"
  >("gantt");
  const [ganttZoom, setGanttZoom] = useState(() => {
    const z = Number(localStorage.getItem("jr.apps.gantt.zoom") || "1");
    return Number.isFinite(z) ? Math.min(4, Math.max(0, z)) : 1;
  });
  const [showFuture, setShowFuture] = useState(
    () => localStorage.getItem("jr.apps.gantt.future") !== "0",
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDeepLinkApplicationId, setPendingDeepLinkApplicationId] = useState<string | null>(null);
  const [nextStepOpen, setNextStepOpen] = useState(false);
  const [nextStepText, setNextStepText] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryText, setSalaryText] = useState("");
  const [detailEvaluation, setDetailEvaluation] =
    useState<JobEvaluationReportData | null>(null);
  const [detailEvaluationLoading, setDetailEvaluationLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingApplication, setDeletingApplication] = useState(false);
  const [interviewAgentOpen, setInterviewAgentOpen] = useState(false);
  const [interviewEmailText, setInterviewEmailText] = useState("");
  const [interviewAgentLoading, setInterviewAgentLoading] = useState(false);
  const [interviewAgentResult, setInterviewAgentResult] = useState<ScheduleInterviewResponse | null>(null);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState<string | null>(
    null,
  );
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasInterviewAssistantAccess = hasSubscriptionAccess(subscriptionTier, "Pro");
  const hasGmailIntegrationAccess = hasSubscriptionAccess(subscriptionTier, "Pro");
  const detailApp = useMemo(
    () => applications.find((a) => a.id === detailId) || null,
    [detailId, applications],
  );
  const aiNotesText = useMemo(
    () => formatAiEvaluationNotes(detailEvaluation),
    [detailEvaluation],
  );
  const displayedNotesText = useMemo(
    () => compactText(detailApp?.notes) || aiNotesText,
    [detailApp?.notes, aiNotesText],
  );
  const aiCompensationSummary = useMemo(
    () => getAiCompensationSummary(detailEvaluation),
    [detailEvaluation],
  );

  // Update notes text when detailApp changes
  useEffect(() => {
    if (detailApp) {
      setNotesText(detailApp.notes || "");
      setSalaryText(detailApp.salary || "");
      setEditingNotes(false);
      setEditingSalary(false);
    }
  }, [detailApp]);

  useEffect(() => {
    if (!detailApp || editingNotes) return;
    if (compactText(detailApp.notes)) return;
    if (!aiNotesText) return;
    setNotesText(aiNotesText);
  }, [detailApp, editingNotes, aiNotesText]);

  useEffect(() => {
    if (!detailApp?.job_id) {
      setDetailEvaluation(null);
      setDetailEvaluationLoading(false);
      return;
    }

    let cancelled = false;
    setDetailEvaluationLoading(true);

    void fetchJobEvaluationReport(detailApp.job_id)
      .then((report) => {
        if (!cancelled) {
          setDetailEvaluation(report);
        }
      })
      .catch((error) => {
        console.error("Failed to load application evaluation", error);
        if (!cancelled) {
          setDetailEvaluation(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailEvaluationLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailApp?.job_id]);

  // Restore preferences on mount
  useEffect(() => {
    try {
      // Read deep-link filters first
      const u = new URL(window.location.href);
      const qsStatus = u.searchParams.get("status");
      const qsQuery = u.searchParams.get("q");
      const qsView = u.searchParams.get("view");
      const qsApplication = u.searchParams.get("application");
      if (qsStatus && (APPLICATION_STATUS_FILTERS as readonly string[]).includes(qsStatus))
        setSelectedStatus(qsStatus as any);
      if (typeof qsQuery === "string" && qsQuery.length)
        setSearchQuery(qsQuery);
      if (
        qsView &&
        (qsView === "gantt" ||
          qsView === "kanban" ||
          qsView === "calendar" ||
          qsView === "table")
      )
        setViewMode(qsView as any);
      if (qsApplication && qsApplication.trim()) {
        setPendingDeepLinkApplicationId(qsApplication.trim());
      }

      const raw = localStorage.getItem("jr.apps.prefs.v1");
      if (raw) {
        const p = JSON.parse(raw);
        // Only apply stored prefs if not overridden by query params
        if (
          !qsView &&
          (p.viewMode === "gantt" ||
            p.viewMode === "kanban" ||
            p.viewMode === "calendar" ||
            p.viewMode === "table")
        )
          setViewMode(p.viewMode);
        if (
          !qsStatus &&
          (APPLICATION_STATUS_FILTERS as readonly string[]).includes(p.selectedStatus)
        )
          setSelectedStatus(p.selectedStatus as any);
        if (["score", "recent", "company", "status"].includes(p.sortBy))
          setSortBy(p.sortBy);
        if (!qsQuery && typeof p.searchQuery === "string")
          setSearchQuery(p.searchQuery);
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (!pendingDeepLinkApplicationId) return;
    if (!applications.some((application) => application.id === pendingDeepLinkApplicationId)) {
      return;
    }
    setDetailId(pendingDeepLinkApplicationId);
    setPendingDeepLinkApplicationId(null);
  }, [applications, pendingDeepLinkApplicationId]);

  // Persist preferences when they change
  useEffect(() => {
    try {
      const payload = { viewMode, selectedStatus, sortBy, searchQuery };
      localStorage.setItem("jr.apps.prefs.v1", JSON.stringify(payload));
    } catch { }
  }, [viewMode, selectedStatus, sortBy, searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem("jr.apps.gantt.zoom", String(ganttZoom));
    } catch { }
  }, [ganttZoom]);
  useEffect(() => {
    try {
      localStorage.setItem("jr.apps.gantt.future", showFuture ? "1" : "0");
    } catch { }
  }, [showFuture]);

  useEffect(() => {
    let cancelled = false;
    const checkGmailConnection = async () => {
      try {
        if (loadingTier || !hasGmailIntegrationAccess) {
          if (!cancelled) {
            setIsGmailConnected(false);
            setGmailConnectedEmail(null);
          }
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setIsGmailConnected(false);
            setGmailConnectedEmail(null);
          }
          return;
        }
        const { data, error } = await supabase.functions.invoke("gmail-auth", {
          body: { action: "status" },
        });
        if (error) throw error;
        const payload = data as {
          isConnected?: boolean;
          email?: string | null;
        } | null;
        if (!cancelled && payload?.isConnected !== undefined) {
          const connected = !!payload.isConnected;
          setIsGmailConnected(connected);
          const raw = payload.email;
          setGmailConnectedEmail(
            connected &&
              typeof raw === "string" &&
              raw.trim().length > 0
              ? raw.trim()
              : null,
          );
        }
      } catch {
        if (!cancelled) {
          setIsGmailConnected(false);
          setGmailConnectedEmail(null);
        }
      }
    };
    void checkGmailConnection();
    return () => {
      cancelled = true;
    };
  }, [hasGmailIntegrationAccess, loadingTier, supabase]);

  const handleSyncGmail = useCallback(async () => {
    if (!hasGmailIntegrationAccess) {
      toastError(
        "Upgrade required",
        "Gmail application checks are available on the Pro plan.",
      );
      return;
    }
    if (!isGmailConnected) {
      info(
        "Gmail not connected",
        <>
          Connect your account under{" "}
          <button
            type="button"
            className="font-semibold text-[#1dff00] underline underline-offset-2 hover:brightness-110"
            onClick={() => navigate("/dashboard/settings/integrations")}
          >
            Settings → Integrations
          </button>
          , then try again.
        </>,
        8000,
      );
      return;
    }

    setGmailSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-gmail-application-events",
        { body: { maxResults: 40 } },
      );
      if (error) {
        const fromBody =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : null;
        throw new Error(
          fromBody ||
            (error as Error & { details?: string }).details ||
            (error as Error).message ||
            "Could not check Gmail right now.",
        );
      }

      const updated = Number(data?.updated ?? 0);
      const classified = Number(data?.classified ?? 0);
      const scanned = Number(data?.scanned ?? 0);
      const skippedNoMatch = Number(
        data && typeof data === "object" && "skippedNoMatch" in data
          ? (data as { skippedNoMatch?: unknown }).skippedNoMatch
          : 0,
      );
      await refresh();

      if (classified === 0) {
        const orphanHint =
          skippedNoMatch > 0
            ? ` (${skippedNoMatch} inbox message${skippedNoMatch === 1 ? "" : "s"} had no matching application).`
            : "";
        success(
          "Gmail checked",
          `Scanned ${scanned} messages; no updates to existing applications.${orphanHint}`,
        );
      } else {
        success(
          "Gmail checked",
          `${updated} application${updated === 1 ? "" : "s"} updated from ${classified} matched email${classified === 1 ? "" : "s"}.`,
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not check Gmail right now.";
      toastError("Gmail check failed", message);
    } finally {
      setGmailSyncing(false);
    }
  }, [
    hasGmailIntegrationAccess,
    isGmailConnected,
    info,
    navigate,
    refresh,
    success,
    supabase,
    toastError,
  ]);

  // Keyboard shortcuts for Gantt view
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (viewMode !== "gantt") return;
      if (e.key === "+" || (e.key === "=" && e.shiftKey)) {
        setGanttZoom((z) => Math.min(4, z + 1));
      } else if (e.key === "-") {
        setGanttZoom((z) => Math.max(0, z - 1));
      } else if (e.key.toLowerCase() === "f") {
        setShowFuture((f) => !f);
      } else if (e.key === "Escape" && detailId) {
        setDetailId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, detailId]);

  const handleBarClick = useCallback((item: GanttItem) => {
    setDetailId(item.id);
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = applications.filter((a) => {
      const matchesQ =
        !q ||
        [a.job_title, a.company, a.location, a.status].some((v) =>
          (v ?? "").toLowerCase().includes(q),
        );
      const matchesStatus =
        selectedStatus === "All" || a.status === selectedStatus;
      return matchesQ && matchesStatus;
    });
    const extractScore = (rec: any): number | null => {
      if (typeof rec.match_score === "number") return rec.match_score;
      return null;
    };
    switch (sortBy) {
      case "recent":
        list = list.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        break;
      case "company":
        list = list.sort((a, b) =>
          (a.company || "").localeCompare(b.company || ""),
        );
        break;
      case "status":
        list = list.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "score":
      default:
        list = list.sort((a, b) => {
          const scoreA = extractScore(a);
          const scoreB = extractScore(b);
          if (scoreA == null && scoreB == null) {
            return (
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
          }
          if (scoreA == null) return 1;
          if (scoreB == null) return -1;
          return scoreB - scoreA;
        });
    }
    return list;
  }, [applications, searchQuery, selectedStatus, sortBy]);

  // Kanban data is only filtered by search query, not status
  const kanbanData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((a) => {
      return (
        !q ||
        [a.job_title, a.company, a.location, a.status].some((v) =>
          (v ?? "").toLowerCase().includes(q),
        )
      );
    });
  }, [applications, searchQuery]);

  // Debounce raw search input -> searchQuery
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(rawSearch), 250);
    return () => clearTimeout(id);
  }, [rawSearch]);

  // Expose update for inline table editing (scoped simple bridge) - cleaned on unmount
  useEffect(() => {
    (window as any).__apps_update = update;
    return () => {
      try {
        delete (window as any).__apps_update;
      } catch { }
    };
  }, [update]);

  // Calendar events (Overview style): one per application using interview date if present else applied date
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return filtered.map((a) => {
      const interview = a.interview_date ? new Date(a.interview_date) : null;
      const applied = new Date(a.applied_date);
      const date =
        interview && !isNaN(interview.getTime()) ? interview : applied;
      return {
        id: a.id,
        date,
        title: a.job_title || a.company || "Application",
        subtitle: a.company || undefined,
        status: a.status,
      } as CalendarEvent;
    });
  }, [filtered]);

  // Calendar selection state (single day or range) for detail overlay
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  // Register coach marks with stable IDs (replaces brittle structural selectors)
  useRegisterCoachMarks({
    page: "application",
    marks: [
      {
        id: "application-search",
        selector: "#application-search",
        title: "Search Your Applications",
        body: "Quickly filter your applications by title, company, location, or status keywords. Real-time search helps you find specific applications instantly.",
      },
      {
        id: "application-view-toggle",
        selector: "#application-view-toggle",
        title: "Multiple Visual Views",
        body: "Switch between Gantt, List, Kanban, Calendar, and Table views to analyze your pipeline from different angles. Each view offers unique insights into your application status.",
      },
      {
        id: "application-status-filters",
        selector: "#application-status-filters",
        title: "Status Filters",
        body: "Focus on a specific stage like Interview, Offer, or Rejected to reduce noise and act faster. Filter by multiple statuses to see combined results.",
      },
      {
        id: "application-gantt",
        selector: "#application-gantt",
        title: "Timeline Insight",
        body: "The Gantt view shows lifecycle duration per application with color-coded status bars. Active stages extend to today for quick aging awareness. Toggle to show future dates.",
      },
    ],
  });

  // Clear selections when leaving calendar view to avoid stray overlay when returning
  useEffect(() => {
    if (viewMode !== "calendar") {
      setSelectedDate(null);
      setSelectedRange(null);
    }
  }, [viewMode]);

  const initialLoading = appsLoading && applications.length === 0;

  return (
    <div className='relative p-4 lg:p-8  space-y-8'>
      {/* Ambient Background Glow */}
      <div className='fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10'></div>
      <div className='fixed bottom-0 left-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10'></div>

      {/* Header Section */}
      <div className='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
        <div className='space-y-1'>
          <h1 className='product-page-title text-3xl font-bold'>
            Applications
          </h1>
          <p className='product-page-subtitle text-sm'>
            Track and manage your job applications in one place
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            variant='outline'
            className='border-[#1dff00]/30 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0 text-foreground hover:border-[#1dff00]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)]'
            onClick={handleSyncGmail}
            disabled={gmailSyncing || loadingTier}
            title={
              !hasGmailIntegrationAccess
                ? "Available on Pro plan"
                : !isGmailConnected
                  ? "Connect Gmail in Settings (Integrations) first, then scan your inbox"
                  : gmailConnectedEmail
                    ? `Scan ${gmailConnectedEmail} for application confirmations, interviews, offers, and rejections`
                    : "Check Gmail for application confirmations, interviews, offers, and rejections"
            }
          >
            {gmailSyncing ? (
              <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
            ) : hasGmailIntegrationAccess ? (
              <Mail className='w-4 h-4 mr-2' />
            ) : (
              <Lock className='w-4 h-4 mr-2' />
            )}
            Check Gmail
          </Button>
          <Button
            variant='outline'
            className='product-outline-button transition-all duration-200 hover:border-[#1dff00]/60 hover:bg-[#1dff00]/15'
            onClick={exportCSV}
          >
            <svg
              className='w-4 h-4 mr-2'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              />
            </svg>
            Export CSV
          </Button>
          <Button
            variant='outline'
            className='border-[#1dff00]/30 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  text-foreground hover:border-[#1dff00]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)]'
            onClick={() => refresh()}
          >
            <RefreshCw className='w-4 h-4 mr-2' />
            Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className='relative overflow-hidden border-none'>
        <div className='relative z-10 flex flex-col gap-5'>
          <div className='flex flex-col sm:flex-row gap-4'>
            <div className='flex-1 relative group'>
              <Input
                id='application-search'
                data-tour='application-search'
                placeholder='Search by title, company, location, or status...'
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className='pl-12 h-12 bg-gradient-to-br from-foreground/5 to-foreground/[0.02] border-[#1dff00]/20 text-foreground placeholder:text-foreground/80 focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all duration-200 rounded-xl'
              />
            </div>
            <div className='flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto'>
              <SortDropdown
                value={sortBy}
                onChange={(newSortBy) => setSortBy(newSortBy as SortOption)}
                className="flex-1 sm:flex-initial sm:w-[180px]"
              />

              <div
                id='application-view-toggle'
                className='inline-flex rounded-xl border border-[#1dff00]/30 overflow-hidden bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  backdrop-blur-sm shadow-lg flex-shrink-0'
                data-tour='application-view-toggle'
              >
                <button
                  className={`group px-3 py-2 sm:px-4 sm:py-3 text-sm transition-all duration-200 relative ${viewMode === "gantt" ? "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 text-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.2)]" : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
                  title='Gantt view'
                  onClick={() => setViewMode("gantt")}
                >
                  <GanttChart className='w-5 h-5' />
                  {viewMode === "gantt" && (
                    <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#1dff00] to-transparent'></div>
                  )}
                </button>
                <button
                  className={`group px-3 py-2 sm:px-4 sm:py-3 text-sm transition-all duration-200 border-l border-[#1dff00]/20 relative ${viewMode === "kanban" ? "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 text-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.2)]" : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
                  title='Kanban view'
                  onClick={() => setViewMode("kanban")}
                >
                  <Columns className='w-5 h-5' />
                  {viewMode === "kanban" && (
                    <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#1dff00] to-transparent'></div>
                  )}
                </button>
                <button
                  className={`group px-3 py-2 sm:px-4 sm:py-3 text-sm transition-all duration-200 border-l border-[#1dff00]/20 relative ${viewMode === "calendar" ? "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 text-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.2)]" : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
                  title='Calendar view'
                  onClick={() => setViewMode("calendar")}
                >
                  <CalendarIcon className='w-5 h-5' />
                  {viewMode === "calendar" && (
                    <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#1dff00] to-transparent'></div>
                  )}
                </button>
                <button
                  className={`group px-3 py-2 sm:px-4 sm:py-3 text-sm transition-all duration-200 border-l border-[#1dff00]/20 relative ${viewMode === "table" ? "bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/10 text-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.2)]" : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
                  title='Table view'
                  onClick={() => setViewMode("table")}
                >
                  <TableIcon className='w-5 h-5' />
                  {viewMode === "table" && (
                    <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#1dff00] to-transparent'></div>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div
            id='application-status-filters'
            className='flex flex-wrap gap-2 items-center'
            data-tour='application-status-filters'
          >
            {APPLICATION_STATUS_FILTERS.map((s) => {
              const color =
                s === "All" ? "#ffffff" : getApplicationStatusColor(s);
              const isActive = selectedStatus === s;

              return (
                <Button
                  key={s}
                  size='sm'
                  variant='ghost'
                  onClick={() => setSelectedStatus(s)}
                  className={`text-sm px-4 py-2 rounded-xl transition-all duration-200 border ${isActive
                    ? "border-[#1dff00]/50 bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/5 text-[#1dff00] shadow-[0_0_15px_rgba(29,255,0,0.2)]"
                    : "border-foreground/10 text-foreground/70 hover:text-foreground hover:bg-foreground/5 hover:border-foreground/20"
                    }`}
                  style={isActive ? {} : { color: color + "b3" }}
                >
                  {isActive && (
                    <span
                      className='w-2 h-2 rounded-full mr-2 animate-pulse'
                      style={{ backgroundColor: color }}
                    ></span>
                  )}
                  {s}
                </Button>
              );
            })}
            {viewMode === "gantt" && (
              <div className='flex items-center gap-2 text-xs text-foreground/60 border-l border-[#1dff00]/20 pl-4 ml-2'>
                <label className='inline-flex items-center gap-2 cursor-pointer hover:text-foreground/80 transition-colors'>
                  <input
                    type='checkbox'
                    className='w-4 h-4 accent-[#1dff00] rounded border-foreground/20 bg-foreground/5'
                    checked={showFuture}
                    onChange={(e) => setShowFuture(e.target.checked)}
                  />
                  <span>Show active age to today</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </Card>
      <div className='h-6'></div>
      {/* Content */}
      <div className='relative'>
        {initialLoading ? (
          <ApplicationPageSkeleton viewMode={viewMode} />
        ) : applications.length === 0 ? (
          <div className='relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0 rounded-2xl p-12 text-center shadow-[0_0_30px_rgba(29,255,0,0.1)]'>
            {/* Ambient glow */}
            <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 bg-[#1dff00]/10 rounded-full blur-3xl opacity-40 pointer-events-none'></div>

            <div className='relative z-10 space-y-6'>
              <div className='mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/5 border border-[#1dff00]/30 grid place-items-center shadow-[0_0_30px_rgba(29,255,0,0.2)]'>
                <Columns className='w-10 h-10 text-[#1dff00]' />
              </div>
              <div className='space-y-2'>
                <h3 className='text-foreground text-2xl font-bold'>
                  No applications yet
                </h3>
                <p className='text-base text-foreground/60 max-w-md mx-auto'>
                  Start tracking your job search journey by applying to jobs or
                  importing existing applications.
                </p>
              </div>
              <div className='flex items-center justify-center gap-3 pt-2'>
                <Button
                  variant='outline'
                  className='border-[#1dff00]/40 bg-gradient-to-br from-[#1dff00]/10 to-transparent text-[#1dff00] hover:bg-[#1dff00]/20 hover:border-[#1dff00]/60 transition-all duration-200 hover:shadow-[0_0_20px_rgba(29,255,0,0.2)]'
                  onClick={() => refresh()}
                >
                  <RefreshCw className='w-4 h-4 mr-2' />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className='relative overflow-hidden border border-[#1dff00]/20 bg-gradient-to-br from-background to-background rounded-2xl p-12 text-center shadow-[0_0_30px_rgba(29,255,0,0.1)]'>
            {/* Ambient glow */}
            <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 bg-[#1dff00]/10 rounded-full blur-3xl opacity-40 pointer-events-none'></div>

            <div className='relative z-10 space-y-6'>
              <div className='mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/5 border border-[#1dff00]/30 grid place-items-center shadow-[0_0_30px_rgba(250,204,21,0.2)]'>
                <Search className='w-10 h-10 text-[#1dff00]' />
              </div>
              <div className='space-y-2'>
                <h3 className='text-foreground text-2xl font-bold'>
                  No matching applications
                </h3>
                <p className='text-base text-foreground/60 max-w-md mx-auto'>
                  We couldn't find any applications matching your current
                  filters. Try adjusting your search or status filters.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {viewMode === "gantt" && (
              <div className='space-y-6'>
                <div className='flex flex-wrap gap-4 text-xs text-foreground/60 bg-gradient-to-br from-foreground/5 to-foreground/[0.02] border border-[#1dff00]/10 rounded-xl p-4'>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#2dd4bf] to-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/20' />
                    <span className='font-medium'>Draft</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#71717a] to-[#27272a] shadow-lg' />
                    <span className='font-medium'>Pending</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#1dff00] to-background shadow-lg shadow-[#1dff00]/20' />
                    <span className='font-medium'>Applied</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-lg shadow-orange-500/20' />
                    <span className='font-medium'>Failed</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#e11d48] to-[#be123c] shadow-lg shadow-rose-600/20' />
                    <span className='font-medium'>Terminated</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#1dff00] to-[#1dff00] shadow-lg shadow-[#1dff00]/20' />
                    <span className='font-medium'>Interview</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#84cc16] to-[#166534] shadow-lg shadow-lime-400/20' />
                    <span className='font-medium'>Offer</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#fb7185] to-[#1dff00] shadow-lg shadow-rose-400/20' />
                    <span className='font-medium'>Rejected</span>
                  </span>
                  <span className='inline-flex items-center gap-2'>
                    <span className='h-3 w-8 rounded-md bg-gradient-to-r from-[#94a3b8] to-[#334155] shadow-lg' />
                    <span className='font-medium'>Withdrawn</span>
                  </span>
                </div>
                <div id='application-gantt' data-tour='application-gantt'>
                  <Gantt
                    zoom={ganttZoom}
                    onZoomChange={setGanttZoom}
                    showToday
                    groupBy={(item) => item.status}
                    onBarClick={(item) => handleBarClick(item)}
                    items={filtered.map<GanttItem>((a) => {
                      const applied = new Date(a.applied_date);
                      const updated = new Date(
                        a.updated_at || a.applied_date || Date.now(),
                      );
                      const now = new Date();
                      const activeStatuses: ApplicationStatus[] = [
                        "Pending",
                        "Applied",
                        "Interview",
                      ];
                      let end: Date;
                      if (a.interview_date && a.status === "Interview") {
                        const idate = new Date(a.interview_date);
                        end = idate > applied ? idate : updated;
                      } else {
                        end =
                          updated > applied
                            ? updated
                            : new Date(applied.getTime() + 24 * 3600 * 1000);
                      }
                      if (end.getTime() === applied.getTime()) {
                        end = new Date(end.getTime() + 6 * 3600 * 1000);
                      }
                      const trailEnd =
                        showFuture &&
                        activeStatuses.includes(a.status) &&
                        now > end
                          ? now
                          : undefined;
                      return {
                        id: a.id,
                        label: a.job_title || a.company || "Untitled",
                        start: applied,
                        end,
                        trailEnd,
                        status: a.status,
                        extra: a.company,
                        groupKey: a.status,
                        raw: a,
                      };
                    })}
                    renderLabel={(item: any) => (
                      <div className='flex flex-col truncate'>
                        <span className='truncate font-medium text-foreground/80 text-xs'>
                          {item.label}
                        </span>
                        {item.extra && (
                          <span className='truncate text-[10px] text-foreground/40'>
                            {item.extra}
                          </span>
                        )}
                      </div>
                    )}
                    renderBarContent={(item: any) => (
                      <div className='flex items-center gap-1 w-full truncate'>
                        <span className='truncate'>{item.status}</span>
                      </div>
                    )}
                  />
                </div>
              </div>
            )}

            {viewMode === "calendar" && (
              <div className='relative rounded-2xl border border-[#1dff00]/20 bg-gradient-to-br from-background via-background to-background p-3 sm:p-6 shadow-[0_0_30px_rgba(29,255,0,0.1)] overflow-hidden'>
                {/* Ambient Glow Effect */}
                <div className='absolute -top-20 -left-20 h-64 w-64 bg-[#1dff00]/10 rounded-full blur-3xl opacity-40 pointer-events-none'></div>

                <div className='relative z-10'>
                  <KiboCalendar
                    events={calendarEvents}
                    showLegend
                    highlightToday
                    showHeader
                    enableAnalyticsRibbon={false}
                    enableICSExport
                    heatmap
                    densityMode='compact'
                    onQuickCreate={(partial) =>
                      console.log("quick create", partial)
                    }
                    enableQuickCreate={false}
                    selectedDate={selectedDate || undefined}
                    onSelectDate={(d) => {
                      setSelectedDate(d);
                      setSelectedRange(null);
                    }}
                    rangeSelectable
                    onSelectRange={(r) => {
                      setSelectedRange(r);
                      if (r) setSelectedDate(null);
                    }}
                    className='border border-[#1dff00]/20 rounded-xl bg-gradient-to-br from-background/50 to-background/50 backdrop-blur-sm'
                  />
                </div>
                <CalendarDayDetail
                  date={selectedDate}
                  range={selectedRange}
                  onClose={() => {
                    setSelectedDate(null);
                    setSelectedRange(null);
                  }}
                  applications={applications}
                  onUpdateApplication={update}
                  onCreateApplication={async () => {
                    /* create not injected on ApplicationPage calendar detail */
                  }}
                />
              </div>
            )}
            {viewMode === "table" && (
              <ApplicationsTable
                data={filtered}
                onRowClick={(id) => setDetailId(id)}
              />
            )}
            {viewMode === "kanban" && (
              <KanbanProvider
                columns={APPLICATION_STATUS_OPTIONS.map((id) => ({
                  id,
                  name: id,
                  color: getApplicationStatusColor(id),
                }))}
                data={kanbanData.map((a) => ({
                  ...a,
                  id: a.id,
                  column: a.status,
                }))}
                onItemMove={async (id, toColumn) => {
                  const rec = applications.find((a) => a.id === id);
                  if (!rec) return;
                  if (rec.status === toColumn) return;
                  try {
                    await update(id, { status: toColumn as ApplicationStatus });
                    // Gamification: emit XP events for status transitions
                    if (toColumn === 'Interview') {
                      try { gamificationHook.recordEvent('interview_scheduled', { applicationId: id }); } catch { }
                    } else if (toColumn === 'Offer') {
                      try { gamificationHook.recordEvent('offer_received', { applicationId: id }); } catch { }
                    }
                  } catch {
                    await refresh();
                  }
                }}
              >
                {(column) => (
                  <KanbanBoard id={column.id} key={column.id}>
                    <KanbanHeader>
                      <div className='flex items-center gap-2.5'>
                        <div
                          className='h-2.5 w-2.5 rounded-full shadow-sm'
                          style={{ backgroundColor: column.color }}
                        />
                        <span className='text-sm font-semibold text-foreground/95 tracking-tight'>
                          {column.name}
                        </span>
                        <span className='inline-flex items-center justify-center min-w-[24px] h-5 rounded-full border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/80'>
                          {
                            kanbanData.filter(
                              (a) =>
                                a.status === (column.id as ApplicationStatus),
                            ).length
                          }
                        </span>
                      </div>
                    </KanbanHeader>
                    <KanbanCards id={column.id}>
                      {(a: any) => (
                        <KanbanCard key={a.id} id={a.id}>
                          <div className='flex items-start gap-3.5'>
                            <CompanyMark
                              logo={a.logo}
                              company={a.company}
                              jobTitle={a.job_title}
                              size='sm'
                            />
                            <div className='min-w-0 flex-1'>
                              <div className='flex items-start justify-between gap-2'>
                                <div className='min-w-0 space-y-1'>
                                  <div className='truncate text-sm font-semibold leading-tight text-foreground/95'>
                                    {a.job_title}
                                  </div>
                                  <div className='truncate text-xs font-medium text-foreground/65'>
                                    {a.company}
                                  </div>
                                </div>
                                <div className='mt-0.5 shrink-0'>
                                  <MatchScoreBadge score={a.match_score} />
                                </div>
                              </div>
                              <div className='mt-3 flex flex-wrap items-center gap-2 border-t border-foreground/5 pt-3 text-[11px] text-foreground/50'>
                                <span className='inline-flex items-center rounded-full border border-foreground/10 bg-foreground/[0.03] px-2 py-1 font-medium'>
                                  {new Date(a.applied_date).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}
                                </span>
                                {a.location && (
                                  <span className='inline-flex max-w-full items-center rounded-full border border-foreground/10 bg-foreground/[0.03] px-2 py-1'>
                                      •
                                    {a.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </KanbanCard>
                      )}
                    </KanbanCards>
                  </KanbanBoard>
                )}
              </KanbanProvider>
            )}
          </motion.div>
        )}
      </div>

      <Modal
        open={!!detailApp}
        onClose={() => setDetailId(null)}
        title=''
        side='right'
        size='lg'
      >
        {detailApp ? (
          <div className='space-y-6'>
            {/* Header Section with Status Badge */}
            <div className='relative pb-6 border-b border-[#1dff00]/10'>
              <div className='absolute top-0 right-0'>
                <StatusBadge
                  status={detailApp.status}
                  providerStatus={detailApp.provider_status}
                />
              </div>
              <div className='space-y-2 pr-32'>
                <h2 className='text-2xl font-bold text-foreground'>
                  {detailApp.job_title}
                </h2>
                <div className='flex items-center gap-3 text-foreground/60'>
                  <CompanyMark
                    logo={detailApp.logo}
                    company={detailApp.company}
                    jobTitle={detailApp.job_title}
                    size='sm'
                  />
                  <div className='min-w-0'>
                    <div className='text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/35'>
                      Company
                    </div>
                    <span className='text-base font-medium text-foreground/80'>
                      {detailApp.company}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {isQueuedApplication(detailApp.status, detailApp.provider_status) && (
              <div className='rounded-xl border border-sky-400/25 bg-sky-400/10 p-4'>
                <div className='flex items-start gap-3'>
                  <div className='mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-sky-300/25 bg-sky-300/10 text-sky-300'>
                    <Clock className='h-4 w-4' />
                  </div>
                  <div className='min-w-0 space-y-2'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-sky-200'>
                      Waiting for an auto-apply slot
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className='h-3.5 w-3.5 cursor-help text-sky-200/75' />
                          </TooltipTrigger>
                          <TooltipContent side='bottom' className='max-w-72 leading-relaxed'>
                            JobRaker starts queued applications by subscription tier,
                            then rotates between users in the same tier so one account
                            cannot consume every platform slot.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className='text-sm leading-relaxed text-foreground/75'>
                      This run has been charged and reserved, and will launch
                      automatically when capacity opens. Pro, Ultimate, and
                      concurrency boosts move more applications in parallel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Draft Status & AI Confidence Badges */}
            {(detailApp.draft_status || detailApp.ai_confidence_score != null) && (
              <div className='flex flex-wrap items-center gap-2'>
                {detailApp.draft_status && detailApp.draft_status !== 'sent' && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider border ${detailApp.draft_status === 'draft'
                      ? 'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/20'
                      : 'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/20'
                      }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${detailApp.draft_status === 'draft' ? 'bg-[#1dff00]' : 'bg-[#1dff00]'
                      }`} />
                    {detailApp.draft_status}
                  </span>
                )}
                {detailApp.ai_confidence_score != null && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${detailApp.ai_confidence_score >= 70
                      ? 'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/20'
                      : detailApp.ai_confidence_score >= 40
                        ? 'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/20'
                        : 'bg-rose-400/10 text-rose-400 border-rose-400/20'
                      }`}
                  >
                    <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
                    </svg>
                    AI Confidence: {detailApp.ai_confidence_score}%
                  </span>
                )}
              </div>
            )}

            {/* Timeline & Key Dates */}
            <div className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wider text-foreground/40'>
                Timeline
              </h3>
              <div className='space-y-2'>
                <div className='flex items-center gap-3 p-3 rounded-lg bg-foreground/[0.02] border border-foreground/5 hover:border-[#1dff00]/20 transition-colors'>
                  <div className='flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-[#1dff00]/10 to-transparent border border-[#1dff00]/20 flex items-center justify-center'>
                    <svg
                      className='w-5 h-5 text-[#1dff00]'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                      />
                    </svg>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='text-xs text-foreground/40'>
                      Applied Date
                    </div>
                    <div className='text-sm font-medium text-foreground/90'>
                      {new Date(detailApp.applied_date).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </div>
                  </div>
                </div>

                {detailApp.interview_date && (
                  <div className='flex items-center gap-3 p-3 rounded-lg bg-[#1dff00]/[0.02] border border-[#1dff00]/10 hover:border-[#1dff00]/30 transition-colors'>
                    <div className='flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-[#1dff00]/10 to-transparent border border-[#1dff00]/20 flex items-center justify-center'>
                      <svg
                        className='w-5 h-5 text-[#1dff00]'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
                        />
                      </svg>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='text-xs text-[#1dff00]/60'>
                        Interview Scheduled
                      </div>
                      <div className='text-sm font-medium text-[#1dff00]'>
                        {new Date(detailApp.interview_date).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className='flex items-center gap-3 p-3 rounded-lg bg-foreground/[0.02] border border-foreground/5'>
                  <div className='flex-shrink-0 h-10 w-10 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center'>
                    <svg
                      className='w-5 h-5 text-foreground/40'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='text-xs text-foreground/40'>
                      Last Updated
                    </div>
                    <div className='text-sm font-medium text-foreground/70'>
                      {new Date(detailApp.updated_at).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust & Explainability: Why this match? */}
            {detailApp.match_reasons && detailApp.match_reasons.length > 0 && (
              <div className='space-y-3'>
                <h3 className='text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-[#1dff00]'>
                  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
                  </svg>
                  Why this match?
                </h3>
                <div className='flex flex-wrap gap-2 p-3 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-transparent border border-[#1dff00]/20'>
                  {detailApp.match_reasons.map((reason, idx) => (
                    <span
                      key={idx}
                      className='inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#1dff00]/20 text-[#1dff00]'
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compensation — feeds Analytics pipeline earnings estimates */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-foreground/40'>
                  Compensation
                </h3>
                {!editingSalary && (
                  <button
                    type='button'
                    onClick={() => setEditingSalary(true)}
                    className='text-xs text-[#1dff00] hover:text-[#1dff00]/80 transition-colors flex items-center gap-1'
                  >
                    <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
                    </svg>
                    {detailApp.salary ? "Edit" : "Add"}
                  </button>
                )}
              </div>
              {editingSalary ? (
                <div className='space-y-3'>
                  <textarea
                    value={salaryText}
                    onChange={(e) => setSalaryText(e.target.value)}
                    placeholder='e.g. $180k base + bonus, or $9500/mo contract'
                    className='w-full min-h-[88px] rounded-xl bg-foreground/5 border border-[#1dff00]/30 text-foreground placeholder:text-foreground/40 p-3 text-sm outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 resize-y'
                    autoFocus
                  />
                  <div className='flex justify-end gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      className='border-foreground/20 hover:border-foreground/30 hover:bg-foreground/5 text-foreground/70 hover:text-foreground'
                      onClick={() => {
                        setSalaryText(detailApp?.salary || "");
                        setEditingSalary(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      className='bg-gradient-to-r from-[#1dff00] to-background text-foreground font-semibold hover:shadow-[0_0_20px_rgba(29,255,0,0.3)]'
                      onClick={async () => {
                        if (!detailApp) return;
                        try {
                          await update(detailApp.id, {
                            salary: salaryText.trim() || null,
                          });
                          setEditingSalary(false);
                        } catch {
                          await refresh();
                          setEditingSalary(false);
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className='p-4 rounded-xl bg-gradient-to-br from-[#1dff00]/5 to-transparent border border-[#1dff00]/20 cursor-text hover:border-[#1dff00]/35 transition-colors'
                  onClick={() => setEditingSalary(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingSalary(true);
                    }
                  }}
                  role='button'
                  tabIndex={0}
                >
                  <div className='flex items-start gap-2'>
                    <svg
                      className='w-5 h-5 text-[#1dff00] shrink-0 mt-0.5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                    {detailApp.salary ? (
                      <span className='text-lg font-bold text-[#1dff00] leading-snug'>{detailApp.salary}</span>
                    ) : (
                      <div className='space-y-2'>
                        <span className='block text-sm text-foreground/45 italic'>
                          Click to add listing or offer comp (used in Analytics pipeline estimates)
                        </span>
                        {aiCompensationSummary ? (
                          <p className='text-sm text-foreground/70 leading-relaxed'>
                            <span className='font-medium text-[#1dff00]'>
                              AI read:
                            </span>{" "}
                            {aiCompensationSummary}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-foreground/40'>
                  Notes & Details
                </h3>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className='text-xs text-[#1dff00] hover:text-[#1dff00]/80 transition-colors flex items-center gap-1'
                  >
                    <svg
                      className='w-3.5 h-3.5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                      />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className='space-y-3'>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder='Add notes about this application...'
                    className='w-full min-h-[140px] rounded-xl bg-foreground/5 border border-[#1dff00]/30 text-foreground placeholder:text-foreground/40 p-4 outline-none focus:border-[#1dff00]/50 focus:ring-2 focus:ring-[#1dff00]/20 transition-all resize-y'
                    autoFocus
                  />
                  {!compactText(detailApp?.notes) && aiNotesText ? (
                    <p className='text-xs text-foreground/50'>
                      AI drafted these notes from the evaluation report. Edit before saving if needed.
                    </p>
                  ) : null}
                  <div className='flex justify-end gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      className='border-foreground/20 hover:border-foreground/30 hover:bg-foreground/5 text-foreground/70 hover:text-foreground'
                      onClick={() => {
                        setNotesText(detailApp?.notes || aiNotesText || "");
                        setEditingNotes(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      className='bg-gradient-to-r from-[#1dff00] to-background text-foreground font-semibold hover:shadow-[0_0_20px_rgba(29,255,0,0.3)]'
                      onClick={async () => {
                        if (!detailApp) return;
                        try {
                          await update(detailApp.id, {
                            notes: notesText || null,
                          });
                          setEditingNotes(false);
                        } catch {
                          await refresh();
                          setEditingNotes(false);
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className='p-4 rounded-xl bg-foreground/[0.02] border border-foreground/10 max-h-60 overflow-auto scrollbar-thin scrollbar-thumb-[#1dff00]/30 scrollbar-track-transparent cursor-text hover:border-foreground/20 transition-colors'
                    onClick={() => setEditingNotes(true)}
                  >
                    {displayedNotesText ? (
                      <p className='text-sm text-foreground/70 leading-relaxed foregroundspace-pre-wrap'>
                        {displayedNotesText}
                      </p>
                    ) : (
                      <p className='text-sm text-foreground/40 italic'>
                        {detailEvaluationLoading
                          ? "Generating AI notes..."
                          : "Click to add notes..."}
                      </p>
                    )}
                  </div>
                  {!compactText(detailApp.notes) && displayedNotesText ? (
                    <p className='text-xs text-foreground/45'>
                      Showing AI-generated notes until you save your own version.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {/* Failure Handoff */}
            {detailApp.provider_status === 'failed' && (
              <div className='space-y-3'>
                <div className='p-4 rounded-xl border border-[#1dff00]/35 bg-[#1dff00]/10'>
                  <div className='flex items-center gap-2 text-sm font-medium text-[#1dff00] mb-2'>
                    <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
                    </svg>
                    Automation Failed
                  </div>
                  <p className='text-sm text-foreground/80 mb-4'>
                    I couldn't finish this, but I did the heavy lifting. Click here to finish.
                  </p>
                  <Button
                    onClick={() => {
                      const sourceUrl = detailApp.app_url || (detailApp.notes?.includes("Source:") ? detailApp.notes.split("Source:")[1].split('\n')[0].trim() : "");
                      const openUrl = sourceUrl ? applyMicro1ReferralToUrl(sourceUrl) : "";
                      const summaryData = `Role: ${detailApp.job_title}\nCompany: ${detailApp.company}`;

                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(summaryData).then(() => {
                          if (openUrl) window.open(openUrl, '_blank', 'noopener,noreferrer');
                        });
                      } else {
                        if (openUrl) window.open(openUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className='w-full bg-[#1dff00]/15 hover:bg-[#1dff00]/25 text-[#1dff00] border border-[#1dff00]/50 transition-colors py-2 h-auto whitespace-normal text-left sm:text-center block break-words'
                  >
                    Copy Basic Info & Complete Manually
                  </Button>
                </div>
              </div>
            )}

            {/* Trust & Explainability: What did you send? / Did it work? */}
            {(detailApp.receipt_url || detailApp.success_url) && (
              <div className='space-y-3'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-foreground/40'>
                  Application Receipts
                </h3>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {detailApp.receipt_url && (
                    <a
                      href={detailApp.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className='group relative block overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 transition-all hover:border-[#1dff00]/50 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] aspect-[4/3]'
                    >
                      <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10' />
                      <img
                        src={detailApp.receipt_url}
                        alt="Application Form Receipt"
                        className='absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80'
                      />
                      <div className='absolute bottom-0 left-0 right-0 p-3 z-20 flex items-center justify-between'>
                        <span className='text-xs font-medium text-foreground'>View Form Data</span>
                        <svg className='w-4 h-4 text-foreground opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-1 group-hover:translate-x-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' />
                        </svg>
                      </div>
                    </a>
                  )}
                  {detailApp.success_url && (
                    <a
                      href={detailApp.success_url}
                      target="_blank"
                      rel="noreferrer"
                      className='group relative block overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 transition-all hover:border-[#1dff00]/50 hover:shadow-[0_0_20px_rgba(29,255,0,0.15)] aspect-[4/3]'
                    >
                      <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10' />
                      <img
                        src={detailApp.success_url}
                        alt="Success Confirmation"
                        className='absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80'
                      />
                      <div className='absolute bottom-0 left-0 right-0 p-3 z-20 flex items-center justify-between'>
                        <span className='text-xs font-medium focus:text-foreground text-[#1dff00]'>Success Screenshot</span>
                        <svg className='w-4 h-4 focus:text-foreground text-[#1dff00] opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-1 group-hover:translate-x-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
                        </svg>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wider text-foreground/40'>
                Quick Actions
              </h3>
              <div className='flex flex-wrap gap-2'>
                {(detailApp.status === "Draft" || detailApp.status === "Failed") &&
                  detailApp.job_id && (
                  <button
                    type='button'
                    onClick={() =>
                      navigate(
                        `/dashboard/jobs?autoApplyJobId=${encodeURIComponent(detailApp.job_id!)}`,
                      )
                    }
                    className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1dff00]/15 border border-[#1dff00]/40 text-[#1dff00] hover:bg-[#1dff00]/25 hover:shadow-[0_0_20px_rgba(29,255,0,0.25)] transition-all duration-200 text-sm font-medium'
                  >
                    <Zap className='w-4 h-4' />
                    {detailApp.status === "Failed"
                      ? "Retry auto-apply"
                      : "Continue auto-apply"}
                  </button>
                )}
                {detailApp.app_url && (
                  <a
                    href={applyMicro1ReferralToUrl(detailApp.app_url)}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/20 hover:shadow-[0_0_20px_rgba(29,255,0,0.2)] transition-all duration-200 text-sm font-medium'
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                      />
                    </svg>
                    Open Application
                  </a>
                )}
                {detailApp.status === "Interview" && (
                  <button
                    onClick={() => {
                      setInterviewAgentOpen(true);
                      setInterviewEmailText("");
                      setInterviewAgentResult(null);
                    }}
                    className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#b347ff]/10 border border-[#b347ff]/30 text-[#b347ff] hover:bg-[#b347ff]/20 hover:shadow-[0_0_20px_rgba(179,71,255,0.2)] transition-all duration-200 text-sm font-medium'
                  >
                    <Bot className='w-4 h-4' />
                    Schedule Interview
                    {!hasInterviewAssistantAccess && (
                      <Lock className='w-3 h-3 opacity-60' />
                    )}
                  </button>
                )}
                {detailApp.recording_url && (
                  <a
                    href={detailApp.recording_url}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground hover:border-foreground/20 transition-all duration-200 text-sm font-medium'
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                      />
                    </svg>
                    View Recording
                  </a>
                )}
                {detailApp.run_id && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(detailApp.run_id!);
                    }}
                    className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground/5 border border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground hover:border-foreground/20 transition-all duration-200 text-sm font-medium'
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                      />
                    </svg>
                    Copy Run ID
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNextStepText(detailApp.next_step || "");
                    setNextStepOpen(true);
                  }}
                  className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground/5 border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground hover:border-foreground/20 transition-all duration-200 text-sm font-medium'
                >
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 4v16m8-8H4'
                    />
                  </svg>
                  Add Follow-up Note
                </button>
              </div>
            </div>

            {/* User Review Notes */}
            <div className='space-y-3'>
              <h3 className='text-xs font-semibold uppercase tracking-wider text-foreground/40'>
                Your Review Notes
              </h3>
              <textarea
                defaultValue={detailApp.user_review_notes || ''}
                placeholder='Add personal review notes about this application…'
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val !== (detailApp.user_review_notes || '')) {
                    update(detailApp.id, { user_review_notes: val || null });
                  }
                }}
                rows={3}
                className='w-full rounded-xl bg-foreground/[0.03] border border-foreground/10 px-4 py-3 text-sm text-foreground/80 placeholder:text-foreground/30 focus:border-[#1dff00]/40 focus:ring-1 focus:ring-[#1dff00]/20 focus:outline-none transition-all resize-none'
              />
            </div>

            {/* Footer Actions */}
            <div className='pt-4 border-t border-foreground/10 flex gap-3'>
              <Button
                size='sm'
                variant='outline'
                className='border-rose-400/25 text-rose-300 hover:bg-rose-400/10 hover:border-rose-400/40'
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete
              </Button>
              <Button
                size='sm'
                variant='outline'
                className='flex-1 border-foreground/20 hover:border-foreground/30 hover:bg-foreground/5 text-foreground/70 hover:text-foreground transition-all'
                onClick={() => setDetailId(null)}
              >
                Close
              </Button>
              <Button
                size='sm'
                className='flex-1 bg-gradient-to-r from-[#1dff00] to-background hover:shadow-[0_0_20px_rgba(29,255,0,0.3)] text-foreground font-semibold transition-all'
                onClick={() => {
                  setEditingNotes(true);
                  setEditingSalary(true);
                }}
              >
                Edit Details
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          if (!deletingApplication) setDeleteConfirmOpen(false);
        }}
        title='Delete application'
        size='md'
        side='center'
      >
        <div className='space-y-4'>
          <p className='text-sm text-foreground/75'>
            Delete{" "}
            <span className='font-medium text-foreground'>
              {detailApp?.job_title}
            </span>
            {detailApp?.company ? ` at ${detailApp.company}` : ""}? This removes it from your tracker.
          </p>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              className='border-foreground/20 hover:border-foreground/30 hover:bg-foreground/5 text-foreground/70 hover:text-foreground'
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deletingApplication}
            >
              Cancel
            </Button>
            <Button
              className='bg-rose-500 hover:bg-rose-500/90 text-white'
              disabled={deletingApplication || !detailApp}
              onClick={async () => {
                if (!detailApp) return;
                setDeletingApplication(true);
                try {
                  await remove(detailApp.id);
                  setDeleteConfirmOpen(false);
                  setDetailId(null);
                } finally {
                  setDeletingApplication(false);
                }
              }}
            >
              {deletingApplication ? "Deleting..." : "Delete application"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Next Step Note Modal */}
      <Modal
        open={nextStepOpen}
        onClose={() => setNextStepOpen(false)}
        title='Enter follow-up note'
        size='md'
        side='center'
      >
        <div className='space-y-4 p-1'>
          <textarea
            value={nextStepText}
            onChange={(e) => setNextStepText(e.target.value)}
            placeholder='e.g., Email recruiter on Friday about take-home; prep system design'
            className='w-full min-h-[140px] rounded-xl bg-foreground/5 border border-foreground/10 text-foreground placeholder:text-foreground/40 p-3 outline-none focus:border-[#1dff00]/40 focus:ring-2 focus:ring-[#1dff00]/20'
          />
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              className='border-foreground/20 hover:border-foreground/30 hover:bg-foreground/5 text-foreground/70 hover:text-foreground'
              onClick={() => setNextStepOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className='bg-gradient-to-r from-[#1dff00] to-background text-foreground font-semibold hover:shadow-[0_0_20px_rgba(29,255,0,0.3)]'
              onClick={async () => {
                if (!detailApp) {
                  setNextStepOpen(false);
                  return;
                }
                try {
                  await update(detailApp.id, {
                    next_step: nextStepText || null,
                  });
                  setNextStepOpen(false);
                } catch {
                  // Fallback refresh to reflect state if update failed silently
                  await refresh();
                  setNextStepOpen(false);
                }
              }}
            >
              Save Note
            </Button>
          </div>
        </div>
      </Modal>

      {/* Interview Agent Modal */}
      <Modal
        isOpen={interviewAgentOpen}
        onClose={() => setInterviewAgentOpen(false)}
        title="Interview Scheduling Agent"
      >
        <div className='space-y-4'>
          {loadingTier ? (
            <div className='py-10 text-center'>
              <div className='mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-[#b347ff]' />
              <p className='text-sm text-foreground/70'>Checking interview assistant access...</p>
            </div>
          ) : !hasInterviewAssistantAccess ? (
            <UpgradePrompt
              compact
              requiredTier='Pro'
              showPricing={false}
              title='Interview Scheduling Assistant'
              description='Unlock recruiter-email analysis, booking-link detection, and drafted scheduling replies with Pro.'
            />
          ) : !interviewAgentResult ? (
            <>
              <p className='text-sm text-foreground/70'>
                Paste the email from the recruiter below. The AI will extract booking links or draft a professional reply offering your availability.
              </p>
              <textarea
                value={interviewEmailText}
                onChange={(e) => setInterviewEmailText(e.target.value)}
                placeholder='E.g. Hi there, we would love to schedule a 30 min chat with you. Please let me know when you are free...'
                className='w-full min-h-[200px] rounded-xl bg-foreground/5 border border-[#b347ff]/30 text-foreground placeholder:text-foreground/40 p-4 outline-none focus:border-[#b347ff]/50 focus:ring-2 focus:ring-[#b347ff]/20 transition-all resize-y text-sm'
              />
              <div className='flex justify-end gap-3'>
                <Button
                  variant='outline'
                  onClick={() => setInterviewAgentOpen(false)}
                  className='border-foreground/20 hover:bg-foreground/5'
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!hasInterviewAssistantAccess) return;
                    if (!interviewEmailText.trim()) return;
                    setInterviewAgentLoading(true);
                    try {
                      const res = await scheduleInterviewViaEdge({
                        emailText: interviewEmailText,
                        applicantName: "Candidate",
                        companyName: detailApp?.company || "the company"
                      });
                      setInterviewAgentResult(res);
                    } catch (e) {
                      console.error("AI scheduling failed", e);
                    } finally {
                      setInterviewAgentLoading(false);
                    }
                  }}
                  disabled={interviewAgentLoading || !interviewEmailText.trim()}
                  className='bg-gradient-to-r from-[#b347ff] to-[#8000ff] text-foreground font-semibold hover:shadow-[0_0_20px_rgba(179,71,255,0.4)] transition-all'
                >
                  {interviewAgentLoading ? (
                    <span className='flex items-center gap-2'>
                      <RefreshCw className='w-4 h-4 animate-spin' />
                      Analyzing...
                    </span>
                  ) : (
                    <span className='flex items-center gap-2'>
                      <Bot className='w-4 h-4' />
                      Generate Reply
                    </span>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className='space-y-5'>
              {interviewAgentResult.booking_link ? (
                <div className='p-4 rounded-xl border border-[#1dff00]/30 bg-[#1dff00]/10 space-y-2'>
                  <div className='flex items-center gap-2 text-[#1dff00] font-medium text-sm'>
                    <Link2 className='w-4 h-4' />
                    Booking Link Found!
                  </div>
                  <p className='text-sm text-foreground/80'>
                    The recruiter provided a direct link to book your interview:
                  </p>
                  <a href={interviewAgentResult.booking_link} target='_blank' rel='noreferrer' className='inline-flex items-center gap-2 text-[#1dff00] underline text-sm break-all'>
                    {interviewAgentResult.booking_link}
                  </a>
                </div>
              ) : (
                <div className='p-4 rounded-xl border border-[#1dff00]/30 bg-[#1dff00]/10 space-y-2'>
                  <div className='flex items-center gap-2 text-[#1dff00] font-medium text-sm'>
                    <CalendarIcon className='w-4 h-4' />
                    No direct link found
                  </div>
                  <p className='text-sm text-foreground/80'>
                    I've drafted a polite reply offering your availability instead.
                  </p>
                </div>
              )}

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <label className='text-xs font-semibold text-foreground/60 uppercase tracking-wider'>Suggested Reply</label>
                  <button
                    onClick={() => {
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(interviewAgentResult.suggested_reply);
                      }
                    }}
                    className='text-xs text-[#b347ff] hover:text-[#b347ff]/80 font-medium flex items-center gap-1'
                  >
                    <ClipboardList className='w-3 h-3' />
                    Copy to clipboard
                  </button>
                </div>
                <textarea
                  className='w-full min-h-[160px] rounded-xl bg-background border border-foreground/10 text-foreground text-sm p-4 outline-none focus:border-[#b347ff]/50 transition-all resize-y'
                  defaultValue={interviewAgentResult.suggested_reply}
                />
              </div>

              <div className='flex justify-end pt-2 pb-1 border-t border-foreground/10'>
                <Button
                  variant='ghost'
                  onClick={() => setInterviewAgentOpen(false)}
                  className='text-foreground/70 hover:text-foreground'
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default ApplicationPage;
export { ApplicationPage };

// --- Skeletons ---
interface ApplicationPageSkeletonProps {
  viewMode: string;
}
function ApplicationPageSkeleton({ viewMode }: ApplicationPageSkeletonProps) {
  if (viewMode === "gantt") return <GanttSkeleton />;
  if (viewMode === "list") return <ListSkeleton />;
  if (viewMode === "kanban") return <KanbanSkeleton />;
  if (viewMode === "calendar") return <CalendarSkeleton />;
  if (viewMode === "table") return <TableSkeleton />;
  return (
    <div className='space-y-4'>
      <Skeleton className='h-64 w-full rounded-xl bg-foreground/5' />
    </div>
  );
}

function GanttSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-4 w-28 bg-foreground/5' />
        ))}
      </div>
      <div className='h-72 w-full rounded-lg border border-foreground/10 bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02] p-4 flex flex-col gap-3 overflow-hidden'>
        {Array.from({ length: 7 }).map((_, r) => (
          <div key={r} className='flex items-center gap-2 w-full'>
            <Skeleton className='h-3 w-16 bg-foreground/5' />
            <div className='flex-1 relative h-4'>
              {Array.from({ length: Math.max(1, (r % 3) + 1) }).map((__, b) => (
                <span key={b} className='absolute top-0 h-4 rounded-full'>
                  <Skeleton
                    style={{
                      left: `${b * 18 + ((r * 7) % 20)}%`,
                      width: `${20 + ((r * 13 + b * 9) % 35)}%`,
                    }}
                    className='h-4 bg-foreground/10'
                  />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className='border border-foreground/10 rounded-xl bg-foreground/30 overflow-hidden divide-y divide-foreground/5'>
      {APPLICATION_STATUS_OPTIONS.map((col) => (
        <div key={col} className='flex flex-col'>
          <div className='sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-foreground/40 px-3 py-2 flex items-center gap-2'>
            <Skeleton className='h-3 w-24 bg-foreground/10' />
          </div>
          <div className='p-3 grid gap-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className='rounded-lg border border-foreground/10 bg-foreground/5 p-3 flex items-center gap-3'
              >
                <Skeleton className='w-10 h-10 rounded-lg bg-foreground/10' />
                <div className='min-w-0 flex-1 space-y-1'>
                  <Skeleton className='h-3 w-40 bg-foreground/10' />
                  <Skeleton className='h-2 w-24 bg-foreground/10' />
                  <div className='flex gap-2'>
                    <Skeleton className='h-2 w-14 bg-foreground/10' />
                    <Skeleton className='h-2 w-20 bg-foreground/10' />
                  </div>
                </div>
                <Skeleton className='h-5 w-10 rounded-full bg-foreground/10' />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9'>
      {APPLICATION_STATUS_OPTIONS.map((col) => (
        <div
          key={col}
          className='flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/30 p-3'
        >
          <div className='flex items-center gap-2'>
            <Skeleton className='h-2 w-2 rounded-full bg-foreground/20' />
            <Skeleton className='h-3 w-20 bg-foreground/10' />
            <Skeleton className='h-4 w-8 rounded-full bg-foreground/10 ml-auto' />
          </div>
          <div className='flex flex-col gap-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className='rounded-lg border border-foreground/10 bg-foreground/5 p-3 space-y-2'
              >
                <Skeleton className='h-3 w-32 bg-foreground/10' />
                <Skeleton className='h-2 w-20 bg-foreground/10' />
                <div className='flex gap-2'>
                  <Skeleton className='h-2 w-12 bg-foreground/10' />
                  <Skeleton className='h-2 w-14 bg-foreground/10' />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className='border border-foreground/10 rounded-lg bg-foreground/30 p-4'>
      <div className='flex items-center justify-between mb-4'>
        <Skeleton className='h-6 w-40 bg-foreground/10' />
        <div className='flex gap-2'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-8 w-8 bg-foreground/10 rounded-md' />
          ))}
        </div>
      </div>
      <div className='grid grid-cols-7 gap-2'>
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className='aspect-square rounded-md border border-foreground/10 bg-foreground/[0.02] p-1 flex flex-col gap-1'
          >
            <Skeleton className='h-2 w-4 bg-foreground/10' />
            {i % 5 === 0 && <Skeleton className='h-2 w-10 bg-foreground/10' />}
            {i % 7 === 0 && <Skeleton className='h-2 w-8 bg-foreground/10' />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className='rounded-xl border border-foreground/10 bg-foreground/30 overflow-hidden'>
      <div className='bg-foreground/5 px-4 py-3 flex gap-4'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-3 w-24 bg-foreground/10' />
        ))}
      </div>
      <div className='divide-y divide-foreground/5'>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className='grid grid-cols-5 gap-4 px-4 py-3 text-sm'>
            {Array.from({ length: 5 }).map((__, c) => (
              <Skeleton key={c} className='h-3 w-full bg-foreground/10' />
            ))}
          </div>
        ))}
      </div>
      <div className='p-2 text-[10px] text-foreground/30 flex justify-end border-t border-foreground/10'>
        Loading…
      </div>
    </div>
  );
}

// --- Table View Component ---
interface ApplicationsTableProps {
  data: any[];
  onRowClick: (id: string) => void;
}

function ApplicationsTable({ data, onRowClick }: ApplicationsTableProps) {
  type ApplicationRow = (typeof data)[number];
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const tableRef = useState(() => ({
    current: null as null | HTMLDivElement,
  }))[0];

  // Close status editor on outside click or ESC
  useEffect(() => {
    if (!editingStatusId) return;
    const onDown = (e: MouseEvent) => {
      const root = tableRef.current;
      if (!root) return;
      if (!(e.target instanceof Node)) return;
      if (!root.contains(e.target)) {
        setEditingStatusId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingStatusId(null);
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [editingStatusId]);
  // Pull update fn via hook avoidance: pass through window global? Simpler: reuse useApplications? Instead we rely on outer closure? We'll attach to (window as any) temporary if needed.
  // Since this component is defined inside the same file as ApplicationPage, it has access to nothing from parent.
  // We'll accept mutation through a custom event dispatched by parent for decoupling; simpler: we can attach updater on window in ApplicationPage before definition.
  // For brevity & low risk, we'll look for a global set by parent: (window as any).__apps_update.

  const columns = useMemo<ColumnDef<ApplicationRow, any>[]>(
    () => [
      {
        id: "title",
        header: () => (
          <div className='inline-flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-[#1dff00]/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
              />
            </svg>
            <span>Position</span>
          </div>
        ),
        accessorFn: (row) => row.job_title || "—",
        cell: (info) => (
          <div className='flex flex-col gap-0.5'>
            <span className='truncate font-semibold text-foreground/90 text-sm'>
              {info.getValue()}
            </span>
            {info.row.original.company && (
              <div className='flex items-center gap-2'>
                {info.row.original.logo_url && (
                  <div className='relative w-4 h-4 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#1dff00] via-background to-[#1dff00] p-[1px]'>
                    <div className='w-full h-full bg-background rounded flex items-center justify-center'>
                      <img
                        src={getProxiedLogoUrl(info.row.original.logo_url)}
                        alt=''
                        className='w-3 h-3 object-contain'
                      />
                    </div>
                  </div>
                )}
                <span className='text-xs text-foreground/50 truncate'>
                  {info.row.original.company}
                </span>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: ({ column }) => (
          <div className='inline-flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-[#1dff00]/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <TableColumnHeader column={column} title='Status' />
          </div>
        ),
        accessorKey: "status",
        cell: (info) => {
          const row = info.row.original as ApplicationRow & { id: string };
          const value = info.getValue() as string;
          const isEditing = editingStatusId === row.id;
          const selectableStatuses = APPLICATION_STATUS_OPTIONS;
          const displayValue = getApplicationStatusDisplay(
            value as ApplicationStatus,
            row.provider_status,
          );
          const color = getApplicationStatusDisplayColor(
            value as ApplicationStatus,
            row.provider_status,
          );
          return (
            <div
              className='relative'
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // Prevent Enter / Space in dropdown from triggering row onKey handlers higher up
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
            >
              {!isEditing && (
                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingStatusId(row.id);
                  }}
                  className='inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105'
                  style={{
                    backgroundColor: color + "15",
                    borderColor: color + "40",
                    color: color,
                  }}
                >
                  <span
                    className='w-1.5 h-1.5 rounded-full'
                    style={{ backgroundColor: color }}
                  ></span>
                  {displayValue}
                </button>
              )}
              {isEditing && (
                <div className='absolute z-30 top-0 left-0 min-w-[140px] rounded-xl border border-[#1dff00]/30 bg-gradient-to-br from-background to-background backdrop-blur-xl p-2 shadow-[0_0_30px_rgba(29,255,0,0.2)] flex flex-col gap-1'>
                  {selectableStatuses.map((s) => {
                    const sColor = getApplicationStatusColor(s);
                    return (
                      <button
                        key={s}
                        disabled={busyId === row.id || s === value}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (s === value) {
                            setEditingStatusId(null);
                            return;
                          }
                          try {
                            setBusyId(row.id);
                            const updater = (window as any).__apps_update as
                              | undefined
                              | ((id: string, patch: any) => Promise<any>);
                            if (updater) await updater(row.id, { status: s });
                          } finally {
                            setBusyId(null);
                            setEditingStatusId(null);
                          }
                        }}
                        className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg border transition-all ${s === value ? "bg-[#1dff00]/20 border-[#1dff00]/40 text-[#1dff00] font-semibold" : "border-transparent hover:border-foreground/10 hover:bg-foreground/5 text-foreground/70"}`}
                      >
                        <span
                          className='w-2 h-2 rounded-full'
                          style={{ backgroundColor: sColor }}
                        ></span>
                        {s}
                      </button>
                    );
                  })}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingStatusId(null);
                    }}
                    className='mt-1 w-full text-center text-xs text-foreground/40 hover:text-foreground/70 py-1'
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "applied",
        header: ({ column }) => (
          <div className='inline-flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-[#1dff00]/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
            <TableColumnHeader column={column} title='Applied' />
          </div>
        ),
        accessorFn: (row) => new Date(row.applied_date),
        cell: (info) => (
          <span className='text-sm text-foreground/70 font-medium'>
            {info.getValue<Date>().toLocaleDateString()}
          </span>
        ),
        sortingFn: (a, b, columnId) =>
          a.getValue<Date>(columnId).getTime() -
          b.getValue<Date>(columnId).getTime(),
      },
      {
        id: "updated",
        header: ({ column }) => (
          <div className='inline-flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-[#1dff00]/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <TableColumnHeader column={column} title='Updated' />
          </div>
        ),
        accessorFn: (row) => new Date(row.updated_at || row.applied_date),
        cell: (info) => (
          <span className='text-sm text-foreground/70 font-medium'>
            {info.getValue<Date>().toLocaleDateString()}
          </span>
        ),
        sortingFn: (a, b, columnId) =>
          a.getValue<Date>(columnId).getTime() -
          b.getValue<Date>(columnId).getTime(),
      },
      {
        id: "score",
        header: ({ column }) => (
          <div className='inline-flex items-center gap-2'>
            <svg
              className='w-4 h-4 text-[#1dff00]/60'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
              />
            </svg>
            <TableColumnHeader column={column} title='Score' />
          </div>
        ),
        accessorFn: (row) => row.match_score ?? null,
        cell: (info) => <MatchScoreBadge score={info.getValue<number | null>()} />,
        sortingFn: (a, b, columnId) => {
          const scoreA = a.getValue<number | null>(columnId);
          const scoreB = b.getValue<number | null>(columnId);
          if (scoreA == null && scoreB == null) return 0;
          if (scoreA == null) return -1;
          if (scoreB == null) return 1;
          return scoreA - scoreB;
        },
      },
    ],
    [busyId, editingStatusId],
  );

  return (
    <div
      ref={(n) => (tableRef.current = n)}
      className='relative rounded-2xl border border-[#1dff00]/20 bg-gradient-to-br from-background via-background to-background overflow-hidden shadow-[0_0_30px_rgba(29,255,0,0.1)]'
    >
      {/* Ambient Glow Effect */}
      <div className='absolute -top-20 -right-20 h-64 w-64 bg-[#1dff00]/10 rounded-full blur-3xl opacity-40 pointer-events-none'></div>

      <div className='overflow-auto relative z-10'>
        <TableProvider<ApplicationRow, any>
          data={data}
          columns={columns}
          className='min-w-full'
        >
          <KTableHeader className='sticky top-0 z-20 backdrop-blur-xl bg-gradient-to-r from-background/95 to-background/95 border-b border-[#1dff00]/20'>
            {(headerGroup) => (
              <TableHeaderGroup headerGroup={headerGroup.headerGroup}>
                {({ header }) => (
                  <KTableHead
                    header={header}
                    className='text-foreground/80 text-xs font-semibold uppercase tracking-wider px-6 py-4'
                  />
                )}
              </TableHeaderGroup>
            )}
          </KTableHeader>
          <KTableBody>
            {(row) => {
              const original = row.row.original as ApplicationRow & {
                id: string;
              };
              return (
                <KTableRow
                  row={row.row}
                  className='cursor-pointer border-b border-foreground/5 hover:bg-gradient-to-r hover:from-[#1dff00]/5 hover:to-transparent hover:border-[#1dff00]/20 transition-all group'
                  onClick={() => onRowClick(original.id)}
                >
                  {({ cell }) => (
                    <KTableCell cell={cell} className='px-6 py-4' />
                  )}
                </KTableRow>
              );
            }}
          </KTableBody>
        </TableProvider>
      </div>
      <div className='px-6 py-3 text-xs text-foreground/40 flex items-center justify-between border-t border-[#1dff00]/20 bg-background/50 backdrop-blur'>
        <div className='flex items-center gap-2'>
          <svg
            className='w-3.5 h-3.5'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
          <span className='font-medium'>{data.length} records</span>
        </div>
      </div>
    </div>
  );
}
