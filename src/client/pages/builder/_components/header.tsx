import { t } from "@lingui/macro";
import { HouseSimple, Lock, SidebarSimple } from "@phosphor-icons/react";
import { Button, Tooltip } from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { Link } from "react-router-dom";

import { useBuilderStore } from "@/client/stores/builder";
import { useResumeStore } from "@/client/stores/resume";

export const BuilderHeader = () => {
  const title = useResumeStore((state) => state.resume.title);
  const locked = useResumeStore((state) => state.resume.locked);

  const toggle = useBuilderStore((state) => state.toggle);
  const isDragging = useBuilderStore(
    (state) => state.panel.left.handle.isDragging || state.panel.right.handle.isDragging,
  );
  const leftPanelSize = useBuilderStore((state) => state.panel.left.size);
  const rightPanelSize = useBuilderStore((state) => state.panel.right.size);

  const onToggle = (side: "left" | "right") => {
    toggle(side);
  };

  return (
    <div
      style={{ left: `${leftPanelSize}%`, right: `${rightPanelSize}%` }}
      className={cn(
        "fixed inset-x-0 top-0 z-[60] h-16 bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 backdrop-blur-xl border-b border-[#1dff00]/30 shadow-[0_0_40px_rgba(29,255,0,0.15)] lg:z-20",
        !isDragging && "transition-[left,right]",
      )}
    >
      <div className="flex h-full items-center justify-between px-4 gap-4">
        <Button
          variant="ghost"
          className="flex lg:hidden h-10 w-10 p-0 rounded-xl border border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:scale-110 transition-all duration-200"
          onClick={() => {
            onToggle("left");
          }}
        >
          <SidebarSimple className="text-[#1dff00]" />
        </Button>

        <div className="flex items-center justify-center gap-x-3 lg:mx-auto">
          <Button 
            asChild 
            variant="ghost"
            className="h-10 w-10 p-0 rounded-xl border border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:scale-110 transition-all duration-200 group"
          >
            <Link to="/dashboard/resumes">
              <HouseSimple className="group-hover:scale-110 transition-transform" />
            </Link>
          </Button>

          <div className="h-6 w-px bg-gradient-to-b from-transparent via-[#1dff00]/40 to-transparent shadow-[0_0_10px_rgba(29,255,0,0.3)]" />

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-br from-[#1dff00]/10 to-[#1dff00]/5 border border-[#1dff00]/30">
            <h1 className="font-bold text-white text-base tracking-tight">{title}</h1>
            {locked && (
              <Tooltip content={t`This resume is locked, please unlock to make further changes.`}>
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#1dff00]/20 border border-[#1dff00]/40">
                  <Lock width={14} height={14} className="text-[#1dff00]" />
                </div>
              </Tooltip>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          className="flex lg:hidden h-10 w-10 p-0 rounded-xl border border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:bg-gradient-to-br hover:from-[#1dff00]/15 hover:to-[#1dff00]/5 hover:scale-110 transition-all duration-200"
          onClick={() => {
            onToggle("right");
          }}
        >
          <SidebarSimple className="-scale-x-100 text-[#1dff00]" />
        </Button>
      </div>
    </div>
  );
};
