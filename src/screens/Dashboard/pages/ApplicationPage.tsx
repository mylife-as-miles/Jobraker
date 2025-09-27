import { useEffect, useMemo, useState, useCallback } from "react";
import { useApplications, type ApplicationStatus } from "../../../hooks/useApplications";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

import { List as ListIcon, Search, Columns, ExternalLink, Link2, Clipboard, RefreshCw, GanttChart, Calendar as CalendarIcon, Table as TableIcon } from "lucide-react";
import { KanbanProvider, KanbanBoard, KanbanHeader, KanbanCards, KanbanCard } from "../../../components/ui/kibo-ui/kanban";
import { ListProvider, ListGroup, ListHeader, ListItems, ListItem, type DragEndEvent as ListDragEndEvent } from "../../../components/ui/kibo-ui/list";
import { TableProvider, TableHeader as KTableHeader, TableHeaderGroup, TableHead as KTableHead, TableColumnHeader, TableBody as KTableBody, TableRow as KTableRow, TableCell as KTableCell, type ColumnDef } from "../../../components/ui/kibo-ui/table";
import Gantt, { GanttItem } from "../../../components/ui/kibo-ui/gantt";
import KiboCalendar, { CalendarEvent } from "../../../components/ui/kibo-ui/calendar";
import CalendarDayDetail from "../../../components/ui/kibo-ui/CalendarDayDetail";
import Modal from "../../../components/ui/modal";

function ApplicationPage() {
  const { applications, exportCSV, update, refresh } = useApplications();

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

  // Clear selections when leaving calendar view to avoid stray overlay when returning
  useEffect(() => {
    if (viewMode !== 'calendar') { setSelectedDate(null); setSelectedRange(null); }
  }, [viewMode]);

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
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border-white/15 text-white placeholder:text-white/50 focus:border-white focus:ring-0"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[170px] bg-white/10 border-white/15 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-black text-white border-white/15">
                  <SelectItem value="score">Best match</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <div className="inline-flex rounded-lg border border-white/20 overflow-hidden bg-white/5 backdrop-blur-sm">
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
          <div className="flex flex-wrap gap-2 -m-1 items-center">
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

      {/* Content */}
      <Card className="bg-transparent border-none shadow-none">
        <CardContent className="p-0">
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
          {viewMode === 'gantt' ? (
            <div className="space-y-4">
              <div className="text-xs text-white/60 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#71717a] to-[#27272a]" /> Pending</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#1dff00] to-[#0a8246]" /> Applied</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#fbbf24] to-[#a16207]" /> Interview</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#84cc16] to-[#166534]" /> Offer</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#fb7185] to-[#881337]" /> Rejected</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-r from-[#94a3b8] to-[#334155]" /> Withdrawn</span>
              </div>
              <Gantt
                zoom={ganttZoom}
                onZoomChange={setGanttZoom}
                showToday
                groupBy={(item) => item.status}
                onBarClick={(item) => handleBarClick(item)}
                items={filtered.map<GanttItem>(a => {
                  const applied = new Date(a.applied_date);
                  const updated = new Date(a.updated_at || a.applied_date || Date.now());
                  // Active statuses extend to today optionally
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
                  // Ensure minimum visual length (add ~6h if same day)
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
          ) : viewMode === 'list' ? (
            <div className="border border-white/10 rounded-xl bg-black/30 overflow-hidden">
              <ListProvider
                onDragEnd={async (e: ListDragEndEvent) => {
                  const active = e.active?.data?.current as any;
                  const over = e.over?.id as string | undefined;
                  if (!active || !over || active.parent === over) return;
                  const appId = active.id as string;
                  // Move status to the group id (over)
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
          ) : viewMode === 'calendar' ? (
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
          ) : viewMode === 'table' ? (
            <ApplicationsTable
              data={filtered}
              onRowClick={(id) => setDetailId(id)}
            />
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
      <Modal open={!!detailApp} onClose={() => setDetailId(null)} title={detailApp?.job_title} side="right" size="lg">
        {detailApp ? (
          <div className="space-y-4 text-sm text-white/80">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Company</div>
                <div>{detailApp.company}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Status</div>
                <div>{detailApp.status}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Applied</div>
                <div>{new Date(detailApp.applied_date).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Updated</div>
                <div>{new Date(detailApp.updated_at).toLocaleString()}</div>
              </div>
              {detailApp.interview_date && (
                <div>
                  <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Interview</div>
                  <div>{new Date(detailApp.interview_date).toLocaleString()}</div>
                </div>
              )}
              {detailApp.salary && (
                <div>
                  <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Salary</div>
                  <div>{detailApp.salary}</div>
                </div>
              )}
            </div>
            {detailApp.notes && (
              <div>
                <div className="text-white/40 text-xs uppercase tracking-wide mb-1">Notes</div>
                <div className="whitespace-pre-wrap text-white/70 text-xs border border-white/10 rounded p-2 bg-white/5 max-h-60 overflow-auto">{detailApp.notes}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {detailApp.app_url && (
                <a href={detailApp.app_url} target="_blank" rel="noreferrer" className="text-[#1dff00] hover:underline text-xs">Open Application</a>
              )}
              {detailApp.recording_url && (
                <a href={detailApp.recording_url} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white text-xs">Recording</a>
              )}
              {detailApp.run_id && (
                <button
                  onClick={() => navigator.clipboard?.writeText(detailApp.run_id!)}
                  className="text-white/60 hover:text-white text-xs underline decoration-dotted"
                >Copy Run ID</button>
              )}
            </div>
            <div className="pt-4 flex gap-2">
              <Button size="sm" variant="outline" className="border-white/20" onClick={() => setDetailId(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default ApplicationPage;
export { ApplicationPage };

// --- Table View Component ---
interface ApplicationsTableProps {
  data: any[];
  onRowClick: (id: string) => void;
}

function ApplicationsTable({ data, onRowClick }: ApplicationsTableProps) {
  type ApplicationRow = typeof data[number];
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
      cell: info => <span className="text-[11px] font-medium text-white/70">{info.getValue() as string}</span>,
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
  ], []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
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