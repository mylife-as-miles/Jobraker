import React from 'react';
import { StyledInput } from './StyledInput';

interface InputField {
  id: string;
  label?: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

interface InputGroupProps {
  fields: InputField[];
  variant?: 'default' | 'transparent' | 'outlined';
  spacing?: 'compact' | 'normal' | 'relaxed';
  className?: string;
}

export const InputGroup: React.FC<InputGroupProps> = ({
  fields,
  variant = 'default',
  spacing = 'normal',
  className = ''
}) => {
  const spacingStyles = {
    compact: 'space-y-3',
    normal: 'space-y-6', // 24dp equivalent
    relaxed: 'space-y-8'
  };

  return (
    <div className={`w-full px-4 ${spacingStyles[spacing]} ${className}`}>
      {fields.map((field) => (
        <StyledInput
          key={field.id}
          label={field.label}
          placeholder={field.placeholder}
          type={field.type || 'text'}
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          error={field.error}
          required={field.required}
          variant={variant}
        />
      ))}
    </div>
  );
};