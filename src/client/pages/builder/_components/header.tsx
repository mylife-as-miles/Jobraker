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
        "fixed inset-x-0 top-0 z-[60] h-16 bg-gradient-to-r from-[#0a0a0a]/98 via-[#0f0f0f]/98 to-[#0a0a0a]/98 backdrop-blur-xl border-b border-[#1dff00]/20 shadow-[0_0_30px_rgba(29,255,0,0.1)] lg:z-20",
        !isDragging && "transition-[left,right]",
      )}
    >
      <div className="flex h-full items-center justify-between px-4 gap-4">
        <Button
          variant="ghost"
          className="flex lg:hidden w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:border-[#1dff00]/30 transition-all duration-200 border border-transparent"
          onClick={() => {
            onToggle("left");
          }}
        >
          <SidebarSimple />
        </Button>

        <div className="flex items-center justify-center gap-x-2 lg:mx-auto">
          <Button 
            asChild 
            variant="ghost"
            className="w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:border-[#1dff00]/30 hover:scale-110 transition-all duration-200 border border-transparent group"
          >
            <Link to="/dashboard/resumes">
              <HouseSimple className="group-hover:scale-110 transition-transform" />
            </Link>
          </Button>

          <span className="mx-1 text-sm opacity-30 font-light">{"/"}</span>

          <h1 className="font-bold text-lg bg-gradient-to-r from-white via-white/95 to-[#1dff00]/90 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(29,255,0,0.3)]">
            {title}
          </h1>

          {locked && (
            <Tooltip content={t`This resume is locked, please unlock to make further changes.`}>
              <div className="ml-2 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-1.5">
                <Lock width={14} height={14} className="text-red-400" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Locked</span>
              </div>
            </Tooltip>
          )}
        </div>

        <Button
          variant="ghost"
          className="flex lg:hidden w-10 h-10 p-0 rounded-xl hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:border-[#1dff00]/30 transition-all duration-200 border border-transparent"
          onClick={() => {
            onToggle("right");
          }}
        >
          <SidebarSimple className="-scale-x-100" />
        </Button>
      </div>
    </div>
  );
};
