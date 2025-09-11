import { useMemo, useState } from "react";
import { useApplications, type ApplicationStatus } from "../../../hooks/useApplications";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast-provider";

import { Filter, LayoutGrid, List as ListIcon, Plus, Search } from "lucide-react";

function ApplicationPage() {
  const { applications, exportCSV } = useApplications();
  const { info } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"All" | ApplicationStatus>("All");
  const [sortBy, setSortBy] = useState<"score" | "recent" | "company" | "status">("score");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
        list = list.sort((a, b) => a.company.localeCompare(b.company));
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
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Applications</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={exportCSV}>
            Export CSV
          </Button>
          <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={() => info("Coming soon") }>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d]"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[160px] bg-[#ffffff1a] border-[#ffffff33] text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-black text-white border-[#ffffff33]">
                  <SelectItem value="score">Best match</SelectItem>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className={`border-[#ffffff33] text-white hover:bg-[#ffffff1a] ${viewMode==='grid' ? 'bg-[#ffffff1a]' : ''}`}
                title="Grid view"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className={`border-[#ffffff33] text-white hover:bg-[#ffffff1a] ${viewMode==='list' ? 'bg-[#ffffff1a]' : ''}`}
                title="List view"
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
              {/* Kanban view removed */}
              <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                <Filter className="w-4 h-4 mr-2" /> Filters
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 -m-1">
            {(["All", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStatus(s)}
                className={`m-1 text-xs sm:text-sm ${selectedStatus===s ? 'bg-[#1dff00] text-black hover:bg-[#1dff00]/90' : 'text-white hover:text-white hover:bg-[#ffffff1a]'}`}
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
          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
            {filtered.map((a) => (
              <div key={a.id} className={viewMode === 'grid' ?
                "group bg-black/30 border border-[#ffffff12] rounded-xl p-4 hover:border-[#1dff00]/40 transition-all" :
                "group bg-black/30 border border-[#ffffff12] rounded-xl p-3 hover:border-[#1dff00]/40 transition-all"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    {a.logo || (a.company?.[0] ?? "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium truncate">{a.job_title}</div>
                    <div className="text-[#ffffff80] text-sm truncate">{a.company}</div>
                    <div className="flex items-center gap-2 text-xs text-[#ffffff60] mt-1">
                      <span>{new Date(a.applied_date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{a.location}</span>
                    </div>
                  </div>
                  <MatchScoreBadge score={a.match_score ?? 0} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ApplicationPage;
export { ApplicationPage };