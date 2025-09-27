import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useApplications, type ApplicationStatus } from "../../../hooks/useApplications";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast-provider";

import { LayoutGrid, List as ListIcon, Search, Columns, ExternalLink, Link2, Clipboard, RefreshCw } from "lucide-react";
import { KanbanProvider, KanbanBoard, KanbanHeader, KanbanCards, KanbanCard } from "../../../components/ui/kibo-ui/kanban";
import Roadmap, { RoadmapColumn, RoadmapGroup, RoadmapItem } from '../../../components/ui/kibo-ui/roadmap';
import { Skeleton } from '../../../components/ui/skeleton';

function ApplicationPage() {
  const { applications, exportCSV, update, refresh } = useApplications();
  useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | ApplicationStatus>("All");
  const [sortBy, setSortBy] = useState<"score" | "recent" | "company" | "status">("score");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("grid");

  // Restore preferences on mount
  useEffect(() => {
    try {
      // Read deep-link filters first
      const u = new URL(window.location.href);
      const qsStatus = u.searchParams.get('status');
      const qsQuery = u.searchParams.get('q');
      const qsView = u.searchParams.get('view');
      if (qsStatus && ["All","Pending","Applied","Interview","Offer","Rejected","Withdrawn"].includes(qsStatus)) setSelectedStatus(qsStatus as any);
      if (typeof qsQuery === 'string' && qsQuery.length) setSearchQuery(qsQuery);
      if (qsView && (qsView === 'grid' || qsView === 'list' || qsView === 'kanban')) setViewMode(qsView);

      const raw = localStorage.getItem("jr.apps.prefs.v1");
      if (raw) {
        const p = JSON.parse(raw);
        // Only apply stored prefs if not overridden by query params
        if (!qsView && (p.viewMode === "grid" || p.viewMode === "list" || p.viewMode === "kanban")) setViewMode(p.viewMode);
        if (!qsStatus && ["All","Pending","Applied","Interview","Offer","Rejected","Withdrawn"].includes(p.selectedStatus)) setSelectedStatus(p.selectedStatus as any);
        if (["score","recent","company","status"].includes(p.sortBy)) setSortBy(p.sortBy);
        if (!qsQuery && typeof p.searchQuery === 'string') setSearchQuery(p.searchQuery);
      }
    } catch {}
  }, []);

  // Persist preferences when they change
  useEffect(() => {
    try {
      const payload = { viewMode, selectedStatus, sortBy, searchQuery };
      localStorage.setItem("jr.apps.prefs.v1", JSON.stringify(payload));
    } catch {}
  }, [viewMode, selectedStatus, sortBy, searchQuery]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = applications.filter((a) => {
      const matchesQ = !q || [a.job_title, a.company, a.location, a.status].some((v) => (v ?? "").toLowerCase().includes(q));
      const matchesStatus = selectedStatus === "All" || a.status === selectedStatus;
      return matchesQ && matchesStatus;
    });
    const extractScore = (rec: any) => {
      if (typeof rec.match_score === 'number') return rec.match_score;
      if (rec.notes && /match[:=]\s*(\d{1,3})/i.test(rec.notes)) return Number(RegExp.$1);
      return 0;
    };
    switch (sortBy) {
      case "recent":
        list = list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "company":
        list = list.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
        break;
      case "status":
        list = list.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "score":
      default:
        list = list.sort((a, b) => extractScore(b) - extractScore(a));
    }
    return list;
  }, [applications, searchQuery, selectedStatus, sortBy]);

  // Roadmap / status distribution (design-only enhancement)
  const statusOrder: ApplicationStatus[] = ["Pending", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"]; // stable order
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of statusOrder) counts[s] = 0;
    for (const a of applications) if (counts[a.status] != null) counts[a.status]++;
    return counts;
  }, [applications]);
  const total = applications.length || 1;
  const statusColors: Record<ApplicationStatus, { base: string; fg: string; ring: string }> = {
    Pending:   { base: 'from-zinc-700/50 via-zinc-800/60 to-zinc-900/60', fg: 'text-zinc-200', ring: 'ring-zinc-400/30' },
    Applied:   { base: 'from-emerald-500/30 via-emerald-600/25 to-emerald-900/40', fg: 'text-emerald-100', ring: 'ring-emerald-400/40' },
    Interview: { base: 'from-amber-400/35 via-amber-500/25 to-amber-900/40', fg: 'text-amber-100', ring: 'ring-amber-400/40' },
    Offer:     { base: 'from-lime-400/40 via-lime-500/30 to-emerald-900/40', fg: 'text-lime-100', ring: 'ring-lime-300/40' },
    Rejected:  { base: 'from-rose-500/35 via-rose-600/25 to-rose-900/40', fg: 'text-rose-100', ring: 'ring-rose-400/40' },
    Withdrawn: { base: 'from-slate-500/30 via-slate-600/25 to-slate-900/40', fg: 'text-slate-200', ring: 'ring-slate-400/30' },
  };
  const percent = (s: ApplicationStatus) => (statusCounts[s] / total) * 100;

  const SHOW_ROADMAP = true; // toggle integration
  const ENABLE_VIRTUAL = true;
  const ROW_ESTIMATE = 138; // px approximate card height

  // Local loading simulation (could be replaced with isLoading from hook if available)
  const [initialLoading, setInitialLoading] = useState(false);
  useEffect(() => {
    if (!applications.length) {
      setInitialLoading(true);
      const t = setTimeout(() => setInitialLoading(false), 300); // brief skeleton flash
      return () => clearTimeout(t);
    }
  }, [applications.length]);

  // Virtualization (simple windowing) for grid/list
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const onScroll = useCallback(() => {
    if (!scrollParentRef.current) return;
    setScrollTop(scrollParentRef.current.scrollTop);
  }, []);
  useEffect(() => {
    const el = scrollParentRef.current;
    if (!el) return;
    const handle = () => setViewportHeight(el.clientHeight);
    handle();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', handle);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', handle); };
  }, [onScroll]);

  const virtual = useMemo(() => {
    if (!ENABLE_VIRTUAL || viewMode === 'kanban') return { start: 0, end: filtered.length, padTop: 0, padBottom: 0 };
    const total = filtered.length;
    const vh = viewportHeight || window.innerHeight * 0.6;
    const overscan = 6;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_ESTIMATE) - overscan);
    const visibleCount = Math.ceil(vh / ROW_ESTIMATE) + overscan * 2;
    const endIndex = Math.min(total, startIndex + visibleCount);
    const padTop = startIndex * ROW_ESTIMATE;
    const padBottom = Math.max(0, (total - endIndex) * ROW_ESTIMATE);
    return { start: startIndex, end: endIndex, padTop, padBottom };
  }, [filtered.length, viewportHeight, scrollTop, viewMode]);

  const visibleSlice = ENABLE_VIRTUAL && viewMode !== 'kanban'
    ? filtered.slice(virtual.start, virtual.end)
    : filtered;

  // Persist collapsed roadmap groups (id pattern: roadmap:group:<label>)
  const [roadmapCollapsed, setRoadmapCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jr.roadmap.collapsed.v1');
      if (raw) setRoadmapCollapsed(JSON.parse(raw));
    } catch {}
  }, []);
  const setGroupOpen = (label: string, open: boolean) => {
    setRoadmapCollapsed(prev => {
      const next = { ...prev, [label]: !open }; // store collapsed state
      try { localStorage.setItem('jr.roadmap.collapsed.v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const CollapsibleGroup: typeof RoadmapGroup = (props: any) => (
    <RoadmapGroup
      {...props}
      defaultOpen={!roadmapCollapsed[props.label]}
      collapsible
      onClick={(e: any) => {
        // Allow original onClick if passed
        if (props.onClick) props.onClick(e);
        if ((e.target as HTMLElement).closest('button')) {
          setGroupOpen(props.label, roadmapCollapsed[props.label] ? false : true);
        }
      }}
    />
  );

  return (
    <div className="space-y-7 sm:space-y-9">
      {/* Heading + actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight bg-gradient-to-r from-white via-white to-[#1dff00] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(29,255,0,0.25)]">Applications</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
              {filtered.length} results
            </span>
          </div>
          {/* Roadmap style distribution bar */}
          <div className="flex flex-col gap-2">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-white/5 via-white/10 to-white/5 ring-1 ring-white/10">
              <div className="absolute inset-0 flex">
                {statusOrder.map(s => (
                  <div
                    key={s}
                    className={`h-full transition-all duration-500 ease-out bg-gradient-to-tr ${statusColors[s].base} ${percent(s)===0 ? 'opacity-0' : 'opacity-90'} hover:opacity-100`}
                    style={{ width: percent(s)+ '%' }}
                    title={`${s}: ${statusCounts[s]} (${percent(s).toFixed(1)}%)`}
                    aria-label={`${s} ${statusCounts[s]} applications`}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] mix-blend-overlay" />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-white/60">
              {statusOrder.map(s => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
                  <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-tr ${statusColors[s].base.replace(/\s.*$/, '')} brightness-125`} />
                  {s}
                  <span className="text-white/40">{statusCounts[s]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-start">
          <Button
            variant="outline"
            className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10 hover:border-[#1dff00]/40 transition-colors"
            onClick={exportCSV}
            title="Export as CSV"
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10 hover:border-[#1dff00]/40 transition-colors"
            onClick={() => refresh()}
            title="Refresh applications"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-white/[0.05] via-white/[0.09] to-white/[0.03] border border-white/[0.12] backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_28px_-8px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(circle_at_25%_20%,black,transparent_70%)] bg-[conic-gradient(from_160deg,rgba(29,255,0,0.15),rgba(10,130,70,0.05),transparent_65%)]" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/[0.08] border-white/25 text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00]/50 hover:border-[#1dff00]/40 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[170px] bg-white/[0.08] border-white/25 text-white focus:border-[#1dff00] focus:ring-[#1dff00]/40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 backdrop-blur-md text-white border-white/20 shadow-lg">
                  <SelectItem value="score">Best match</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <div className="inline-flex rounded-lg border border-white/20 overflow-hidden bg-white/5 backdrop-blur-sm">
                <button
                  className={`px-3 py-2 text-sm text-white/80 hover:text-white transition ${viewMode==='grid' ? 'bg-[#1dff00]/20 text-[#1dff00]' : ''}`}
                  title="Grid view"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/80 hover:text-white transition border-l border-white/15 ${viewMode==='list' ? 'bg-[#1dff00]/20 text-[#1dff00]' : ''}`}
                  title="List view"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/80 hover:text-white transition border-l border-white/15 ${viewMode==='kanban' ? 'bg-[#1dff00]/20 text-[#1dff00]' : ''}`}
                  title="Kanban view"
                  onClick={() => setViewMode('kanban')}
                >
                  <Columns className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 -m-1">
            {(["All", "Pending", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStatus(s)}
                className={`m-1 text-xs sm:text-sm rounded-full relative overflow-hidden ${selectedStatus===s ? 'bg-[#1dff00] text-black ring-1 ring-[#1dff00]/60 shadow-[0_0_0_1px_rgba(29,255,0,0.3),0_4px_22px_-6px_rgba(29,255,0,0.45)]' : 'text-white hover:text-white hover:bg-white/10'} transition-all`}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Content */}
      <Card className="bg-transparent border-none shadow-none" ref={scrollParentRef}>
        <CardContent className="p-0">
          {SHOW_ROADMAP && (
            <div className="mb-10 mt-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wide text-white/80 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1dff00] animate-pulse" /> Roadmap Preview
                </h2>
                <span className="text-[10px] text-white/40">Design scaffold</span>
              </div>
              <Roadmap condensed columns={[{id:'now',label:'Now'},{id:'next',label:'Next'},{id:'later',label:'Later'}]} className="mt-2">
                <RoadmapColumn id="now" label="Now" description="Active focus">
                  <CollapsibleGroup label="Platform">
                    <RoadmapItem title="Application distribution bar" status="done" progress={100} tags={['ui','analytics']} description="Visual aggregate of statuses using animated stacked segments." />
                    <RoadmapItem title="Enhanced cards" status="in-progress" progress={70} tags={['design']} description="Gradient shells, depth, consistent typography, hover accent ring." />
                  </CollapsibleGroup>
                  <CollapsibleGroup label="Performance">
                    <RoadmapItem title="List virtualization" status="planned" tags={['perf']} description="Window large result sets to reduce layout + paint cost." />
                  </CollapsibleGroup>
                </RoadmapColumn>
                <RoadmapColumn id="next" label="Next" description="Near-term">
                  <CollapsibleGroup label="Insights">
                    <RoadmapItem title="Time-to-stage metrics" status="planned" tags={['metrics']} description="Derive average days between stages and sparkline trends." />
                    <RoadmapItem title="Status forecasting" status="planned" tags={['ml','predict']} description="Heuristic scoring predicting chance of advancing to next stage." />
                  </CollapsibleGroup>
                </RoadmapColumn>
                <RoadmapColumn id="later" label="Later" description="Exploratory">
                  <CollapsibleGroup label="Collaboration">
                    <RoadmapItem title="Shared workspace" status="blocked" tags={['team']} description="Invite collaborators to comment + propose edits." />
                    <RoadmapItem title="Change history" status="planned" tags={['audit']} description="Stage transitions with diff + timeline view." />
                  </CollapsibleGroup>
                </RoadmapColumn>
              </Roadmap>
            </div>
          )}
          {applications.length === 0 && !searchQuery && selectedStatus === 'All' && (
            <div className="border border-white/15 bg-black/30 rounded-xl p-8 text-center text-[#ffffffb3]">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#1dff00]/15 grid place-items-center mb-4">
                <Columns className="w-6 h-6 text-[#1dff00]" />
              </div>
              <h3 className="text-white text-lg font-medium mb-1">No applications yet</h3>
              <p className="text-sm text-[#ffffff80] mb-4">Start by applying to a job or importing an existing application.</p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => refresh()}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </div>
            </div>
          )}
          {viewMode !== 'kanban' ? (
          <div ref={containerRef} className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" : "space-y-4"}>
            {initialLoading && !filtered.length && (
              <>
                {Array.from({length: viewMode==='grid'?6:4}).map((_,i)=>(
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-11 h-11 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-6 w-10 rounded-md" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {/* Virtual padding top */}
            {ENABLE_VIRTUAL && (viewMode === 'grid' || viewMode === 'list') && virtual.padTop > 0 && (
              <div style={{height: virtual.padTop}} aria-hidden />
            )}
            {visibleSlice.map((a) => (
              <div key={a.id} className={viewMode === 'grid' ?
                "group relative bg-gradient-to-br from-white/[0.05] via-white/[0.06] to-white/[0.04] border border-white/10 rounded-2xl p-4 hover:border-[#1dff00]/50 hover:shadow-[0_0_0_1px_rgba(29,255,0,0.35),0_6px_28px_-6px_rgba(0,0,0,0.55)] transition-all overflow-hidden" :
                "group relative bg-gradient-to-br from-white/[0.05] via-white/[0.06] to-white/[0.04] border border-white/10 rounded-2xl p-3 hover:border-[#1dff00]/50 hover:shadow-[0_0_0_1px_rgba(29,255,0,0.35),0_6px_28px_-6px_rgba(0,0,0,0.55)] transition-all overflow-hidden"}>
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_75%_20%,rgba(29,255,0,0.25),transparent_60%)]" />
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-sm flex-shrink-0 overflow-hidden ring-2 ring-[#1dff00]/40 shadow-[0_4px_18px_-4px_rgba(29,255,0,0.5)]">
                    {/* Show initials if not a URL or image; keep simple */}
                    <span className="select-none">
                      {(a.logo && a.logo.length > 1 ? a.logo : (((a.company || a.job_title || "")
                        .toString()
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w: string) => w[0] || "")
                        .join("") || "").toUpperCase()))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="text-white font-medium truncate leading-tight">
                        {a.job_title}
                      </div>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide border border-white/15 bg-white/5 text-white/70 backdrop-blur-sm">
                        {a.status}
                      </span>
                    </div>
                    <div className="text-[#ffffffb0] text-sm truncate font-medium">{a.company}</div>
                    <div className="flex items-center gap-2 text-[11px] text-[#ffffff60] mt-1">
                      <span>{new Date(a.applied_date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{a.location}</span>
                    </div>
                  </div>
                  <MatchScoreBadge score={a.match_score ?? 0} />
                </div>
                {(a.app_url || a.run_id || a.recording_url) && (
                  <div className="mt-3 flex items-center gap-4 text-[11px]">
                    {a.app_url && (
                      <a
                        href={a.app_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#1dff00] hover:underline"
                        title="Open application"
                        aria-label="Open application"
                      >
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                    )}
                    {a.run_id && (
                      <button
                        className="inline-flex items-center gap-1 text-[#ffffff99] hover:text-white"
                        onClick={() => navigator.clipboard?.writeText(a.run_id!)}
                        title="Copy run id"
                        aria-label="Copy run id"
                      >
                        <Clipboard className="w-3 h-3" /> Run
                      </button>
                    )}
                    {a.recording_url && (
                      <a
                        href={a.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs inline-flex items-center gap-1 text-[#ffffff99] hover:text-white"
                        title="Open recording"
                        aria-label="Open recording"
                      >
                        <Link2 className="w-3 h-3" /> Recording
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
            {ENABLE_VIRTUAL && (viewMode === 'grid' || viewMode === 'list') && virtual.padBottom > 0 && (
              <div style={{height: virtual.padBottom}} aria-hidden />
            )}
          </div>
          ) : (
            <KanbanProvider
              columns={[
                { id: 'Pending', name: 'Pending', color: '#6B7280' },
                { id: 'Applied', name: 'Applied', color: '#1dff00' },
                { id: 'Interview', name: 'Interview', color: '#F59E0B' },
                { id: 'Offer', name: 'Offer', color: '#10B981' },
                { id: 'Rejected', name: 'Rejected', color: '#EF4444' },
                { id: 'Withdrawn', name: 'Withdrawn', color: '#94A3B8' },
              ]}
              data={applications.map((a) => ({ ...a, id: a.id, column: a.status }))}
              onItemMove={async (id, toColumn) => {
                const rec = applications.find((a) => a.id === id);
                if (!rec) return;
                if (rec.status === toColumn) return;
                try {
                  await update(id, { status: toColumn as ApplicationStatus });
                } catch {
                  await refresh();
                }
              }}
            >
              {(column) => (
                <KanbanBoard id={column.id} key={column.id}>
                  <KanbanHeader>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }} />
                      <span className="text-white">{column.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/70">
                        {applications.filter((a) => a.status === (column.id as ApplicationStatus)).length}
                      </span>
                    </div>
                  </KanbanHeader>
                  <KanbanCards id={column.id}>
                    {(a: any) => (
                      <KanbanCard key={a.id} id={a.id}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center text-black font-bold text-xs flex-shrink-0">
                            {a.logo || (a.company?.[0] ?? "")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-medium truncate">{a.job_title}</div>
                            <div className="text-[#ffffff80] text-xs truncate">{a.company}</div>
                          </div>
                          <MatchScoreBadge score={a.match_score ?? 0} />
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#ffffff60]">
                          <span>{new Date(a.applied_date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{a.location}</span>
                        </div>
                      </KanbanCard>
                    )}
                  </KanbanCards>
                </KanbanBoard>
              )}
            </KanbanProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ApplicationPage;
export { ApplicationPage };