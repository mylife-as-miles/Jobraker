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
  <div className="relative h-screen w-screen overflow-hidden bg-black">
        <PanelGroup direction="horizontal">
          <Panel
            minSize={25}
            maxSize={45}
            defaultSize={30}
    className={cn("z-10 bg-gradient-to-b from-[#0a0a0a] to-[#0a0a0a] border-r border-[#1dff00]/10", !leftHandle.isDragging && "transition-[flex]")}
            onResize={leftSetSize}
          >
            <LeftSidebar />
          </Panel>
          <PanelResizeHandle
            isDragging={leftHandle.isDragging}
            onDragging={leftHandle.setDragging}
          />
          <Panel className="bg-black">
            <OutletSlot />
          </Panel>
          <PanelResizeHandle
            isDragging={rightHandle.isDragging}
            onDragging={rightHandle.setDragging}
          />
          <Panel
            minSize={25}
            maxSize={45}
            defaultSize={30}
            className={cn("z-10 bg-gradient-to-b from-[#0a0a0a] to-[#0a0a0a] border-l border-[#1dff00]/10", !rightHandle.isDragging && "transition-[flex]")}
            onResize={rightSetSize}
          >
            <RightSidebar />
          </Panel>
        </PanelGroup>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-screen bg-black">
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
