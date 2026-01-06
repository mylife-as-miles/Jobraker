import {
  User,
  FileText,
  Award,
  Share2,
  Briefcase,
  GraduationCap,
  BadgeCheck,
  Gamepad2,
  Languages,
  Heart,
  Puzzle,
  BookOpen,
  Compass,
  Users,
} from "lucide-react";
import type { SectionKey, SectionWithItem } from "@reactive-resume/schema";
import { defaultSection } from "@reactive-resume/schema";
import type { ButtonProps } from "@reactive-resume/ui";
import { Button, Tooltip } from "@reactive-resume/ui";
import get from "lodash.get";
import type { LucideProps } from "lucide-react";

import { useResumeStore } from "@/client/stores/resume";

const getSectionIcon = (id: SectionKey, iconSize: number = 18) => {
  const props: LucideProps = { size: iconSize };

  switch (id) {
    case "basics":
      return <User {...props} />;
    case "summary":
      return <FileText {...props} />;
    case "awards":
      return <Award {...props} />;
    case "profiles":
      return <Share2 {...props} />;
    case "experience":
      return <Briefcase {...props} />;
    case "education":
      return <GraduationCap {...props} />;
    case "certifications":
      return <BadgeCheck {...props} />;
    case "interests":
      return <Gamepad2 {...props} />;
    case "languages":
      return <Languages {...props} />;
    case "volunteer":
      return <Heart {...props} />;
    case "projects":
      return <Puzzle {...props} />;
    case "publications":
      return <BookOpen {...props} />;
    case "skills":
      return <Compass {...props} />;
    case "references":
      return <Users {...props} />;
    default:
      return null;
  }
};

type SectionIconProps = Omit<ButtonProps, "size"> & {
  id: SectionKey;
  name?: string;
  size?: number;
  icon?: React.ReactNode;
};

export const SectionIcon = ({ id, name, icon, size = 14, ...props }: SectionIconProps) => {
  const section = useResumeStore((state) =>
    get(state.resume?.data?.sections, id, defaultSection),
  ) as SectionWithItem;

  return (
    <Tooltip content={name ?? section?.name ?? id}>
      <Button variant="ghost" className="size-8 rounded-full p-0" {...props}>
        {icon ?? getSectionIcon(id, size)}
      </Button>
    </Tooltip>
  );
};
