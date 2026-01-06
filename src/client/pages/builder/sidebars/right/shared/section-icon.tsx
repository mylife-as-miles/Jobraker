import {
  Code,
  LayoutGrid,
  Download,
  Info,
  LayoutDashboard,
  StickyNote,
  Palette,
  FileText,
  Share2,
  Type,
  Languages,
  TrendingUp,
} from "lucide-react";
import type { ButtonProps } from "@reactive-resume/ui";
import { Button, Tooltip } from "@reactive-resume/ui";
import type { LucideProps } from "lucide-react";

type MetadataKey =
  | "template"
  | "layout"
  | "typography"
  | "theme"
  | "css"
  | "page"
  | "locale"
  | "sharing"
  | "statistics"
  | "export"
  | "notes"
  | "information";

const getSectionIcon = (id: MetadataKey, iconSize: number = 18) => {
  const props: LucideProps = { size: iconSize };

  switch (id) {
    case "notes":
      return <StickyNote {...props} />;
    case "template":
      return <LayoutGrid {...props} />;
    case "layout":
      return <LayoutDashboard {...props} />;
    case "typography":
      return <Type {...props} />;
    case "theme":
      return <Palette {...props} />;
    case "css":
      return <Code {...props} />;
    case "page":
      return <FileText {...props} />;
    case "locale":
      return <Languages {...props} />;
    case "sharing":
      return <Share2 {...props} />;
    case "statistics":
      return <TrendingUp {...props} />;
    case "export":
      return <Download {...props} />;
    case "information":
      return <Info {...props} />;
    default:
      return null;
  }
};

type SectionIconProps = Omit<ButtonProps, "size"> & {
  id: MetadataKey;
  name: string;
  size?: number;
  icon?: React.ReactNode;
};

export const SectionIcon = ({ id, name, icon, size = 14, ...props }: SectionIconProps) => (
  <Tooltip content={name}>
    <Button variant="ghost" className="size-8 rounded-full p-0" {...props}>
      {icon ?? getSectionIcon(id, size)}
    </Button>
  </Tooltip>
);
