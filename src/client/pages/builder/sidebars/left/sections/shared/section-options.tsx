import { plural, t } from "@lingui/macro";
import { Plus, Pencil, Trash2, List, RotateCcw, Columns2, Eye, EyeOff, Eraser } from "lucide-react";
import type { SectionKey, SectionWithItem } from "@reactive-resume/schema";
import { defaultSections } from "@reactive-resume/schema";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
} from "@reactive-resume/ui";
import get from "lodash.get";
import { useMemo } from "react";

import { useDialog } from "@/client/stores/dialog";
import { useResumeStore } from "@/client/stores/resume";

type Props = { id: SectionKey };

export const SectionOptions = ({ id }: Props) => {
  const { open } = useDialog(id);

  const setValue = useResumeStore((state) => state.setValue);
  const removeSection = useResumeStore((state) => state.removeSection);

  const originalName = get(defaultSections, `${id}.name`, "") as string;
  const section = useResumeStore((state) => get(state.resume?.data?.sections, id)) as SectionWithItem;

  const hasItems = useMemo(() => section && "items" in section, [section]);
  const isCustomSection = useMemo(() => id.startsWith("custom"), [id]);

  // Guard against undefined section
  if (!section) return null;

  const onCreate = () => {
    open("create", { id });
  };

  const toggleSeperateLinks = (checked: boolean) => {
    setValue(`sections.${id}.separateLinks`, checked);
  };

  const toggleVisibility = () => {
    setValue(`sections.${id}.visible`, !section.visible);
  };

  const onResetName = () => {
    setValue(`sections.${id}.name`, originalName);
  };

  const onChangeColumns = (value: string) => {
    setValue(`sections.${id}.columns`, Number(value));
  };

  const onResetItems = () => {
    setValue(`sections.${id}.items`, []);
  };

  const onRemove = () => {
    removeSection(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="p-2">
          <List size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mr-4 w-48">
        {hasItems && (
          <>
            <DropdownMenuItem onClick={onCreate}>
              <Plus size={14} />
              <span className="ml-2">{t`Add a new item`}</span>
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={section.separateLinks}
              onCheckedChange={toggleSeperateLinks}
            >
              <span className="ml-0">{t`Separate Links`}</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={toggleVisibility}>
            {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            <span className="ml-2">{section.visible ? t`Hide` : t`Show`}</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Pencil size={14} />
              <span className="ml-2">{t`Rename`}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <div className="relative col-span-2">
                <Input
                  id={`sections.${id}.name`}
                  value={section.name}
                  onChange={(event) => {
                    setValue(`sections.${id}.name`, event.target.value);
                  }}
                />
                <Button
                  variant="ghost"
                  className="absolute inset-y-0 right-0 p-2"
                  onClick={onResetName}
                >
                  <RotateCcw size={14} />
                </Button>
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Columns2 size={14} />
              <span className="ml-2">{t`Columns`}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={`${section.columns}`} onValueChange={onChangeColumns}>
                {Array.from({ length: 5 }, (_, i) => i + 1).map((value) => (
                  <DropdownMenuRadioItem key={value} value={`${value}`}>
                    {value} {plural(value, { one: "Column", other: "Columns" })}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasItems} onClick={onResetItems}>
          <Eraser size={14} />
          <span className="ml-2">{t`Reset`}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-error" disabled={!isCustomSection} onClick={onRemove}>
          <Trash2 size={14} />
          <span className="ml-2">{t`Remove`}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
