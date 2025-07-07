import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface StyledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'transparent' | 'outlined';
}

export const StyledInput = forwardRef<HTMLInputElement, StyledInputProps>(
  ({ className, label, error, variant = 'default', ...props }, ref) => {
    const baseStyles = "w-full transition-all duration-300 focus:outline-none focus:ring-0";
    
    const variantStyles = {
      default: `
        bg-[#F5F5F5]/90 
        border border-[#E0E0E0] 
        rounded-lg 
        px-4 py-3 
        text-[#212121] 
        placeholder:text-[#757575] 
        text-base
        hover:border-[#BDBDBD] 
        focus:border-[#1dff00] 
        focus:bg-[#F5F5F5]
        backdrop-blur-sm
      `,
      transparent: `
        bg-transparent 
        border border-[#ffffff33] 
        rounded-lg 
        px-4 py-3 
        text-white 
        placeholder:text-[#ffffff60] 
        text-base
        hover:border-[#ffffff4d] 
        focus:border-[#1dff00] 
        focus:bg-[#ffffff1a]
        backdrop-blur-[8px]
      `,
      outlined: `
        bg-transparent 
        border-2 border-[#E0E0E0] 
        rounded-lg 
        px-4 py-3 
        text-[#212121] 
        placeholder:text-[#757575] 
        text-base
        hover:border-[#BDBDBD] 
        focus:border-[#1dff00] 
        focus:bg-[#F5F5F5]/50
      `
    };

    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="block text-sm font-medium text-[#212121] dark:text-white mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            baseStyles,
            variantStyles[variant],
            error && "border-red-500 focus:border-red-500",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

StyledInput.displayName = "StyledInput";