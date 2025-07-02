import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
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
  Share
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
        return "text-blue-400 bg-blue-400/20";
      case "Interview":
        return "text-yellow-400 bg-yellow-400/20";
      case "Offer":
        return "text-green-400 bg-green-400/20";
      case "Rejected":
        return "text-red-400 bg-red-400/20";
      case "Withdrawn":
        return "text-gray-400 bg-gray-400/20";
      default:
        return "text-gray-400 bg-gray-400/20";
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
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Responsive application layout */}
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Application Tracker</h1>
              <p className="text-sm sm:text-base text-[#ffffff80]">Track and manage your job applications</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 text-sm">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Add Application
              </Button>
              <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] text-sm">
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { label: "Total", value: stats.total, color: "text-white" },
              { label: "Applied", value: stats.applied, color: "text-blue-400" },
              { label: "Interviews", value: stats.interviews, color: "text-yellow-400" },
              { label: "Offers", value: stats.offers, color: "text-green-400" },
              { label: "Rejected", value: stats.rejected, color: "text-red-400" }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-3 sm:p-4">
                  <div className="text-center">
                    <div className={`text-xl sm:text-2xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs sm:text-sm text-[#ffffff80]">{stat.label}</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Search and Filters */}
          <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] text-sm"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {["All", "Applied", "Interview", "Offer", "Rejected"].map((status) => (
                  <Button
                    key={status}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStatus(status)}
                    className={`text-xs sm:text-sm ${
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

          {/* Applications Table/Cards */}
          <div className="space-y-3 sm:space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px]">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#ffffff1a]">
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Job & Company</th>
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Location</th>
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Applied Date</th>
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Status</th>
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Salary</th>
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Next Step</th>
                          <th className="text-left p-4 text-[#ffffff80] font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApplications.map((application, index) => (
                          <motion.tr
                            key={application.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            className="border-b border-[#ffffff0d] hover:bg-[#ffffff0a] transition-colors cursor-pointer"
                            onClick={() => setSelectedApplication(application.id)}
                          >
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center text-black font-bold text-sm">
                                  {application.logo}
                                </div>
                                <div>
                                  <div className="text-white font-medium text-sm">{application.jobTitle}</div>
                                  <div className="text-xs text-[#ffffff80]">{application.company}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-1 text-[#ffffff80]">
                                <MapPin className="w-3 h-3" />
                                <span className="text-xs">{application.location}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-1 text-[#ffffff80]">
                                <Calendar className="w-3 h-3" />
                                <span className="text-xs">{new Date(application.appliedDate).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                                {getStatusIcon(application.status)}
                                <span>{application.status}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-xs text-[#1dff00] font-medium">{application.salary}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-xs text-[#ffffff80]">{application.nextStep}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-1">
                                <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white p-1">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white p-1">
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white p-1">
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-3">
              {filteredApplications.map((application, index) => (
                <motion.div
                  key={application.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  onClick={() => setSelectedApplication(application.id)}
                >
                  <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:shadow-lg transition-all duration-300 cursor-pointer">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                            {application.logo}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-white font-medium text-sm sm:text-base truncate">{application.jobTitle}</h3>
                            <p className="text-xs sm:text-sm text-[#ffffff80]">{application.company}</p>
                          </div>
                        </div>
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)} flex-shrink-0`}>
                          {getStatusIcon(application.status)}
                          <span className="hidden sm:inline">{application.status}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 text-[#ffffff80]">
                            <MapPin className="w-3 h-3" />
                            <span>{application.location}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[#ffffff80]">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(application.appliedDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[#1dff00] font-medium">{application.salary}</span>
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white p-1">
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white p-1">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white p-1">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-[#ffffff80] truncate">{application.nextStep}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Application Details Modal */}
          {selectedApplication && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
              onClick={() => setSelectedApplication(null)}
            >
              <Card 
                className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <CardContent className="p-4 sm:p-6">
                  {(() => {
                    const app = applications.find(a => a.id === selectedApplication);
                    if (!app) return null;
                    
                    return (
                      <div className="space-y-4 sm:space-y-6">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg sm:text-xl flex-shrink-0">
                              {app.logo}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h2 className="text-lg sm:text-xl font-bold text-white">{app.jobTitle}</h2>
                              <p className="text-sm sm:text-base text-[#ffffff80]">{app.company}</p>
                              <p className="text-xs sm:text-sm text-[#ffffff60]">{app.location}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedApplication(null)}
                            className="text-[#ffffff60] hover:text-white p-1 sm:p-2 flex-shrink-0"
                          >
                            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                        </div>
                        
                        {/* Status and Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label className="text-xs sm:text-sm text-[#ffffff80]">Status</label>
                            <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium mt-1 ${getStatusColor(app.status)}`}>
                              {getStatusIcon(app.status)}
                              <span>{app.status}</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs sm:text-sm text-[#ffffff80]">Applied Date</label>
                            <p className="text-white mt-1 text-sm sm:text-base">{new Date(app.appliedDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <label className="text-xs sm:text-sm text-[#ffffff80]">Salary Range</label>
                            <p className="text-[#1dff00] font-medium mt-1 text-sm sm:text-base">{app.salary}</p>
                          </div>
                          <div>
                            <label className="text-xs sm:text-sm text-[#ffffff80]">Next Step</label>
                            <p className="text-white mt-1 text-sm sm:text-base">{app.nextStep}</p>
                          </div>
                        </div>
                        
                        {/* Notes */}
                        <div>
                          <label className="text-xs sm:text-sm text-[#ffffff80]">Notes</label>
                          <p className="text-white mt-1 leading-relaxed text-sm sm:text-base">{app.notes}</p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-4 border-t border-[#ffffff1a]">
                          <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 text-sm">
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                            Edit Application
                          </Button>
                          <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] text-sm">
                            <Share className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                            Share
                          </Button>
                          <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm">
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
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
    </div>
  );
};