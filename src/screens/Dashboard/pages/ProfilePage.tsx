import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Briefcase,
  GraduationCap,
  Award,
  Star,
  Edit,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Share,
  Settings,
  Camera
} from "lucide-react";
import { motion } from "framer-motion";

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

export const ProfilePage = (): JSX.Element => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

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

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "experience", label: "Experience" },
    { id: "education", label: "Education" },
    { id: "skills", label: "Skills" }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            {/* Bio */}
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">About</h3>
                  <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[#ffffff80] leading-relaxed">{profileData.bio}</p>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Contact Information</h3>
                  <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-[#ffffff60]" />
                    <span className="text-[#ffffff80]">{profileData.email}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-[#ffffff60]" />
                    <span className="text-[#ffffff80]">{profileData.phone}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-4 h-4 text-[#ffffff60]" />
                    <span className="text-[#ffffff80]">{profileData.location}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Links */}
            <Card className="bg-[#ffffff1a] border-[#ffffff33]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Links</h3>
                  <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ExternalLink className="w-4 h-4 text-[#ffffff60]" />
                      <span className="text-[#ffffff80]">Portfolio</span>
                    </div>
                    <a href={profileData.website} className="text-[#1dff00] hover:text-[#1dff00]/80 text-sm">
                      {profileData.website}
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ExternalLink className="w-4 h-4 text-[#ffffff60]" />
                      <span className="text-[#ffffff80]">LinkedIn</span>
                    </div>
                    <a href={profileData.linkedin} className="text-[#1dff00] hover:text-[#1dff00]/80 text-sm">
                      {profileData.linkedin}
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ExternalLink className="w-4 h-4 text-[#ffffff60]" />
                      <span className="text-[#ffffff80]">GitHub</span>
                    </div>
                    <a href={profileData.github} className="text-[#1dff00] hover:text-[#1dff00]/80 text-sm">
                      {profileData.github}
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "experience":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Work Experience</h3>
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Experience
              </Button>
            </div>
            
            {experiences.map((exp, index) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="bg-[#ffffff1a] border-[#ffffff33]">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-white font-medium text-lg">{exp.title}</h4>
                        <p className="text-[#1dff00] font-medium">{exp.company}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-[#ffffff80]">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{exp.location}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-[#ffffff80] leading-relaxed">{exp.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        );

      case "education":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Education</h3>
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Education
              </Button>
            </div>
            
            {education.map((edu, index) => (
              <motion.div
                key={edu.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="bg-[#ffffff1a] border-[#ffffff33]">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-white font-medium text-lg">{edu.degree}</h4>
                        <p className="text-[#1dff00] font-medium">{edu.school}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-[#ffffff80]">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{edu.location}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{edu.startDate} - {edu.endDate}</span>
                          </div>
                          {edu.gpa && (
                            <div className="flex items-center space-x-1">
                              <Award className="w-3 h-3" />
                              <span>GPA: {edu.gpa}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        );

      case "skills":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Skills</h3>
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Skill
              </Button>
            </div>
            
            {/* Skills by Category */}
            {["Programming", "Frontend", "Backend", "Cloud", "DevOps"].map((category) => {
              const categorySkills = skills.filter(skill => skill.category === category);
              if (categorySkills.length === 0) return null;
              
              return (
                <Card key={category} className="bg-[#ffffff1a] border-[#ffffff33]">
                  <CardContent className="p-6">
                    <h4 className="text-white font-medium mb-4">{category}</h4>
                    <div className="space-y-4">
                      {categorySkills.map((skill, index) => (
                        <motion.div
                          key={skill.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[#ffffff80] font-medium">{skill.name}</span>
                              <span className="text-xs text-[#ffffff60]">{skill.level}</span>
                            </div>
                            <div className="w-full bg-[#ffffff1a] rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${getSkillLevelColor(skill.level)} ${getSkillLevelWidth(skill.level)}`}
                              ></div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[#ffffff60] hover:text-white">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Responsive profile layout */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Profile Sidebar */}
          <div className="w-full md:w-1/3 space-y-3">
            {/* ...existing sidebar rendering... */}
          </div>
          {/* Profile Main Content */}
          <div className="w-full md:w-2/3 space-y-3">
            {/* ...existing main content rendering... */}
          </div>
        </div>
      </div>
    </div>
  );
};