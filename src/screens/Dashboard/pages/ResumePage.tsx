import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Download, Edit, Eye, Plus } from "lucide-react";
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
  const resumes: Resume[] = [
    {
      id: "1",
      name: "E-commerce Resume",
      template: "Modern Professional",
      lastModified: "2 hours ago",
      status: "Active",
      applications: 15,
      thumbnail: "/api/placeholder/200/280",
      isFavorite: true
    },
    {
      id: "2",
      name: "Technology Resume",
      template: "Creative Design",
      lastModified: "1 day ago",
      status: "Draft",
      applications: 0,
      thumbnail: "/api/placeholder/200/280",
      isFavorite: false
    }
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white">Resume builder</h1>
          <p className="text-[#ffffff80] max-w-2xl">
            Upload your resume to get a tailored resume that increases your chances of getting hired
          </p>
        </div>

        {/* Resume Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Existing Resumes */}
          {resumes.map((resume, index) => (
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
                    <div className="w-full h-48 bg-[#d1d5db] rounded-lg border border-[#ffffff33] flex items-center justify-center">
                      {/* Gray placeholder matching screenshot */}
                      <div className="w-full h-full bg-[#d1d5db] rounded-lg"></div>
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
                  </div>

                  {/* Resume Info */}
                  <div className="space-y-3">
                    <h3 className="text-white font-medium">{resume.name}</h3>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Upload Resume Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="bg-transparent border-2 border-dashed border-[#1dff00] hover:bg-[#1dff0010] transition-all duration-300 group cursor-pointer">
              <CardContent className="p-4 h-full flex flex-col">
                {/* Upload Area */}
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-[#1dff00] rounded-full flex items-center justify-center">
                    <Plus className="w-8 h-8 text-black" />
                  </div>
                  <div>
                    <h3 className="text-[#1dff00] font-medium text-lg mb-2">Upload Resume</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};