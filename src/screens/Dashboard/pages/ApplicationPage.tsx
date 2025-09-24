import { useMemo, useState } from "react";
import { useApplications, type ApplicationStatus } from "../../../hooks/useApplications";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast-provider";

import { LayoutGrid, List as ListIcon, Search, Columns, ExternalLink, Link2, Clipboard, AlertCircle, RefreshCw } from "lucide-react";
import { KanbanProvider, KanbanBoard, KanbanHeader, KanbanCards, KanbanCard } from "../../../components/ui/kibo-ui/kanban";

function ApplicationPage() {
  const { applications, exportCSV, update, refresh } = useApplications();
  const { error: toastError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | ApplicationStatus>("All");
  const [sortBy, setSortBy] = useState<"score" | "recent" | "company" | "status">("score");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "kanban">("grid");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = applications.filter((a) => {
      const matchesQ = !q || [a.job_title, a.company, a.location, a.status].some((v) => (v ?? "").toLowerCase().includes(q));
      const matchesStatus = selectedStatus === "All" || a.status === selectedStatus;
      return matchesQ && matchesStatus;
    });
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
        list = list.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
    }
    return list;
  }, [applications, searchQuery, selectedStatus, sortBy]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
          <span className="bg-gradient-to-r from-white to-[#1dff00] bg-clip-text text-transparent">Applications</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]"
            onClick={exportCSV}
            title="Export as CSV"
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]"
            onClick={() => refresh()}
            title="Refresh applications"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="bg-gradient-to-br from-white/[0.04] via-white/[0.06] to-white/[0.03] border border-white/[0.12] backdrop-blur-xl p-4 sm:p-6 rounded-xl shadow-[0_0_0_1px_rgba(29,255,0,0.05)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/[0.10] border-white/30 text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d]"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[170px] bg-white/[0.10] border-white/30 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-black text-white border-white/30">
                  <SelectItem value="score">Best match</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <div className="inline-flex rounded-lg border border-white/20 overflow-hidden">
                <button
                  className={`px-3 py-2 text-sm text-white/80 hover:text-white transition ${viewMode==='grid' ? 'bg-white/15' : ''}`}
                  title="Grid view"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/80 hover:text-white transition border-l border-white/15 ${viewMode==='list' ? 'bg-white/15' : ''}`}
                  title="List view"
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  className={`px-3 py-2 text-sm text-white/80 hover:text-white transition border-l border-white/15 ${viewMode==='kanban' ? 'bg-white/15' : ''}`}
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
                className={`m-1 text-xs sm:text-sm rounded-full ${selectedStatus===s ? 'bg-[#1dff00] text-black hover:bg-[#1dff00]/90' : 'text-white hover:text-white hover:bg-white/15'}`}
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
          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
            {filtered.map((a) => (
              <div key={a.id} className={viewMode === 'grid' ?
                "group bg-black/30 border border-white/15 rounded-xl p-4 hover:border-[#1dff00]/40 hover:shadow-[0_0_0_1px_rgba(29,255,0,0.15)] transition-all" :
                "group bg-black/30 border border-white/15 rounded-xl p-3 hover:border-[#1dff00]/40 hover:shadow-[0_0_0_1px_rgba(29,255,0,0.15)] transition-all"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    {a.logo || (a.company?.[0] ?? "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium truncate">{a.job_title}</div>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/70">
                        {a.status}
                      </span>
                    </div>
                    <div className="text-[#ffffff80] text-sm truncate">{a.company}</div>
                    <div className="flex items-center gap-2 text-xs text-[#ffffff60] mt-1">
                      <span>{new Date(a.applied_date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{a.location}</span>
                    </div>
                  </div>
                  <MatchScoreBadge score={a.match_score ?? 0} />
                </div>
                {a.app_url && (
                  <div className="mt-2">
                    <a href={a.app_url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-[#1dff00] hover:underline">
                      <ExternalLink className="w-3 h-3" /> Open application
                    </a>
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
                } catch (e) {
                  // useApplications.update already toasts and refreshes, but add a subtle note
                  toastError?.("Move failed", (e as any)?.message ?? "");
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
                          {a.provider_status && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 border border-[#ffffff22] text-[10px] text-[#ffffffa0]">
                              <span className={`h-1.5 w-1.5 rounded-full ${a.provider_status.match(/succeed|complete/i) ? 'bg-[#1dff00]' : a.provider_status.match(/fail|error|cancel/i) ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`} />
                              {a.provider_status}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {a.app_url && (
                            <a href={a.app_url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-[#1dff00] hover:underline">
                              <ExternalLink className="w-3 h-3" /> Open app
                            </a>
                          )}
                          {a.run_id && (
                            <button
                              className="text-xs inline-flex items-center gap-1 text-[#ffffff99] hover:text-white"
                              onClick={() => navigator.clipboard?.writeText(a.run_id!)}
                              title="Copy run id"
                            >
                              <Clipboard className="w-3 h-3" /> Run
                            </button>
                          )}
                          {a.recording_url && (
                            <a href={a.recording_url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-[#ffffff99] hover:text-white">
                              <Link2 className="w-3 h-3" /> Recording
                            </a>
                          )}
                          {a.failure_reason && (
                            <span className="ml-auto text-[10px] inline-flex items-center gap-1 text-[#ef4444]" title={a.failure_reason}>
                              <AlertCircle className="w-3 h-3" /> Failed
                            </span>
                          )}
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