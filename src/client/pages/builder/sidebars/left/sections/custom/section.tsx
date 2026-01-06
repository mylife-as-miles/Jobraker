import { t, Trans } from "@lingui/macro";
import { createId } from "@paralleldrive/cuid2";
import { GripVertical, Mail, Plus, X } from "lucide-react";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { AnimatePresence, Reorder, useDragControls } from "framer-motion";

import { useResumeStore } from "@/client/stores/resume";

// Define CustomField type locally since it may not be exported from schema
type CustomField = {
  id: string;
  icon: string;
  name: string;
  value: string;
};

type CustomFieldProps = {
  field: CustomField;
  onChange: (field: CustomField) => void;
  onRemove: (id: string) => void;
};

export const CustomFieldComponent = ({ field, onChange, onRemove }: CustomFieldProps) => {
  const controls = useDragControls();

  const handleChange = (key: "icon" | "name" | "value", value: string) => {
    onChange({ ...field, [key]: value });
  };

  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
    >
      <div className="flex items-end justify-between">
        <Button
          variant="ghost"
          className="shrink-0 p-2"
          onPointerDown={(event) => {
            controls.start(event);
          }}
        >
          <GripVertical size={16} />
        </Button>

        <Popover>
          <Tooltip content={t`Icon`}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="shrink-0 p-2">
                {field.icon ? <i className={cn(`ph ph-${field.icon}`)} /> : <Mail size={16} />}
              </Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent side="bottom" align="start" className="flex flex-col gap-y-1.5 p-1.5">
            <Input
              value={field.icon}
              placeholder={t`Enter Phosphor Icon`}
              onChange={(event) => {
                onChange({ ...field, icon: event.target.value });
              }}
            />

            <p className="text-xs opacity-80">
              <Trans>
                Visit{" "}
                <a
                  href="https://phosphoricons.com/"
                  target="_blank"
                  className="underline"
                  rel="noopener noreferrer nofollow"
                >
                  Phosphor Icons
                </a>{" "}
                for a list of available icons
              </Trans>
            </p>
          </PopoverContent>
        </Popover>

        <Input
          className="mx-2"
          placeholder={t`Name`}
          value={field.name}
          onChange={(event) => {
            handleChange("name", event.target.value);
          }}
        />

        <Input
          className="mx-2"
          placeholder={t`Value`}
          value={field.value}
          onChange={(event) => {
            handleChange("value", event.target.value);
          }}
        />

        <Button
          variant="ghost"
          className="shrink-0 p-2"
          onClick={() => {
            onRemove(field.id);
          }}
        >
          <X size={16} />
        </Button>
      </div>
    </Reorder.Item>
  );
};

type Props = {
  className?: string;
};

export const CustomFieldsSection = ({ className }: Props) => {
  const setValue = useResumeStore((state) => state.setValue);
  const customFields = useResumeStore((state) => state.resume?.data?.basics?.customFields) as CustomField[] | undefined;

  if (!customFields) return null;

  const onAddCustomField = () => {
    setValue("basics.customFields", [
      ...customFields,
      { id: createId(), icon: "envelope", name: "", value: "" },
    ]);
  };

  const onChangeCustomField = (field: CustomField) => {
    const index = customFields.findIndex((item: CustomField) => item.id === field.id);
    const newCustomFields = JSON.parse(JSON.stringify(customFields));
    newCustomFields[index] = field;

    setValue("basics.customFields", newCustomFields);
  };

  const onReorderCustomFields = (values: CustomField[]) => {
    setValue("basics.customFields", values);
  };

  const onRemoveCustomField = (id: string) => {
    setValue(
      "basics.customFields",
      customFields.filter((field: CustomField) => field.id !== id),
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <AnimatePresence>
        <Reorder.Group
          axis="y"
          className="space-y-4"
          values={customFields}
          onReorder={onReorderCustomFields}
        >
          {customFields.map((field: CustomField) => (
            <CustomFieldComponent
              key={field.id}
              field={field}
              onChange={onChangeCustomField}
              onRemove={onRemoveCustomField}
            />
          ))}
        </Reorder.Group>
      </AnimatePresence>

      <Button variant="link" onClick={onAddCustomField}>
        <Plus className="mr-2" size={16} />
        <span>{t`Add a custom field`}</span>
      </Button>
    </div>
  );
};
