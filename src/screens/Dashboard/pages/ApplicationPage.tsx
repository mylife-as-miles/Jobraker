import { useEffect, useMemo, useState } from "react";
import { useApplications, type ApplicationStatus } from "../../../hooks/useApplications";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

import { LayoutGrid, List as ListIcon, Search, Columns, ExternalLink, Link2, Clipboard, RefreshCw } from "lucide-react";
import { KanbanProvider, KanbanBoard, KanbanHeader, KanbanCards, KanbanCard } from "../../../components/ui/kibo-ui/kanban";

function ApplicationPage() {
  const { applications, exportCSV, update, refresh } = useApplications();

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

  return (
    <div className="space-y-8">
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
                  className={`px-3 py-2 text-sm text-white/70 hover:text-white transition ${viewMode==='grid' ? 'bg-white/20 text-white' : ''}`}
                  title="Grid view"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
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
                className={`m-1 text-xs sm:text-sm rounded-full ${selectedStatus===s ? 'bg-white text-black' : 'text-white hover:bg-white/10'} transition`}
              >
                {s}
              </Button>
            ))}
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
          {viewMode !== 'kanban' ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" : "space-y-4"}>
            {filtered.map((a) => (
              <div key={a.id} className={viewMode === 'grid' ?
                "bg-white/[0.05] border border-white/10 rounded-xl p-4 hover:bg-white/[0.08] transition" :
                "bg-white/[0.05] border border-white/10 rounded-xl p-3 hover:bg-white/[0.08] transition"}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    {(a.logo && a.logo.length > 1 ? a.logo : (((a.company || a.job_title || "")
                      .toString()
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w: string) => w[0] || "")
                      .join("") || "").toUpperCase()))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium truncate">{a.job_title}</div>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border border-white/15 bg-white/10 text-white/70">
                        {a.status}
                      </span>
                    </div>
                    <div className="text-white/80 text-sm truncate">{a.company}</div>
                    <div className="flex items-center gap-2 text-[11px] text-white/50 mt-1">
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
                        className="inline-flex items-center gap-1 text-white/70 hover:text-white"
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
                        className="text-xs inline-flex items-center gap-1 text-white/70 hover:text-white"
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