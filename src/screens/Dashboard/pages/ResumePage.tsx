import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Download, 
  Edit, 
  Eye, 
  Plus, 
  Trash2, 
  Upload,
  FileText,
  Star,
  Copy,
  Share,
  MoreVertical,
  Search,
  Filter
} from "lucide-react";
import { motion } from "framer-motion";

interface Resume {
  id: string;
  name: string;
  template: string;
  lastModified: string;
  status: "Active" | "Draft" | "Archived";
  applications: number;
  thumbnail: string;
  isFavorite: boolean;
}

export const ResumePage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  const resumes: Resume[] = [
    {
      id: "1",
      name: "Software Engineer Resume",
      template: "Modern Professional",
      lastModified: "2 hours ago",
      status: "Active",
      applications: 15,
      thumbnail: "/api/placeholder/200/280",
      isFavorite: true
    },
    {
      id: "2",
      name: "Frontend Developer Resume",
      template: "Creative Design",
      lastModified: "1 day ago",
      status: "Draft",
      applications: 0,
      thumbnail: "/api/placeholder/200/280",
      isFavorite: false
    },
    {
      id: "3",
      name: "Full Stack Developer Resume",
      template: "Classic Format",
      lastModified: "3 days ago",
      status: "Active",
      applications: 8,
      thumbnail: "/api/placeholder/200/280",
      isFavorite: false
    },
    {
      id: "4",
      name: "Senior Developer Resume",
      template: "Executive Style",
      lastModified: "1 week ago",
      status: "Archived",
      applications: 23,
      thumbnail: "/api/placeholder/200/280",
      isFavorite: true
    }
  ];

  const templates = [
    { id: "1", name: "Modern Professional", category: "Professional" },
    { id: "2", name: "Creative Design", category: "Creative" },
    { id: "3", name: "Classic Format", category: "Traditional" },
    { id: "4", name: "Executive Style", category: "Executive" },
    { id: "5", name: "Minimalist", category: "Modern" },
    { id: "6", name: "Tech Focus", category: "Technical" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "text-green-400 bg-green-400/20";
      case "Draft":
        return "text-yellow-400 bg-yellow-400/20";
      case "Archived":
        return "text-gray-400 bg-gray-400/20";
      default:
        return "text-gray-400 bg-gray-400/20";
    }
  };

  const filteredResumes = resumes.filter(resume => {
    const matchesSearch = resume.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === "All" || resume.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Resume Management</h1>
          <p className="text-[#ffffff80]">Create, edit, and manage your professional resumes</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
            <Plus className="w-4 h-4 mr-2" />
            Create Resume
          </Button>
          <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
            <Input
              placeholder="Search resumes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]"
            />
          </div>
          
          <div className="flex space-x-2">
            {["All", "Active", "Draft", "Archived"].map((filter) => (
              <Button
                key={filter}
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFilter(filter)}
                className={`${
                  selectedFilter === filter
                    ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                    : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                }`}
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Resume Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredResumes.map((resume, index) => (
          <motion.div
            key={resume.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-4">
                {/* Resume Thumbnail */}
                <div className="relative mb-4">
                  <div className="w-full h-48 bg-[#ffffff1a] rounded-lg border border-[#ffffff33] flex items-center justify-center">
                    <FileText className="w-16 h-16 text-[#ffffff40]" />
                  </div>
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-2">
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Favorite Star */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`absolute top-2 right-2 ${
                      resume.isFavorite ? "text-yellow-400" : "text-[#ffffff60]"
                    } hover:text-yellow-400`}
                  >
                    <Star className="w-4 h-4" fill={resume.isFavorite ? "currentColor" : "none"} />
                  </Button>
                </div>

                {/* Resume Info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{resume.name}</h3>
                      <p className="text-sm text-[#ffffff80]">{resume.template}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(resume.status)}`}
                    >
                      {resume.status}
                    </span>
                    <span className="text-xs text-[#ffffff60]">{resume.applications} applications</span>
                  </div>
                  
                  <p className="text-xs text-[#ffffff60]">Modified {resume.lastModified}</p>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" className="flex-1 bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                      <Share className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Templates Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Resume Templates</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {templates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:shadow-lg transition-all duration-300 cursor-pointer group">
                <CardContent className="p-3">
                  <div className="w-full h-24 bg-[#ffffff1a] rounded border border-[#ffffff33] mb-3 flex items-center justify-center group-hover:bg-[#ffffff26] transition-colors">
                    <FileText className="w-8 h-8 text-[#ffffff60]" />
                  </div>
                  <h4 className="text-sm font-medium text-white truncate">{template.name}</h4>
                  <p className="text-xs text-[#ffffff60]">{template.category}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};