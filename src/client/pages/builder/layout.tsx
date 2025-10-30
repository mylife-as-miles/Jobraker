import { useBreakpoint } from "@reactive-resume/hooks";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  VisuallyHidden,
} from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { Outlet } from "react-router-dom";

import { useBuilderStore } from "@/client/stores/builder";

import { BuilderHeader } from "./_components/header";
import { BuilderToolbar } from "./_components/toolbar";
import { LeftSidebar } from "./sidebars/left";
import { RightSidebar } from "./sidebars/right";

const onOpenAutoFocus = (event: Event) => {
  event.preventDefault();
};

const OutletSlot = () => (
  <>
    <BuilderHeader />

    <div className="absolute inset-0">
      <Outlet />
    </div>

    <BuilderToolbar />
  </>
);

export const BuilderLayout = () => {
  const { isDesktop } = useBreakpoint();

  const sheet = useBuilderStore((state) => state.sheet);

  const leftSetSize = useBuilderStore((state) => state.panel.left.setSize);
  const rightSetSize = useBuilderStore((state) => state.panel.right.setSize);

  const leftHandle = useBuilderStore((state) => state.panel.left.handle);
  const rightHandle = useBuilderStore((state) => state.panel.right.handle);

  if (isDesktop) {
    return (
      <div className="relative size-full overflow-hidden bg-black">
        {/* Ambient Background Glows */}
        <div className="fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/3 rounded-full blur-3xl opacity-30 pointer-events-none -z-10" />
        <div className="fixed bottom-20 left-0 h-96 w-96 bg-[#1dff00]/3 rounded-full blur-3xl opacity-20 pointer-events-none -z-10" />
        
        <PanelGroup direction="horizontal">
          <Panel
            minSize={25}
            maxSize={45}
            defaultSize={30}
            className={cn(
              "z-10 bg-gradient-to-b from-[#0a0a0a]/98 to-[#0f0f0f]/98 border-r border-[#1dff00]/20 shadow-[inset_0_0_30px_rgba(29,255,0,0.05)] backdrop-blur-xl", 
              !leftHandle.isDragging && "transition-[flex]"
            )}
            onResize={leftSetSize}
          >
            <LeftSidebar />
          </Panel>
          <PanelResizeHandle
            isDragging={leftHandle.isDragging}
            onDragging={leftHandle.setDragging}
            className="w-px bg-gradient-to-b from-transparent via-[#1dff00]/40 to-transparent hover:bg-[#1dff00]/60 hover:w-[2px] transition-all duration-200 relative group"
          />
          <Panel className="bg-black relative">
            <OutletSlot />
          </Panel>
          <PanelResizeHandle
            isDragging={rightHandle.isDragging}
            onDragging={rightHandle.setDragging}
            className="w-px bg-gradient-to-b from-transparent via-[#1dff00]/40 to-transparent hover:bg-[#1dff00]/60 hover:w-[2px] transition-all duration-200 relative group"
          />
          <Panel
            minSize={25}
            maxSize={45}
            defaultSize={30}
            className={cn(
              "z-10 bg-gradient-to-b from-[#0a0a0a]/98 to-[#0f0f0f]/98 border-l border-[#1dff00]/20 shadow-[inset_0_0_30px_rgba(29,255,0,0.05)] backdrop-blur-xl", 
              !rightHandle.isDragging && "transition-[flex]"
            )}
            onResize={rightSetSize}
          >
            <RightSidebar />
          </Panel>
        </PanelGroup>
      </div>
    );
  }

  return (
    <div className="relative">
      <Sheet open={sheet.left.open} onOpenChange={sheet.left.setOpen}>
        <VisuallyHidden>
          <SheetHeader>
            <SheetTitle />
            <SheetDescription />
          </SheetHeader>
        </VisuallyHidden>

        <SheetContent
          side="left"
          showClose={false}
          className="top-16 p-0 sm:max-w-xl"
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <LeftSidebar />
        </SheetContent>
      </Sheet>

      <OutletSlot />

      <Sheet open={sheet.right.open} onOpenChange={sheet.right.setOpen}>
        <SheetContent
          side="right"
          showClose={false}
          className="top-16 p-0 sm:max-w-xl"
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <VisuallyHidden>
            <SheetHeader>
              <SheetTitle />
              <SheetDescription />
            </SheetHeader>
          </VisuallyHidden>

          <RightSidebar />
        </SheetContent>
      </Sheet>
    </div>
  );
};
