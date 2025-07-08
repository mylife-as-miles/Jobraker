import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { Edit, Mail, Phone, MapPin, Plus, ExternalLink, Calendar, Trash2, Award, Building2, GraduationCap, Briefcase } from "lucide-react";

interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

interface Education {
  id: string;
  degree: string;
  school: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa?: string;
}

interface Skill {
  id: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  category: string;
}

const ProfilePage = (): JSX.Element => {
  const [activeTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);

  const profileData = {
    firstName: "Udochukwu",
    lastName: "Chimbo",
    title: "Senior Software Engineer",
    location: "San Francisco, CA",
    email: "chimbouda@gmail.com",
    phone: "+1 (555) 123-4567",
    bio: "Passionate software engineer with 5+ years of experience building scalable web applications. Expertise in React, Node.js, and cloud technologies. Always eager to learn new technologies and solve complex problems.",
    website: "https://udochimbo.dev",
    linkedin: "https://linkedin.com/in/udochimbo",
    github: "https://github.com/udochimbo"
  };

  const experiences: Experience[] = [
    {
      id: "1",
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      location: "San Francisco, CA",
      startDate: "2022-01",
      endDate: "",
      current: true,
      description: "Lead development of microservices architecture serving 1M+ users. Mentored junior developers and improved system performance by 40%."
    },
    {
      id: "2",
      title: "Software Engineer",
      company: "StartupXYZ",
      location: "Remote",
      startDate: "2020-03",
      endDate: "2021-12",
      current: false,
      description: "Built full-stack web applications using React and Node.js. Implemented CI/CD pipelines and reduced deployment time by 60%."
    }
  ];

  const education: Education[] = [
    {
      id: "1",
      degree: "Bachelor of Science in Computer Science",
      school: "University of California, Berkeley",
      location: "Berkeley, CA",
      startDate: "2016-08",
      endDate: "2020-05",
      gpa: "3.8"
    }
  ];

  const skills: Skill[] = [
    { id: "1", name: "JavaScript", level: "Expert", category: "Programming" },
    { id: "2", name: "React", level: "Expert", category: "Frontend" },
    { id: "3", name: "Node.js", level: "Advanced", category: "Backend" },
    { id: "4", name: "TypeScript", level: "Advanced", category: "Programming" },
    { id: "5", name: "Python", level: "Intermediate", category: "Programming" },
    { id: "6", name: "AWS", level: "Intermediate", category: "Cloud" },
    { id: "7", name: "Docker", level: "Intermediate", category: "DevOps" },
    { id: "8", name: "GraphQL", level: "Advanced", category: "Backend" }
  ];

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case "Expert":
        return "bg-green-500";
      case "Advanced":
        return "bg-blue-500";
      case "Intermediate":
        return "bg-yellow-500";
      case "Beginner":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSkillLevelWidth = (level: string) => {
    switch (level) {
      case "Expert":
        return "w-full";
      case "Advanced":
        return "w-3/4";
      case "Intermediate":
        return "w-1/2";
      case "Beginner":
        return "w-1/4";
      default:
        return "w-1/4";
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Profile Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="text-center">
                  <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center text-black font-bold text-2xl">
                      UC
                    </div>
                    <Button
                      size="sm"
                      className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-110 transition-all duration-300 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <h2 className="text-xl font-bold text-white mb-1">
                    {profileData.firstName} {profileData.lastName}
                  </h2>
                  <p className="text-[#ffffff80] mb-2">{profileData.title}</p>
                  <p className="text-[#ffffff60] text-sm mb-4 flex items-center justify-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {profileData.location}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-center text-[#ffffff80] hover:text-white transition-colors duration-300">
                      <Mail className="w-4 h-4 mr-2" />
                      <span>{profileData.email}</span>
                    </div>
                    <div className="flex items-center justify-center text-[#ffffff80] hover:text-white transition-colors duration-300">
                      <Phone className="w-4 h-4 mr-2" />
                      <span>{profileData.phone}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center space-x-2 mt-4">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      LinkedIn
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      GitHub
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#ffffff80]">Applications</span>
                    <span className="text-[#1dff00] font-semibold">47</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#ffffff80]">Interviews</span>
                    <span className="text-[#1dff00] font-semibold">12</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#ffffff80]">Offers</span>
                    <span className="text-[#1dff00] font-semibold">3</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#ffffff80]">Success Rate</span>
                    <span className="text-[#1dff00] font-semibold">89%</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Profile Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">About</h3>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a] hover:scale-110 transition-all duration-300"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                {isEditing ? (
                  <div className="space-y-4">
                    <textarea
                      className="w-full p-3 bg-[#ffffff1a] border border-[#ffffff33] rounded-lg text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] transition-all duration-300 resize-none"
                      rows={4}
                      defaultValue={profileData.bio}
                    />
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                        onClick={() => setIsEditing(false)}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:scale-105 transition-all duration-300"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#ffffff80] leading-relaxed">{profileData.bio}</p>
                )}
              </Card>
            </motion.div>

            {/* Experience Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-white" />
                    Experience
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-4">
                  {experiences.map((exp, index) => (
                    <motion.div
                      key={exp.id}
                      className="border-l-2 border-[#1dff00] pl-4 pb-4 relative hover:bg-[#ffffff0a] p-3 rounded-r-lg transition-all duration-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <div className="absolute -left-2 top-3 w-4 h-4 bg-[#1dff00] rounded-full"></div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{exp.title}</h4>
                          <p className="text-white font-medium">{exp.company}</p>
                          <p className="text-[#ffffff60] text-sm flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {exp.location}
                          </p>
                          <p className="text-[#ffffff60] text-sm flex items-center mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                          </p>
                          <p className="text-[#ffffff80] text-sm mt-2 leading-relaxed">{exp.description}</p>
                        </div>
                        <div className="flex space-x-1 ml-4">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 p-1"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-[#ffffff60] hover:text-red-400 hover:scale-110 transition-all duration-300 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Education Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-white" />
                    Education
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-4">
                  {education.map((edu, index) => (
                    <motion.div
                      key={edu.id}
                      className="border-l-2 border-[#1dff00] pl-4 pb-4 relative hover:bg-[#ffffff0a] p-3 rounded-r-lg transition-all duration-300"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ x: 4 }}
                    >
                      <div className="absolute -left-2 top-3 w-4 h-4 bg-[#1dff00] rounded-full"></div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{edu.degree}</h4>
                          <p className="text-white font-medium">{edu.school}</p>
                          <p className="text-[#ffffff60] text-sm flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {edu.location}
                          </p>
                          <p className="text-[#ffffff60] text-sm flex items-center mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {edu.startDate} - {edu.endDate}
                          </p>
                          {edu.gpa && (
                            <p className="text-[#ffffff80] text-sm mt-1">GPA: {edu.gpa}</p>
                          )}
                        </div>
                        <div className="flex space-x-1 ml-4">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 p-1"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-[#ffffff60] hover:text-red-400 hover:scale-110 transition-all duration-300 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Skills Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              whileHover={{ scale: 1.01 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 hover:shadow-lg hover:border-[#1dff00]/30 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Award className="w-5 h-5 mr-2 text-white" />
                    Skills
                  </h3>
                  <Button 
                    size="sm" 
                    className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skills.map((skill, index) => (
                    <motion.div
                      key={skill.id}
                      className="space-y-2 p-3 bg-[#ffffff0a] rounded-lg hover:bg-[#ffffff15] transition-all duration-300"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">{skill.name}</span>
                        <span className="text-[#ffffff60] text-xs">{skill.level}</span>
                      </div>
                      <div className="w-full bg-[#ffffff20] rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${getSkillLevelColor(skill.level)} ${getSkillLevelWidth(skill.level)}`}
                        ></div>
                      </div>
                      <span className="text-[#ffffff60] text-xs">{skill.category}</span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;