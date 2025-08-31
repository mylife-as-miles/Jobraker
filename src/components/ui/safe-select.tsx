import * as React from "react";
import { Select as BaseSelect } from "./select";

// SafeSelect: enforces a non-empty default value for controlled/uncontrolled usage.
// If value is empty string, it maps to fallbackValue (defaults to 'default').
// Consumers should still render a matching <SelectItem value={fallbackValue}> for the placeholder/any option.

type Props = Omit<React.ComponentProps<typeof BaseSelect>, "value" | "defaultValue"> & {
  value?: string | undefined;
  defaultValue?: string | undefined;
  fallbackValue?: string;
};

export const SafeSelect: React.FC<Props> = ({ value, defaultValue, fallbackValue = "default", ...rest }) => {
  const coercedValue = value === "" || value == null ? undefined : value;
  const coercedDefault = defaultValue === "" || defaultValue == null ? fallbackValue : defaultValue;
  return (
    <BaseSelect
      {...rest}
      value={coercedValue ?? fallbackValue}
      defaultValue={coercedDefault}
    />
  );
};

export default SafeSelect;