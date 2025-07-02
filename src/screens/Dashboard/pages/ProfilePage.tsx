import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { motion } from "framer-motion";
import { Edit, Mail, Phone, MapPin, Plus, ExternalLink, Calendar, Trash2, Award } from "lucide-react";

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
  const [activeTab] = useState("overview");

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