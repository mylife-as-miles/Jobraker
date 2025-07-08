import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
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
  Filter
} from "lucide-react";
import { motion } from "framer-motion";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  appliedDate: string;
  status: "Applied" | "Interview" | "Offer" | "Rejected" | "Withdrawn";
  salary: string;
  notes: string;
  nextStep: string;
  interviewDate?: string;
  logo: string;
}

export const ApplicationPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);

  const applications: Application[] = [
    {
      id: "1",
      jobTitle: "Senior Software Engineer",
      company: "Google",
      location: "Mountain View, CA",
      appliedDate: "2024-01-15",
      status: "Interview",
      salary: "$150,000 - $200,000",
      notes: "Technical interview scheduled for next week. Prepare system design questions.",
      nextStep: "Technical Interview - Jan 22, 2024",
      interviewDate: "2024-01-22",
      logo: "G"
    },
    {
      id: "2",
      jobTitle: "Frontend Developer",
      company: "Microsoft",
      location: "Seattle, WA",
      appliedDate: "2024-01-12",
      status: "Applied",
      salary: "$120,000 - $160,000",
      notes: "Application submitted through company website. Waiting for response.",
      nextStep: "Waiting for initial response",
      logo: "M"
    },
    {
      id: "3",
      jobTitle: "Full Stack Developer",
      company: "Meta",
      location: "Menlo Park, CA",
      appliedDate: "2024-01-10",
      status: "Offer",
      salary: "$130,000 - $180,000",
      notes: "Received offer! Need to respond by January 25th.",
      nextStep: "Respond to offer by Jan 25",
      logo: "F"
    },
    {
      id: "4",
      jobTitle: "iOS Developer",
      company: "Apple",
      location: "Cupertino, CA",
      appliedDate: "2024-01-08",
      status: "Rejected",
      salary: "$140,000 - $190,000",
      notes: "Position filled by internal candidate. Good feedback on technical skills.",
      nextStep: "Look for similar positions",
      logo: "A"
    },
    {
      id: "5",
      jobTitle: "Backend Engineer",
      company: "Netflix",
      location: "Los Gatos, CA",
      appliedDate: "2024-01-05",
      status: "Interview",
      salary: "$135,000 - $175,000",
      notes: "Phone screening completed. Waiting for technical round scheduling.",
      nextStep: "Technical round scheduling",
      logo: "N"
    }
  ];

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
    const matchesSearch = app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "All" || app.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: applications.length,
    applied: applications.filter(app => app.status === "Applied").length,
    interviews: applications.filter(app => app.status === "Interview").length,
    offers: applications.filter(app => app.status === "Offer").length,
    rejected: applications.filter(app => app.status === "Rejected").length
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
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Application
            </Button>
            <Button 
              variant="outline" 
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300 text-sm"
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
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-none hover:border-[#ffffff4d] transition-all duration-300"
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
                      : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                  }`}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Applications List */}
        <div className="space-y-4">
          {filteredApplications.map((application, index) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              onClick={() => setSelectedApplication(application.id)}
              whileHover={{ scale: 1.01, x: 4 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:shadow-lg hover:border-[#1dff00]/50 transition-all duration-300 cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
                        {application.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm sm:text-base lg:text-lg truncate">{application.jobTitle}</h3>
                        <p className="text-[#ffffff80] text-xs sm:text-sm">{application.company}</p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-[#ffffff60]">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{application.location}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(application.appliedDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center justify-between w-full sm:w-auto sm:flex-col sm:items-end gap-2">
                        <span className="text-[#1dff00] font-semibold text-sm sm:text-base">{application.salary}</span>
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(application.status)}`}>
                          {getStatusIcon(application.status)}
                          <span>{application.status}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
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
                    <p className="text-[#ffffff80] text-xs sm:text-sm leading-relaxed truncate">{application.nextStep}</p>
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
                            {app.logo}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-bold text-white">{app.jobTitle}</h2>
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
                          <p className="text-white mt-1">{new Date(app.appliedDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <label className="text-[#ffffff80] text-sm">Salary Range</label>
                          <p className="text-[#1dff00] font-medium mt-1">{app.salary}</p>
                        </div>
                        <div>
                          <label className="text-[#ffffff80] text-sm">Next Step</label>
                          <p className="text-white mt-1">{app.nextStep}</p>
                        </div>
                      </div>
                      
                      {/* Notes */}
                      <div>
                        <label className="text-[#ffffff80] text-sm">Notes</label>
                        <p className="text-white mt-1 leading-relaxed">{app.notes}</p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-[#ffffff1a]">
                        <Button 
                          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
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
      </div>
    </div>
  );
};