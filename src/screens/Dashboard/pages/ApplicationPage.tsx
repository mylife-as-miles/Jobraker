import SortDropdown from '@/components/SortDropdown';
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useApplications, type ApplicationStatus } from "../../../hooks/useApplications";
import { Skeleton } from "../../../components/ui/skeleton";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";


import { List as ListIcon, Search, Columns, ExternalLink, Link2, Clipboard, RefreshCw, GanttChart, Calendar as CalendarIcon, Table as TableIcon } from "lucide-react";
import { KanbanProvider, KanbanBoard, KanbanHeader, KanbanCards, KanbanCard } from "../../../components/ui/kibo-ui/kanban";
import { ListProvider, ListGroup, ListHeader, ListItems, ListItem, type DragEndEvent as ListDragEndEvent } from "../../../components/ui/kibo-ui/list";
import { TableProvider, TableHeader as KTableHeader, TableHeaderGroup, TableHead as KTableHead, TableColumnHeader, TableBody as KTableBody, TableRow as KTableRow, TableCell as KTableCell, type ColumnDef } from "../../../components/ui/kibo-ui/table";
import Gantt, { GanttItem } from "../../../components/ui/kibo-ui/gantt";
import KiboCalendar, { CalendarEvent } from "../../../components/ui/kibo-ui/calendar";
import CalendarDayDetail from "../../../components/ui/kibo-ui/CalendarDayDetail";
import Modal from "../../../components/ui/modal";

function ApplicationPage() {
  const { applications, exportCSV, update, refresh, loading: appsLoading } = useApplications();

  // Debounced search state: raw input updates immediately; searchQuery drives filters.
  const [rawSearch, setRawSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | ApplicationStatus>("All");
  const [sortBy, setSortBy] = useState<"score" | "recent" | "company" | "status">("score");
  const [viewMode, setViewMode] = useState<"gantt" | "list" | "kanban" | "calendar" | "table">("gantt");
  const [ganttZoom, setGanttZoom] = useState(() => {
    const z = Number(localStorage.getItem('jr.apps.gantt.zoom') || '1');
    return Number.isFinite(z) ? Math.min(4, Math.max(0, z)) : 1;
  });
  const [showFuture, setShowFuture] = useState(() => localStorage.getItem('jr.apps.gantt.future') !== '0');
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailApp = useMemo(() => applications.find(a => a.id === detailId) || null, [detailId, applications]);

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
  if (qsView && (qsView === 'gantt' || qsView === 'list' || qsView === 'kanban' || qsView === 'calendar' || qsView === 'table')) setViewMode(qsView as any);

      const raw = localStorage.getItem("jr.apps.prefs.v1");
      if (raw) {
        const p = JSON.parse(raw);
        // Only apply stored prefs if not overridden by query params
  if (!qsView && (p.viewMode === "gantt" || p.viewMode === "list" || p.viewMode === "kanban" || p.viewMode === 'calendar' || p.viewMode === 'table')) setViewMode(p.viewMode);
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

  useEffect(() => { try { localStorage.setItem('jr.apps.gantt.zoom', String(ganttZoom)); } catch {} }, [ganttZoom]);
  useEffect(() => { try { localStorage.setItem('jr.apps.gantt.future', showFuture ? '1' : '0'); } catch {} }, [showFuture]);

  // Keyboard shortcuts for Gantt view
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
  if (viewMode !== 'gantt') return;
      if (e.key === '+' || (e.key === '=' && e.shiftKey)) { setGanttZoom(z => Math.min(4, z+1)); }
      else if (e.key === '-' ) { setGanttZoom(z => Math.max(0, z-1)); }
      else if (e.key.toLowerCase() === 'f') { setShowFuture(f => !f); }
      else if (e.key === 'Escape' && detailId) { setDetailId(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, detailId]);

  const handleBarClick = useCallback((item: GanttItem) => {
    setDetailId(item.id);
  }, []);

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

  // Kanban data is only filtered by search query, not status
  const kanbanData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((a) => {
      return !q || [a.job_title, a.company, a.location, a.status].some((v) => (v ?? "").toLowerCase().includes(q));
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
    return () => { try { delete (window as any).__apps_update; } catch {} };
  }, [update]);

  // Calendar events (Overview style): one per application using interview date if present else applied date
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return filtered.map(a => {
      const interview = a.interview_date ? new Date(a.interview_date) : null;
      const applied = new Date(a.applied_date);
      const date = interview && !isNaN(interview.getTime()) ? interview : applied;
      return {
        id: a.id,
        date,
        title: a.job_title || a.company || 'Application',
        subtitle: a.company || undefined,
        status: a.status,
      } as CalendarEvent;
    });
  }, [filtered]);

  // Calendar selection state (single day or range) for detail overlay
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null);
  // Register coach marks with stable IDs (replaces brittle structural selectors)
  useRegisterCoachMarks({
    page: 'application',
    marks: [
      {
        id: 'application-search',
        selector: '#application-search',
        title: 'Search Your Applications',
        body: 'Quickly filter your applications by title, company, location or status keywords.'
      },
      {
        id: 'application-view-toggle',
        selector: '#application-view-toggle',
        title: 'Multiple Visual Views',
        body: 'Switch between Gantt, List, Kanban, Calendar and Table to analyze your pipeline from different angles.'
      },
      {
        id: 'application-status-filters',
        selector: '#application-status-filters',
        title: 'Status Filters',
        body: 'Focus on a specific stage like Interview or Offer to reduce noise and act faster.'
      },
      {
        id: 'application-gantt',
        selector: '#application-gantt',
        title: 'Timeline Insight',
        body: 'The Gantt view shows lifecycle duration per application. Active stages extend to today for quick aging awareness.'
      }
    ]
  });

  // Clear selections when leaving calendar view to avoid stray overlay when returning
  useEffect(() => {
    if (viewMode !== 'calendar') { setSelectedDate(null); setSelectedRange(null); }
  }, [viewMode]);

  const initialLoading = appsLoading && applications.length === 0;
  
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold text-white">Applications</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={exportCSV}>Export CSV</Button>
          <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => refresh()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="p-4 sm:p-6 bg-white/[0.04] border border-white/10 rounded-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  id="application-search"
                  data-tour="application-search"
                  placeholder="Search applications..."
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  className="pl-10 bg-white/10 border-white/15 text-white placeholder:text-white/50 focus:border-white focus:ring-0"
                />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
            <SortDropdown />


              <div id="application-view-toggle" className="inline-flex rounded-lg border border-white/20 overflow-hidden bg-white/5 backdrop-blur-sm" data-tour="application-view-toggle">
                <button
                  className={`px-3 py-2 text-sm text-white/70 hover:text-white transition ${viewMode==='gantt' ? 'bg-white/20 text-white' : ''}`}
                  title="Gantt view"
                  onClick={() => setViewMode('gantt')}
                >
                  <GanttChart className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/70 hover:text-white transition border-l border-white/15 ${viewMode==='list' ? 'bg-white/20 text-white' : ''}`}
                  title="List view"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/70 hover:text-white transition border-l border-white/15 ${viewMode==='kanban' ? 'bg-white/20 text-white' : ''}`}
                  title="Kanban view"
                  onClick={() => setViewMode('kanban')}
                >
                  <Columns className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/70 hover:text-white transition border-l border-white/15 ${viewMode==='calendar' ? 'bg-white/20 text-white' : ''}`}
                  title="Calendar view"
                  onClick={() => setViewMode('calendar')}
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/70 hover:text-white transition border-l border-white/15 ${viewMode==='table' ? 'bg-white/20 text-white' : ''}`}
                  title="Table view"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div id="application-status-filters" className="flex flex-wrap gap-2 -m-1 items-center" data-tour="application-status-filters">
            {(["All", "Pending", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStatus(s)}
                className={`m-1 text-xs sm:text-sm rounded-full ${selectedStatus===s ? 'bg-white text-black' : 'text-white hover:bg-white/10'} transition`}
              >
                {s}
              </Button>
            ))}
            {viewMode === 'gantt' && (
              <div className="m-1 flex items-center gap-2 text-[10px] text-white/60 border-l border-white/10 pl-3">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" className="accent-[#1dff00]" checked={showFuture} onChange={e => setShowFuture(e.target.checked)} />
                  <span>Extend active bars to today</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </Card>
<div className="h-6"></div>
      {/* Content */}
      <Card className="bg-transparent border-none shadow-none">
        <CardContent className="p-0">
          {initialLoading ? (
            <ApplicationPageSkeleton viewMode={viewMode} />
          ) : applications.length === 0 ? (
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
          ) : filtered.length === 0 ? (
            <div className="border border-white/15 bg-black/30 rounded-xl p-8 text-center text-[#ffffffb3]">
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-400/15 grid place-items-center mb-4">
                <Search className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-white text-lg font-medium mb-1">No matching applications</h3>
              <p className="text-sm text-[#ffffff80] mb-4">Try adjusting your search or status filters.</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
              {viewMode === 'gantt' && (
                <div className="space-y-4">
                  <div className="text-xs text-white/60 flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#71717a] to-[#27272a]" /> Pending</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#1dff00] to-[#0a8246]" /> Applied</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#fbbf24] to-[#a16207]" /> Interview</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#84cc16] to-[#166534]" /> Offer</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#fb7185] to-[#881337]" /> Rejected</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#94a3b8] to-[#334155]" /> Withdrawn</span>
                  </div>
                  <div id="application-gantt" data-tour="application-gantt">
                    <Gantt
                      zoom={ganttZoom}
                      onZoomChange={setGanttZoom}
                      showToday
                      groupBy={(item) => item.status}
                      onBarClick={(item) => handleBarClick(item)}
                      items={filtered.map<GanttItem>(a => {
                        const applied = new Date(a.applied_date);
                        const updated = new Date(a.updated_at || a.applied_date || Date.now());
                        const activeStatuses: ApplicationStatus[] = ['Pending','Applied','Interview'];
                        let end: Date;
                        if (activeStatuses.includes(a.status) && showFuture) {
                          end = new Date();
                        } else if (a.interview_date && a.status === 'Interview') {
                          const idate = new Date(a.interview_date);
                          end = idate > applied ? idate : updated;
                        } else {
                          end = updated > applied ? updated : new Date(applied.getTime() + 24*3600*1000);
                        }
                        if (end.getTime() === applied.getTime()) {
                          end = new Date(end.getTime() + 6*3600*1000);
                        }
                        return {
                          id: a.id,
                          label: a.job_title || a.company || 'Untitled',
                          start: applied,
                          end,
                          status: a.status,
                          extra: a.company,
                          groupKey: a.status,
                          raw: a,
                        };
                      })}
                      renderLabel={(item: any) => (
                        <div className="flex flex-col truncate">
                          <span className="truncate font-medium text-white/80 text-xs">{item.label}</span>
                          {item.extra && <span className="truncate text-[10px] text-white/40">{item.extra}</span>}
                        </div>
                      )}
                      renderBarContent={(item: any) => (
                        <div className="flex items-center gap-1 w-full truncate">
                          <span className="truncate">{item.status}</span>
                        </div>
                      )}
                    />
                  </div>
                </div>
              )}
              {viewMode === 'list' && (
                <div className="border border-white/10 rounded-xl bg-black/30 overflow-hidden">
                  <ListProvider
                    onDragEnd={async (e: ListDragEndEvent) => {
                      const active = e.active?.data?.current as any;
                      const over = e.over?.id as string | undefined;
                      if (!active || !over || active.parent === over) return;
                      const appId = active.id as string;
                      try {
                        await update(appId, { status: over as ApplicationStatus });
                      } catch { await refresh(); }
                    }}
                    className="divide-y divide-white/5"
                  >
                    {(['Pending','Applied','Interview','Offer','Rejected','Withdrawn'] as ApplicationStatus[]).map(status => {
                      const rows = filtered.filter(a => a.status === status);
                      const color = (
                        status === 'Applied' ? '#1dff00' :
                        status === 'Interview' ? '#F59E0B' :
                        status === 'Offer' ? '#10B981' :
                        status === 'Rejected' ? '#EF4444' :
                        status === 'Withdrawn' ? '#94A3B8' : '#6B7280'
                      );
                      if (rows.length === 0 && selectedStatus !== 'All') return null;
                      return (
                        <ListGroup key={status} id={status} className="flex flex-col">
                          <ListHeader name={status} color={color} className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-black/40" />
                          <ListItems className="p-2 sm:p-3 grid gap-2">
                            {rows.length === 0 && (
                              <div className="text-[11px] text-white/40 italic px-1 py-2">No {status.toLowerCase()} applications</div>
                            )}
                            {rows.map((a, idx) => (
                              <ListItem key={a.id} id={a.id} name={a.job_title} index={idx} parent={status} className="group relative">
                                <div className="flex items-center gap-3 w-full">
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center text-black font-bold text-[10px] sm:text-xs flex-shrink-0">
                                    {(a.logo && a.logo.length > 1 ? a.logo : (((a.company || a.job_title || '')).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('') || '').toUpperCase())}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <div className="text-white text-sm font-medium truncate" title={a.job_title}>{a.job_title}</div>
                                      <MatchScoreBadge score={a.match_score ?? 0} />
                                      <span className="ml-auto hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border border-white/15 bg-white/5 text-white/60 group-hover:border-[#1dff00]/40 group-hover:text-[#1dff00] transition">{a.status}</span>
                                    </div>
                                    <div className="text-[#ffffff80] text-[11px] sm:text-xs truncate">{a.company}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
                                      <span>{new Date(a.applied_date).toLocaleDateString()}</span>
                                      {a.location && <><span>•</span><span className="truncate max-w-[120px]">{a.location}</span></>}
                                      {a.interview_date && <><span>•</span><span className="text-[#F59E0B]">Interview {new Date(a.interview_date).toLocaleDateString()}</span></>}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    {a.app_url && (
                                      <a href={a.app_url} target="_blank" rel="noreferrer" className="text-[10px] text-[#1dff00] hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />Open</a>
                                    )}
                                    {a.run_id && (
                                      <button onClick={()=>navigator.clipboard?.writeText(a.run_id!)} className="text-[10px] text-white/60 hover:text-white inline-flex items-center gap-1"><Clipboard className="w-3 h-3" />Run</button>
                                    )}
                                    {a.recording_url && (
                                      <a href={a.recording_url} target="_blank" rel="noreferrer" className="text-[10px] text-white/60 hover:text-white inline-flex items-center gap-1"><Link2 className="w-3 h-3" />Rec</a>
                                    )}
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
              )}
              {viewMode === 'calendar' && (
                <div className="relative">
                  <KiboCalendar
                    events={calendarEvents}
                    showLegend
                    highlightToday
                    showHeader
                    enableAnalyticsRibbon={false}
                    enableICSExport
                    heatmap
                    densityMode="compact"
                    onQuickCreate={(partial) => console.log('quick create', partial)}
                    enableQuickCreate={false}
                    selectedDate={selectedDate || undefined}
                    onSelectDate={(d) => { setSelectedDate(d); setSelectedRange(null); }}
                    rangeSelectable
                    onSelectRange={(r) => { setSelectedRange(r); if (r) setSelectedDate(null); }}
                    className="border border-white/10 rounded-lg bg-black/40"
                  />
                  <CalendarDayDetail
                    date={selectedDate}
                    range={selectedRange}
                    onClose={() => { setSelectedDate(null); setSelectedRange(null); }}
                    applications={applications}
                    onUpdateApplication={update}
                    onCreateApplication={async () => { /* create not injected on ApplicationPage calendar detail */ }}
                  />
                </div>
              )}
              {viewMode === 'table' && (
                <ApplicationsTable
                  data={filtered}
                  onRowClick={(id) => setDetailId(id)}
                />
              )}
              {viewMode === 'kanban' && (
                <KanbanProvider
                  columns={[
                    { id: 'Pending', name: 'Pending', color: '#6B7280' },
                    { id: 'Applied', name: 'Applied', color: '#1dff00' },
                    { id: 'Interview', name: 'Interview', color: '#F59E0B' },
                    { id: 'Offer', name: 'Offer', color: '#10B981' },
                    { id: 'Rejected', name: 'Rejected', color: '#EF4444' },
                    { id: 'Withdrawn', name: 'Withdrawn', color: '#94A3B8' },
                  ]}
                  data={kanbanData.map((a) => ({ ...a, id: a.id, column: a.status }))}
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
                            {kanbanData.filter((a) => a.status === (column.id as ApplicationStatus)).length}
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
            </motion.div>
          )}
        </CardContent>
      </Card>
      <Modal open={!!detailApp} onClose={() => setDetailId(null)} title="" side="right" size="lg">
        {detailApp ? (
          <div className="space-y-6">
            {/* Header Section with Status Badge */}
            <div className="relative pb-6 border-b border-[#1dff00]/10">
              <div className="absolute top-0 right-0">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  detailApp.status === 'Applied' ? 'bg-[#1dff00]/10 text-[#1dff00] border border-[#1dff00]/20' :
                  detailApp.status === 'Interview' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' :
                  detailApp.status === 'Offer' ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20' :
                  detailApp.status === 'Rejected' ? 'bg-rose-400/10 text-rose-400 border border-rose-400/20' :
                  'bg-gray-400/10 text-gray-400 border border-gray-400/20'
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    detailApp.status === 'Applied' ? 'bg-[#1dff00]' :
                    detailApp.status === 'Interview' ? 'bg-amber-400' :
                    detailApp.status === 'Offer' ? 'bg-lime-400' :
                    detailApp.status === 'Rejected' ? 'bg-rose-400' :
                    'bg-gray-400'
                  } shadow-[0_0_4px_currentColor]`} />
                  {detailApp.status}
                </span>
              </div>
              <div className="space-y-2 pr-32">
                <h2 className="text-2xl font-bold text-white">{detailApp.job_title}</h2>
                <div className="flex items-center gap-2 text-white/60">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1dff00]/20 to-[#1dff00]/5 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#1dff00]">{detailApp.company.charAt(0)}</span>
                  </div>
                  <span className="text-base font-medium text-white/80">{detailApp.company}</span>
                </div>
              </div>
            </div>

            {/* Timeline & Key Dates */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Timeline</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-[#1dff00]/20 transition-colors">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-[#1dff00]/10 to-transparent border border-[#1dff00]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#1dff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/40">Applied Date</div>
                    <div className="text-sm font-medium text-white/90">{new Date(detailApp.applied_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>
                
                {detailApp.interview_date && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-400/[0.02] border border-amber-400/10 hover:border-amber-400/30 transition-colors">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400/10 to-transparent border border-amber-400/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-amber-400/60">Interview Scheduled</div>
                      <div className="text-sm font-medium text-amber-400">{new Date(detailApp.interview_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/40">Last Updated</div>
                    <div className="text-sm font-medium text-white/70">{new Date(detailApp.updated_at).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            {detailApp.salary && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Compensation</h3>
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#1dff00]/5 to-transparent border border-[#1dff00]/20">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#1dff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-lg font-bold text-[#1dff00]">{detailApp.salary}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes Section */}
            {detailApp.notes && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Notes & Details</h3>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 max-h-60 overflow-auto scrollbar-thin scrollbar-thumb-[#1dff00]/30 scrollbar-track-transparent">
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{detailApp.notes}</p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {detailApp.app_url && (
                  <a 
                    href={detailApp.app_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/20 hover:shadow-[0_0_20px_rgba(29,255,0,0.2)] transition-all duration-200 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Application
                  </a>
                )}
                {detailApp.recording_url && (
                  <a 
                    href={detailApp.recording_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    View Recording
                  </a>
                )}
                {detailApp.run_id && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(detailApp.run_id!);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Run ID
                  </button>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-white/10 flex gap-3">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 border-white/20 hover:border-white/30 hover:bg-white/5 text-white/70 hover:text-white transition-all"
                onClick={() => setDetailId(null)}
              >
                Close
              </Button>
              <Button 
                size="sm" 
                className="flex-1 bg-gradient-to-r from-[#1dff00] to-[#0a8246] hover:shadow-[0_0_20px_rgba(29,255,0,0.3)] text-black font-semibold transition-all"
                onClick={() => {
                  // Edit functionality can be added here
                  console.log('Edit application:', detailApp.id);
                }}
              >
                Edit Details
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default ApplicationPage;
export { ApplicationPage };

// --- Skeletons ---
interface ApplicationPageSkeletonProps { viewMode: string; }
function ApplicationPageSkeleton({ viewMode }: ApplicationPageSkeletonProps) {
  if (viewMode === 'gantt') return <GanttSkeleton />;
  if (viewMode === 'list') return <ListSkeleton />;
  if (viewMode === 'kanban') return <KanbanSkeleton />;
  if (viewMode === 'calendar') return <CalendarSkeleton />;
  if (viewMode === 'table') return <TableSkeleton />;
  return <div className="space-y-4"><Skeleton className="h-64 w-full rounded-xl bg-white/5" /></div>;
}

function GanttSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-28 bg-white/5" />
        ))}
      </div>
      <div className="h-72 w-full rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-4 flex flex-col gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, r) => (
          <div key={r} className="flex items-center gap-2 w-full">
            <Skeleton className="h-3 w-16 bg-white/5" />
            <div className="flex-1 relative h-4">
              {Array.from({ length: Math.max(1, (r % 3) + 1) }).map((__, b) => (
                <span key={b} className="absolute top-0 h-4 rounded-full">
                  <Skeleton style={{ left: `${b * 18 + (r*7)%20}%`, width: `${20 + (r*13 + b*9)%35}%` }} className="h-4 bg-white/10" />
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
    <div className="border border-white/10 rounded-xl bg-black/30 overflow-hidden divide-y divide-white/5">
      {(['Pending','Applied','Interview','Offer','Rejected','Withdrawn']).map(col => (
        <div key={col} className="flex flex-col">
          <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-black/40 px-3 py-2 flex items-center gap-2">
            <Skeleton className="h-3 w-24 bg-white/10" />
          </div>
          <div className="p-3 grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg bg-white/10" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-3 w-40 bg-white/10" />
                  <Skeleton className="h-2 w-24 bg-white/10" />
                  <div className="flex gap-2">
                    <Skeleton className="h-2 w-14 bg-white/10" />
                    <Skeleton className="h-2 w-20 bg-white/10" />
                  </div>
                </div>
                <Skeleton className="h-5 w-10 rounded-full bg-white/10" />
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
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {(['Pending','Applied','Interview','Offer','Rejected','Withdrawn']).map(col => (
        <div key={col} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full bg-white/20" />
            <Skeleton className="h-3 w-20 bg-white/10" />
            <Skeleton className="h-4 w-8 rounded-full bg-white/10 ml-auto" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <Skeleton className="h-3 w-32 bg-white/10" />
                <Skeleton className="h-2 w-20 bg-white/10" />
                <div className="flex gap-2">
                  <Skeleton className="h-2 w-12 bg-white/10" />
                  <Skeleton className="h-2 w-14 bg-white/10" />
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
    <div className="border border-white/10 rounded-lg bg-black/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-40 bg-white/10" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-8 bg-white/10 rounded-md" />)}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md border border-white/10 bg-white/[0.02] p-1 flex flex-col gap-1">
            <Skeleton className="h-2 w-4 bg-white/10" />
            {i % 5 === 0 && <Skeleton className="h-2 w-10 bg-white/10" />}
            {i % 7 === 0 && <Skeleton className="h-2 w-8 bg-white/10" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="bg-white/5 px-4 py-3 flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-3 w-24 bg-white/10" />)}
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm">
            {Array.from({ length: 5 }).map((__, c) => <Skeleton key={c} className="h-3 w-full bg-white/10" />)}
          </div>
        ))}
      </div>
      <div className="p-2 text-[10px] text-white/30 flex justify-end border-t border-white/10">Loading…</div>
    </div>
  );
}

// --- Table View Component ---
interface ApplicationsTableProps {
  data: any[];
  onRowClick: (id: string) => void;
}

function ApplicationsTable({ data, onRowClick }: ApplicationsTableProps) {
  type ApplicationRow = typeof data[number];
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const tableRef = useState(() => ({ current: null as null | HTMLDivElement }))[0];

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
      if (e.key === 'Escape') setEditingStatusId(null);
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [editingStatusId]);
  // Pull update fn via hook avoidance: pass through window global? Simpler: reuse useApplications? Instead we rely on outer closure? We'll attach to (window as any) temporary if needed.
  // Since this component is defined inside the same file as ApplicationPage, it has access to nothing from parent.
  // We'll accept mutation through a custom event dispatched by parent for decoupling; simpler: we can attach updater on window in ApplicationPage before definition.
  // For brevity & low risk, we'll look for a global set by parent: (window as any).__apps_update.

  const columns = useMemo<ColumnDef<ApplicationRow, any>[]>(() => [
    {
      id: 'title',
      header: () => 'Position',
      accessorFn: row => row.job_title || '—',
      cell: info => (
        <div className="flex flex-col">
          <span className="truncate font-medium text-white/80 text-xs sm:text-sm">{info.getValue()}</span>
          {info.row.original.company && <span className="text-[10px] text-white/40 truncate">{info.row.original.company}</span>}
        </div>
      ),
    },
    {
      id: 'status',
      header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
      accessorKey: 'status',
      cell: info => {
        const row = info.row.original as ApplicationRow & { id: string };
        const value = info.getValue() as string;
        const isEditing = editingStatusId === row.id;
        const selectableStatuses: ApplicationStatus[] = ['Pending','Applied','Interview','Offer','Rejected','Withdrawn'];
        return (
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Prevent Enter / Space in dropdown from triggering row onKey handlers higher up
              if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            }}
          >
            {!isEditing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingStatusId(row.id); }}
                className="inline-flex items-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 focus:outline-none focus:ring-1 focus:ring-[#1dff00]/40"
              >{value}</button>
            )}
            {isEditing && (
              <div className="absolute z-30 top-0 left-0 min-w-[120px] rounded-md border border-white/15 bg-black/80 backdrop-blur p-2 shadow-lg flex flex-col gap-1">
                {selectableStatuses.map(s => (
                  <button
                    key={s}
                    disabled={busyId === row.id || s === value}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (s === value) { setEditingStatusId(null); return; }
                      try {
                        setBusyId(row.id);
                        const updater = (window as any).__apps_update as undefined | ((id: string, patch: any)=>Promise<any>);
                        if (updater) await updater(row.id, { status: s });
                      } finally {
                        setBusyId(null);
                        setEditingStatusId(null);
                      }
                    }}
                    className={`text-left text-[11px] px-2 py-1 rounded-md border border-transparent hover:border-white/10 hover:bg-white/5 ${s===value ? 'bg-[#1dff00]/20 text-[#1dff00] font-semibold' : 'text-white/70'}`}
                  >{s}</button>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingStatusId(null); }}
                  className="mt-1 w-full text-center text-[10px] text-white/40 hover:text-white/70"
                >Cancel</button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'applied',
      header: ({ column }) => <TableColumnHeader column={column} title="Applied" />,
      accessorFn: row => new Date(row.applied_date),
      cell: info => <span className="text-[11px] text-white/60">{(info.getValue<Date>()).toLocaleDateString()}</span>,
      sortingFn: (a,b,columnId) => (a.getValue<Date>(columnId).getTime() - b.getValue<Date>(columnId).getTime()),
    },
    {
      id: 'updated',
      header: ({ column }) => <TableColumnHeader column={column} title="Updated" />,
      accessorFn: row => new Date(row.updated_at || row.applied_date),
      cell: info => <span className="text-[11px] text-white/60">{(info.getValue<Date>()).toLocaleDateString()}</span>,
      sortingFn: (a,b,columnId) => (a.getValue<Date>(columnId).getTime() - b.getValue<Date>(columnId).getTime()),
    },
    {
      id: 'score',
      header: ({ column }) => <TableColumnHeader column={column} title="Score" />,
      accessorFn: row => row.match_score ?? 0,
      cell: info => <MatchScoreBadge score={info.getValue<number>()} />,
      sortingFn: (a,b,columnId) => (a.getValue<number>(columnId) - b.getValue<number>(columnId)),
    },
  ], [busyId, editingStatusId]);

  return (
    <div ref={(n)=> (tableRef.current = n)} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="overflow-auto">
        <TableProvider<ApplicationRow, any> data={data} columns={columns} className="min-w-full">
          <KTableHeader className="bg-white/5">
            {(headerGroup) => (
              <TableHeaderGroup headerGroup={headerGroup.headerGroup}>
                {({ header }) => (
                  <KTableHead header={header} className="text-white/60 text-[11px] uppercase tracking-wide" />
                )}
              </TableHeaderGroup>
            )}
          </KTableHeader>
          <KTableBody>
            {(row) => {
              const original = row.row.original as ApplicationRow & { id: string };
              return (
                <KTableRow row={row.row} className="cursor-pointer hover:bg-white/5" onClick={() => onRowClick(original.id)}>
                  {({ cell }) => (
                    <KTableCell cell={cell} />
                  )}
                </KTableRow>
              );
            }}
          </KTableBody>
        </TableProvider>
      </div>
      <div className="p-2 text-[10px] text-white/30 flex justify-end border-t border-white/10">
        {data.length} records
      </div>
    </div>
  );
}