import React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, PenTool, Gift, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const AccountLibraryPage = () => {
  const navigate = useNavigate();

  const libraryItems = [
    {
      id: "resume",
      title: "Resumes",
      description: "Create, tailor, and manage your resumes with AI suggestions.",
      icon: <FileText className="w-8 h-8 text-brand" />,
      badge: "AI Tailoring",
      color: "from-brand/20 to-transparent",
      borderColor: "group-hover:border-brand/50",
      glowColor: "rgba(29, 255, 0, 0.15)",
      cta: "Manage Resumes",
      path: "/dashboard/resume"
    },
    {
      id: "cover-letter",
      title: "Cover Letters",
      description: "Draft highly personalized cover letters targeting specific roles.",
      icon: <PenTool className="w-8 h-8 text-blue-400" />,
      badge: "AI Generation",
      color: "from-blue-500/20 to-transparent",
      borderColor: "group-hover:border-blue-400/50",
      glowColor: "rgba(96, 165, 250, 0.15)",
      cta: "Draft Letters",
      path: "/dashboard/cover-letter"
    },
    {
      id: "referrals",
      title: "Referrals & Network",
      description: "Import LinkedIn connections and discover referral match opportunities.",
      icon: <Gift className="w-8 h-8 text-purple-400" />,
      badge: "Milestones",
      color: "from-purple-500/20 to-transparent",
      borderColor: "group-hover:border-purple-400/50",
      glowColor: "rgba(192, 132, 252, 0.15)",
      cta: "View Referrals",
      path: "/dashboard/referrals"
    }
  ];

  return (
    <div className="product-page-shell min-h-full">
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 pb-6 md:pb-24">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Account Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access and manage your personal job search assets and referrals.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {libraryItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className="group cursor-pointer"
              onClick={() => navigate(item.path)}
            >
              <Card 
                className={`product-section-card p-6 bg-gradient-to-br ${item.color} border border-border/40 hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-start md:flex-row md:items-center gap-4 md:gap-6`}
                style={{
                  boxShadow: `0 0 40px -10px transparent`,
                }}
              >
                {/* Visual Ambient Glow */}
                <div 
                  className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-500 group-hover:scale-125" 
                  style={{ backgroundColor: item.glowColor.split(",").slice(0, 3).join(",") + ", 0.4)" }}
                />

                <div className="flex items-start gap-4 flex-none md:flex-1">
                  <div className="p-3.5 rounded-2xl bg-foreground/5 border border-foreground/10 shrink-0">
                    {item.icon}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground group-hover:text-brand transition-colors">
                        {item.title}
                      </h2>
                      <span className="inline-flex items-center rounded-full bg-foreground/5 border border-foreground/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <Button
                    variant="outline"
                    className="w-full md:w-auto text-xs px-4 h-9 gap-1.5 product-outline-button border-foreground/10 hover:border-foreground/30"
                  >
                    <span>{item.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountLibraryPage;
