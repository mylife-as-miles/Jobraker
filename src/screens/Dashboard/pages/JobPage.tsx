import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { motion } from "framer-motion";

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
}

export const JobPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

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
      logo: "G"
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
      logo: "M"
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
      logo: "F"
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
      logo: "A"
    }
  ];

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400 bg-green-400/20";
    if (score >= 75) return "text-yellow-400 bg-yellow-400/20";
    return "text-red-400 bg-red-400/20";
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !selectedLocation || job.location.toLowerCase().includes(selectedLocation.toLowerCase());
    const matchesType = selectedType === "All" || job.type === selectedType;
    return matchesSearch && matchesLocation && matchesType;
  });

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Example: Job List and Details - wrap in responsive flex/grid */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Job List */}
          <div className="w-full md:w-1/2 space-y-3">
            {/* Search Header */}
            <div className="p-4 border-b border-[#ffffff1a] space-y-4">
              <h2 className="text-xl font-bold text-white">Job Search</h2>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]"
                />
              </div>
              
              {/* Location Filter */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Location..."
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00]"
                />
              </div>
              
              {/* Type Filter */}
              <div className="flex space-x-2">
                {["All", "Full-time", "Part-time", "Contract", "Remote"].map((type) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedType(type)}
                    className={`text-xs ${
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

            {/* Job List */}
            <div className="flex-1 overflow-y-auto">
              {filteredJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  onClick={() => setSelectedJob(job.id)}
                  className={`p-4 border-b border-[#ffffff0d] cursor-pointer transition-all duration-200 ${
                    selectedJob === job.id
                      ? "bg-[#1dff0015] border-r-2 border-r-[#1dff00]"
                      : "hover:bg-[#ffffff0a]"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ x: 4 }}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center text-black font-bold">
                          {job.logo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">{job.title}</h3>
                          <p className="text-sm text-[#ffffff80]">{job.company}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                          <Bookmark className={`w-4 h-4 ${job.isBookmarked ? "fill-current text-[#1dff00]" : ""}`} />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-4 text-sm text-[#ffffff80]">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{job.postedDate}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#1dff00] font-medium">{job.salary}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMatchScoreColor(job.matchScore)}`}>
                          {job.matchScore}% match
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-[#ffffff1a] text-white text-xs rounded">{job.type}</span>
                        {job.isApplied && (
                          <span className="px-2 py-1 bg-[#1dff0020] text-[#1dff00] text-xs rounded">Applied</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Job Details */}
          <div className="w-full md:w-1/2 space-y-3">
            {selectedJob ? (
              <>
                {(() => {
                  const job = jobs.find(j => j.id === selectedJob);
                  if (!job) return null;
                  
                  return (
                    <>
                      {/* Job Header */}
                      <div className="p-6 border-b border-[#ffffff1a] bg-[#0a0a0a]">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center text-black font-bold text-xl">
                              {job.logo}
                            </div>
                            <div>
                              <h1 className="text-2xl font-bold text-white mb-1">{job.title}</h1>
                              <p className="text-lg text-[#ffffff80]">{job.company}</p>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-[#ffffff60]">
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
                          
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white">
                              <Share className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white">
                              <Heart className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-xl font-bold text-[#1dff00]">{job.salary}</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(job.matchScore)}`}>
                              {job.matchScore}% match
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Button variant="outline" className="border-[#ffffff33] text-white hover:bg-[#ffffff1a]">
                              <Bookmark className="w-4 h-4 mr-2" />
                              Save Job
                            </Button>
                            <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                              {job.isApplied ? "Applied" : "Apply Now"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Job Content */}
                      <div className="flex-1 overflow-y-auto p-6 bg-black space-y-6">
                        {/* Description */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6">
                          <h3 className="text-lg font-bold text-white mb-3">Job Description</h3>
                          <p className="text-[#ffffff80] leading-relaxed">{job.description}</p>
                        </Card>
                        
                        {/* Requirements */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6">
                          <h3 className="text-lg font-bold text-white mb-3">Requirements</h3>
                          <ul className="space-y-2">
                            {job.requirements.map((req, index) => (
                              <li key={index} className="flex items-center space-x-2 text-[#ffffff80]">
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full"></div>
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                        
                        {/* Benefits */}
                        <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6">
                          <h3 className="text-lg font-bold text-white mb-3">Benefits</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {job.benefits.map((benefit, index) => (
                              <div key={index} className="flex items-center space-x-2 text-[#ffffff80]">
                                <div className="w-1.5 h-1.5 bg-[#1dff00] rounded-full"></div>
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-black">
                <div className="text-center">
                  <Briefcase className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">Select a job</h3>
                  <p className="text-[#ffffff60]">Choose a job from the list to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};