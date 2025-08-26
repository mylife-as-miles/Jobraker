import { useState } from "react";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Search, 
  Calendar, 
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Plus,
  Download,
  Share,
  Filter,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart";
import { motion } from "framer-motion";
import { useApplications, type ApplicationRecord, type ApplicationStatus } from "../../../hooks/useApplications";

export const ApplicationPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ id?: string; job_title: string; company: string; location: string; applied_date: string; status: ApplicationStatus; salary: string; notes: string; next_step: string; interview_date: string; logo: string }>({ job_title: "", company: "", location: "", applied_date: "", status: "Applied", salary: "", notes: "", next_step: "", interview_date: "", logo: "" });
  const { applications, loading, create, update, remove, exportCSV } = useApplications();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Applied":
        return "text-blue-400 bg-blue-400/20 border-blue-400/30";
      case "Interview":
        return "text-yellow-400 bg-yellow-400/20 border-yellow-400/30";
      case "Offer":
        return "text-green-400 bg-green-400/20 border-green-400/30";
      case "Rejected":
        return "text-red-400 bg-red-400/20 border-red-400/30";
      case "Withdrawn":
        return "text-gray-400 bg-gray-400/20 border-gray-400/30";
      default:
        return "text-gray-400 bg-gray-400/20 border-gray-400/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Applied":
        return <Clock className="w-3 h-3 sm:w-4 sm:h-4" />;
      case "Interview":
        return <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
      case "Offer":
        return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
      case "Rejected":
        return <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
      case "Withdrawn":
        return <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
      default:
        return <Clock className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "All" || app.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Sort by match score descending
  filteredApplications.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

  const stats = {
    total: applications.length,
    applied: applications.filter(app => app.status === "Applied").length,
    interviews: applications.filter(app => app.status === "Interview").length,
    offers: applications.filter(app => app.status === "Offer").length,
    rejected: applications.filter(app => app.status === "Rejected").length
  };

  // Chart data/config for the area chart section
  const chartData = [
    { month: "January", desktop: 186, mobile: 80 },
    { month: "February", desktop: 305, mobile: 200 },
    { month: "March", desktop: 237, mobile: 120 },
    { month: "April", desktop: 73, mobile: 190 },
    { month: "May", desktop: 209, mobile: 130 },
    { month: "June", desktop: 214, mobile: 140 },
  ];

  const chartConfig: ChartConfig = {
    desktop: { label: "Desktop", color: "var(--chart-1)" },
    mobile: { label: "Mobile", color: "var(--foreground)" },
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Application Tracker</h1>
            <p className="text-[#ffffff80] text-sm sm:text-base">Track and manage your job applications</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button 
              className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300 text-sm"
              onClick={() => {
                setFormData({ job_title: "", company: "", location: "", applied_date: new Date().toISOString().slice(0,10), status: "Applied", salary: "", notes: "", next_step: "", interview_date: "", logo: "" });
                setShowForm(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Application
            </Button>
            <Button 
              variant="outline" 
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300 text-sm"
              onClick={() => exportCSV()}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: "Total", value: stats.total, color: "text-white", bgColor: "from-[#ffffff08] to-[#ffffff05]" },
            { label: "Applied", value: stats.applied, color: "text-blue-400", bgColor: "from-blue-400/10 to-blue-400/5" },
            { label: "Interviews", value: stats.interviews, color: "text-yellow-400", bgColor: "from-yellow-400/10 to-yellow-400/5" },
            { label: "Offers", value: stats.offers, color: "text-green-400", bgColor: "from-green-400/10 to-green-400/5" },
            { label: "Rejected", value: stats.rejected, color: "text-red-400", bgColor: "from-red-400/10 to-red-400/5" }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="transition-transform duration-300"
            >
              <Card className={`bg-gradient-to-br ${stat.bgColor} border border-[#ffffff15] backdrop-blur-[25px] p-3 sm:p-4 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300`}>
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl lg:text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs sm:text-sm text-[#ffffff80]">{stat.label}</div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Chart: Split Line Area (hover reveal) */}
        <div className="mb-6 sm:mb-8">
          <SplitLineAreaChart chartData={chartData} chartConfig={chartConfig} />
        </div>

        {/* Search and Filters */}
        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300"
                />
              </div>
              <Button 
                variant="outline" 
                className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300 sm:w-auto"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {["All", "Applied", "Interview", "Offer", "Rejected"].map((status) => (
                <Button
                  key={status}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStatus(status)}
                  className={`text-xs sm:text-sm transition-all duration-300 hover:scale-105 ${
                    selectedStatus === status
                      ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                      : "text-white hover:text-white hover:bg-[#ffffff1a]"
                  }`}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Empty State */}
        {filteredApplications.length === 0 && !loading && (
          <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Plus className="w-6 h-6 text-[#1dff00]" />
              <h3 className="text-white text-lg font-semibold">No applications yet</h3>
              <p className="text-[#ffffff80] text-sm">Start tracking your job hunt by adding your first application.</p>
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add Application
              </Button>
            </div>
          </Card>
        )}

        {/* Applications List */}
        <div className="space-y-4">
          {filteredApplications.map((application: ApplicationRecord, index) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.01, x: 4 }}
              className="transition-transform duration-300"
              onClick={() => setSelectedApplication(application.id)}
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:shadow-lg hover:border-[#1dff00]/50 transition-all duration-300 cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
                        {application.logo || (application.company?.[0] ?? "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base lg:text-lg truncate">{application.job_title}</h3>
                        <p className="text-[#ffffff80] text-xs sm:text-sm">{application.company}</p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-[#ffffff60]">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{application.location}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(application.applied_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center justify-between w-full sm:w-auto sm:flex-col sm:items-end gap-2">
                        <div className="flex items-center gap-2">
                           <MatchScoreBadge score={application.match_score ?? 0} />
                           <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(application.status)}`}>
                            {getStatusIcon(application.status)}
                            <span>{application.status}</span>
                          </div>
                        </div>
                        <span className="text-[#1dff00] font-semibold text-sm sm:text-base">{application.salary ?? ""}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                          onClick={(e) => { e.stopPropagation(); setSelectedApplication(application.id); }}
                        >
                          <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                          onClick={(e) => { e.stopPropagation(); setFormData({ id: application.id, job_title: application.job_title, company: application.company, location: application.location, applied_date: application.applied_date.slice(0,10), status: application.status as ApplicationStatus, salary: application.salary ?? "", notes: application.notes ?? "", next_step: application.next_step ?? "", interview_date: application.interview_date ? application.interview_date.slice(0,10) : "", logo: application.logo ?? "" }); setShowForm(true); }}
                        >
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                          onClick={(e) => { e.stopPropagation(); remove(application.id); }}
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#ffffff1a]">
                    <p className="text-[#ffffff80] text-xs sm:text-sm leading-relaxed truncate">{application.next_step ?? ""}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Application Details Modal */}
        {selectedApplication && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedApplication(null)}
          >
            <Card
              className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-6">
                {(() => {
                  const app = applications.find(a => a.id === selectedApplication);
                  if (!app) return null;
                  
                  return (
                    <div className="space-y-6">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                          <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-xl flex-shrink-0">
                            {app.logo || (app.company?.[0] ?? "")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-bold text-white">{app.job_title}</h2>
                            <p className="text-[#ffffff80]">{app.company}</p>
                            <p className="text-[#ffffff60] text-sm">{app.location}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedApplication(null)}
                          className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 flex-shrink-0"
                        >
                          <XCircle className="w-5 h-5" />
                        </Button>
                      </div>
                      
                      {/* Status and Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[#ffffff80] text-sm">Status</label>
                          <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium mt-1 border ${getStatusColor(app.status)}`}>
                            {getStatusIcon(app.status)}
                            <span>{app.status}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[#ffffff80] text-sm">Applied Date</label>
                          <p className="text-white mt-1">{new Date(app.applied_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <label className="text-[#ffffff80] text-sm">Salary Range</label>
                          <p className="text-[#1dff00] font-medium mt-1">{app.salary ?? ""}</p>
                        </div>
                        <div>
                          <label className="text-[#ffffff80] text-sm">Next Step</label>
                          <p className="text-white mt-1">{app.next_step ?? ""}</p>
                        </div>
                      </div>
                      
                      {/* Notes */}
                      <div>
                        <label className="text-[#ffffff80] text-sm">Notes</label>
                        <p className="text-white mt-1 leading-relaxed">{app.notes ?? ""}</p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-[#ffffff1a]">
                        <Button 
                          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                          onClick={() => { setFormData({ id: app.id, job_title: app.job_title, company: app.company, location: app.location, applied_date: app.applied_date.slice(0,10), status: app.status as ApplicationStatus, salary: app.salary ?? "", notes: app.notes ?? "", next_step: app.next_step ?? "", interview_date: app.interview_date ? app.interview_date.slice(0,10) : "", logo: app.logo ?? "" }); setShowForm(true); setSelectedApplication(null); }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Application
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                        >
                          <Share className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:scale-105 transition-all duration-300"
                          onClick={() => { remove(app.id); setSelectedApplication(null); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Add/Edit Modal */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input placeholder="Job title" value={formData.job_title} onChange={(e) => setFormData((p) => ({ ...p, job_title: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Company" value={formData.company} onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Location" value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input type="date" placeholder="Applied date" value={formData.applied_date} onChange={(e) => setFormData((p) => ({ ...p, applied_date: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Status (Applied/Interview/Offer/Rejected/Withdrawn)" value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as ApplicationStatus }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Salary" value={formData.salary} onChange={(e) => setFormData((p) => ({ ...p, salary: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Next step" value={formData.next_step} onChange={(e) => setFormData((p) => ({ ...p, next_step: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input type="date" placeholder="Interview date" value={formData.interview_date} onChange={(e) => setFormData((p) => ({ ...p, interview_date: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Logo letter (optional)" value={formData.logo} onChange={(e) => setFormData((p) => ({ ...p, logo: e.target.value }))} className="bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                  <Input placeholder="Notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} className="sm:col-span-2 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60]" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90" onClick={async () => {
                    if (formData.id) {
                      await update(formData.id, {
                        job_title: formData.job_title,
                        company: formData.company,
                        location: formData.location,
                        applied_date: new Date(formData.applied_date).toISOString(),
                        status: formData.status,
                        salary: formData.salary || null,
                        notes: formData.notes || null,
                        next_step: formData.next_step || null,
                        interview_date: formData.interview_date ? new Date(formData.interview_date).toISOString() : null,
                        logo: formData.logo || null,
                      });
                    } else {
                      await create({
                        job_title: formData.job_title,
                        company: formData.company,
                        location: formData.location,
                        applied_date: new Date(formData.applied_date).toISOString(),
                        status: formData.status,
                        salary: formData.salary || undefined,
                        notes: formData.notes || undefined,
                        next_step: formData.next_step || undefined,
                        interview_date: formData.interview_date ? new Date(formData.interview_date).toISOString() : undefined,
                        logo: formData.logo || undefined,
                      });
                    }
                    setShowForm(false);
                  }}>{formData.id ? "Save" : "Add"}</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Inline SplitLineAreaChart component adapted to project imports/theme
function SplitLineAreaChart({ chartData, chartConfig }: { chartData: { month: string; desktop: number; mobile: number }[]; chartConfig: ChartConfig }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isInside, setIsInside] = useState(false);

  const splitOffset = hoverIndex != null ? (hoverIndex / (chartData.length - 1)) * 100 : 100;

  return (
    <div className="relative">
      {isInside && (
        <div
          className="pointer-events-none fixed z-50 w-24 h-24 rounded-full bg-yellow-600 opacity-60 blur-3xl"
          style={{ left: mousePos.x - 48, top: mousePos.y - 48 }}
        />
      )}

      <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px]">
        <CardHeader>
          <CardTitle>Area Chart</CardTitle>
          <CardDescription>Hover to reveal chart fill up to that point</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            data={chartData}
            config={chartConfig}
            onMouseMove={(e: React.MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })}
            onMouseEnter={() => setIsInside(true)}
            onMouseLeave={() => {
              setIsInside(false);
              setHoverIndex(null);
            }}
          >
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 12, right: 12, top: 12 }}
              onMouseMove={(state: any) => {
                if (state && state.activeTooltipIndex != null) setHoverIndex(state.activeTooltipIndex as number);
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) => value.slice(0, 3)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />

              <defs>
                <linearGradient id="fillMobile" x1="0" y1="0" x2="1" y2="0">
                  <motion.stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.8} />
                  <motion.stop
                    stopColor="var(--foreground)"
                    stopOpacity={0.8}
                    animate={{ offset: `${splitOffset}%` }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                  <motion.stop
                    stopColor="var(--foreground)"
                    stopOpacity={0.1}
                    animate={{ offset: `${splitOffset + 0.1}%` }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                  <stop offset="95%" stopColor="var(--background)" stopOpacity={0.1} />
                </linearGradient>
              </defs>

              <Area dataKey="mobile" type="natural" fill="url(#fillMobile)" stroke="url(#fillMobile)" fillOpacity={0.4} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">January - June 2024</div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}