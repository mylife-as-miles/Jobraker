import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Search, 
  MapPin, 
  Bookmark, 
  Clock, 
  Briefcase, 
  Share, 
  Heart, 
  MoreVertical,
  Filter,
  Star,
  Building2,
  DollarSign,
  Users
} from "lucide-react";
import { motion } from "framer-motion";
import MatchScoreBadge from "../../../components/jobs/MatchScoreBadge";
import MatchScoreBreakdown from "../../../components/jobs/MatchScoreBreakdown";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract" | "Remote";
  salary: string;
  postedDate: string;
  description: string;
  requirements: string[];
  benefits: string[];
  isBookmarked: boolean;
  isApplied: boolean;
  matchScore: number;
  logo: string;
  matchedSkills: string[];
  missingSkills: string[];
}

export const JobPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedJob, setSelectedJob] = useState<string | null>("1");

  const jobs: Job[] = [
    {
      id: "1",
      title: "Senior Software Engineer",
      company: "Google",
      location: "Mountain View, CA",
      type: "Full-time",
      salary: "$150,000 - $200,000",
      postedDate: "2 days ago",
      description: "We're looking for a Senior Software Engineer to join our team and help build the next generation of our products.",
      requirements: ["5+ years of experience", "React/TypeScript", "Node.js", "System Design"],
      benefits: ["Health Insurance", "401k", "Stock Options", "Remote Work"],
      isBookmarked: true,
      isApplied: false,
      matchScore: 95,
      logo: "G",
      matchedSkills: ["React/TypeScript", "Node.js", "System Design"],
      missingSkills: ["Kubernetes", "GCP"]
    },
    {
      id: "2",
      title: "Frontend Developer",
      company: "Microsoft",
      location: "Seattle, WA",
      type: "Full-time",
      salary: "$120,000 - $160,000",
      postedDate: "1 day ago",
      description: "Join our frontend team to create amazing user experiences for millions of users worldwide.",
      requirements: ["3+ years of experience", "React", "JavaScript", "CSS"],
      benefits: ["Health Insurance", "Flexible Hours", "Learning Budget"],
      isBookmarked: false,
      isApplied: true,
      matchScore: 88,
      logo: "M",
      matchedSkills: ["React", "JavaScript", "CSS"],
      missingSkills: ["Figma"]
    },
    {
      id: "3",
      title: "Full Stack Developer",
      company: "Meta",
      location: "Menlo Park, CA",
      type: "Remote",
      salary: "$130,000 - $180,000",
      postedDate: "3 days ago",
      description: "Build scalable applications that connect billions of people around the world.",
      requirements: ["4+ years of experience", "React", "Python", "GraphQL"],
      benefits: ["Health Insurance", "Stock Options", "Gym Membership"],
      isBookmarked: true,
      isApplied: false,
      matchScore: 92,
      logo: "F",
      matchedSkills: ["React", "Python", "GraphQL"],
      missingSkills: ["AWS"]
    },
    {
      id: "4",
      title: "iOS Developer",
      company: "Apple",
      location: "Cupertino, CA",
      type: "Full-time",
      salary: "$140,000 - $190,000",
      postedDate: "1 week ago",
      description: "Create innovative iOS applications that delight millions of users.",
      requirements: ["Swift", "iOS SDK", "3+ years experience", "App Store"],
      benefits: ["Health Insurance", "Employee Discounts", "Stock Purchase Plan"],
      isBookmarked: false,
      isApplied: false,
      matchScore: 78,
      logo: "A",
      matchedSkills: ["Swift", "iOS SDK"],
      missingSkills: ["SwiftUI", "Objective-C"]
    }
  ];

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !selectedLocation || job.location.toLowerCase().includes(selectedLocation.toLowerCase());
    const matchesType = selectedType === "All" || job.type === selectedType;
    return matchesSearch && matchesLocation && matchesType;
  });

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Job Search</h1>
              <p className="text-[#ffffff80] text-sm sm:text-base">Find your next opportunity</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <Button 
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Saved Jobs
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Search jobs, companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300"
              />
            </div>
            
            {/* Location Filter */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
              <Input
                placeholder="Location..."
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300"
              />
            </div>
            
            {/* Type Filter */}
            <div className="flex gap-1">
              {["All", "Full-time", "Remote"].map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={`text-xs flex-1 transition-all duration-300 hover:scale-105 ${
                    selectedType === type
                      ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                      : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                  }`}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Job List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Job List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                {filteredJobs.length} Jobs Found
              </h2>
              <div className="flex items-center space-x-2 text-sm text-[#ffffff80]">
                <span>Sort by:</span>
                <Button variant="ghost" size="sm" className="text-[#1dff00] hover:bg-[#1dff00]/10">
                  Relevance
                </Button>
              </div>
            </div>

            {filteredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                onClick={() => setSelectedJob(job.id)}
                className={`cursor-pointer transition-all duration-300 ${
                  selectedJob === job.id
                    ? "transform scale-[1.02]"
                    : "hover:transform hover:scale-[1.01]"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ x: 4 }}
              >
                <Card className={`bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border backdrop-blur-[25px] p-4 sm:p-6 transition-all duration-300 hover:shadow-lg ${
                  selectedJob === job.id
                    ? "border-[#1dff00] shadow-[0_0_20px_rgba(29,255,0,0.3)]"
                    : "border-[#ffffff15] hover:border-[#1dff00]/50"
                }`}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
                          {job.logo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-sm sm:text-base lg:text-lg truncate">{job.title}</h3>
                          <p className="text-[#ffffff80] text-xs sm:text-sm">{job.company}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 ${
                            job.isBookmarked ? "text-[#1dff00]" : ""
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${job.isBookmarked ? "fill-current" : ""}`} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-[#ffffff80]">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{job.postedDate}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Briefcase className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{job.type}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4 text-[#1dff00]" />
                          <span className="text-sm sm:text-base text-white font-semibold">{job.salary}</span>
                        </div>
                          <MatchScoreBadge score={job.matchScore} />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-[#ffffff1a] text-white text-xs rounded border border-[#ffffff33]">{job.type}</span>
                        {job.isApplied && (
                          <span className="px-2 py-1 bg-[#1dff0020] text-[#1dff00] text-xs rounded border border-[#1dff00]/30">Applied</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Job Details */}
          <div className="lg:sticky lg:top-6 lg:h-fit">
            {selectedJob ? (
              <>
                {(() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  if (!job) return null;
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {/* Job Header */}
                      <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 mb-6 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-xl flex-shrink-0">
                              {job.logo}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">{job.title}</h1>
                              <p className="text-lg text-[#ffffff80] mb-2">{job.company}</p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-[#ffffff60]">
                                <div className="flex items-center space-x-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{job.location}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-4 h-4" />
                                  <span>Posted {job.postedDate}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Briefcase className="w-4 h-4" />
                                  <span>{job.type}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#ffffff80] hover:text-white hover:scale-110 transition-all duration-300"
                            >
                              <Share className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#ffffff80] hover:text-white hover:scale-110 transition-all duration-300"
                            >
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <DollarSign className="w-5 h-5 text-[#1dff00]" />
                              <span className="text-xl font-bold text-white">{job.salary}</span>
                            </div>
                            <MatchScoreBadge score={job.matchScore} size="md" />
                          </div>
                          
                          <div className="flex items-center space-x-3 w-full sm:w-auto">
                            <Button 
                              variant="outline" 
                              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300 flex-1 sm:flex-none"
                            >
                              <Bookmark className="w-4 h-4 mr-2" />
                              Save Job
                            </Button>
                            <Button 
                              className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300 flex-1 sm:flex-none"
                            >
                              {job.isApplied ? "Applied" : "Apply Now"}
                            </Button>
                          </div>
                        </div>
                      </Card>

                      {/* Job Content */}
                      <div className="space-y-6">
                        <MatchScoreBreakdown matched={job.matchedSkills} missing={job.missingSkills} />

                        {/* Description */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg transition-all duration-300">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                            <Building2 className="w-5 h-5 mr-2 text-white" />
                            Job Description
                          </h3>
                          <p className="text-[#ffffff80] leading-relaxed">{job.description}</p>
                        </Card>
                        
                        {/* Requirements */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg transition-all duration-300">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                            <Star className="w-5 h-5 mr-2 text-white" />
                            Requirements
                          </h3>
                          <ul className="space-y-2">
                            {job.requirements.map((req, index) => (
                              <motion.li 
                                key={index} 
                                className="flex items-center space-x-2 text-[#ffffff80]"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full flex-shrink-0"></div>
                                <span>{req}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </Card>
                        
                        {/* Benefits */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg transition-all duration-300">
                          <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-white" />
                            Benefits
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {job.benefits.map((benefit, index) => (
                              <motion.div 
                                key={index} 
                                className="flex items-center space-x-2 text-[#ffffff80]"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full flex-shrink-0"></div>
                                <span>{benefit}</span>
                              </motion.div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </motion.div>
                  );
                })()}
              </>
            ) : (
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-8 text-center">
                <Briefcase className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Select a job</h3>
                <p className="text-[#ffffff60]">Choose a job from the list to view details</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};