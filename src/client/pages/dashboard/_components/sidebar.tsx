import { t } from "@lingui/macro";
import { Article, FadersHorizontal, ReadCvLogo, Plus } from "@phosphor-icons/react";
import { Button, KeyboardShortcut, Separator } from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import slugify from "@sindresorhus/slugify";
import { useCreateResume } from "@/client/services/resume";
import { useResumes as useResumeOps } from "@/hooks/useResumes";

import { Copyright } from "@/client/components/copyright";
import { Icon } from "@/client/components/icon";
import { UserAvatar } from "@/client/components/user-avatar";
import { UserOptions } from "@/client/components/user-options";
import { useUser } from "@/client/services/user";

type Props = {
  className?: string;
};

const ActiveIndicator = ({ className }: Props) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className={cn(
      "size-1.5 animate-pulse rounded-full bg-info shadow-[0_0_12px] shadow-info",
      className,
    )}
  />
);

type SidebarItem = {
  path: string;
  name: string;
  shortcut?: string;
  icon: React.ReactNode;
};

type SidebarItemProps = SidebarItem & {
  onClick?: () => void;
};

const SidebarItem = ({ path, name, shortcut, icon, onClick }: SidebarItemProps) => {
  const isActive = useLocation().pathname === path;

  return (
    <Button
      asChild
      size="lg"
      variant="ghost"
      className={cn(
        "h-auto justify-start px-4 py-3",
        isActive && "pointer-events-none bg-secondary/50 text-secondary-foreground",
      )}
      onClick={onClick}
    >
      <Link to={path}>
        <div className="mr-3">{icon}</div>
        <span>{name}</span>
        {!isActive && <KeyboardShortcut className="ml-auto">{shortcut}</KeyboardShortcut>}
        {isActive && <ActiveIndicator className="ml-auto" />}
      </Link>
    </Button>
  );
};

type SidebarProps = {
  setOpen?: (open: boolean) => void;
};

export const Sidebar = ({ setOpen }: SidebarProps) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createResume } = useCreateResume();
  const { importResume: importBinary } = useResumeOps();

  const pickImport = () => fileInputRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const title = (data?.title as string) || file.name.replace(/\.[^.]+$/, "");
        const slug = slugify(title);
        const res = await createResume({ title, slug, visibility: "private" as const });
        await navigate(`/builder/${res.id}`);
      } else {
        await importBinary(file);
      }
      setOpen?.(false);
    } catch {
      // ignore
    } finally {
      e.target.value = "";
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        void navigate("/dashboard/resumes");
        setOpen?.(false);
      } else if (e.shiftKey && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        void navigate("/dashboard/settings");
        setOpen?.(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, setOpen]);

  const sidebarItems: SidebarItem[] = [
    {
      path: "/dashboard/resumes/new",
      name: t`New Resume`,
      shortcut: "⇧N",
      icon: <Plus />,
    },
    {
      path: "/dashboard/resumes", // keep user in resumes while we trigger file picker
      name: t`Import Resume`,
      shortcut: "⇧I",
      icon: <Plus />,
    },
    {
      path: "/dashboard/resumes",
      name: t`Resumes`,
      shortcut: "⇧R",
      icon: <ReadCvLogo />,
    },
    {
      path: "/dashboard/cover-letter",
      name: t`Cover Letter`,
      shortcut: "⇧C",
      icon: <Article />,
    },
    {
      path: "/dashboard/settings",
      name: t`Settings`,
      shortcut: "⇧S",
      icon: <FadersHorizontal />,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-y-4">
  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.json" hidden onChange={onImportFile} />
      <div className="ml-12 flex justify-center lg:ml-0">
        <Button asChild size="icon" variant="ghost" className="size-10 p-0">
          <Link to="/">
            <Icon size={24} className="mx-auto hidden lg:block" />
          </Link>
        </Button>
      </div>

      <Separator className="opacity-50" />

      <div className="grid gap-y-2">
        {sidebarItems.map((item) => (
          <SidebarItem
            {...item}
            key={item.path}
            onClick={() => {
              if (item.name === t`Import Resume`) {
                pickImport();
                return; // don't close yet; close after import completes
              }
              setOpen?.(false);
            }}
          />
        ))}
      </div>

      <div className="flex-1" />

      <Separator className="opacity-50" />

      <UserOptions>
        <Button size="lg" variant="ghost" className="w-full justify-start px-3">
          <UserAvatar size={24} className="mr-3" />
          <span>{user?.name}</span>
        </Button>
      </UserOptions>

      <Copyright className="ml-2" />
    </div>
  );
};
