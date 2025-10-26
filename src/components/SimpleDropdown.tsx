import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SimpleDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function SimpleDropdown({ 
  value, 
  onValueChange, 
  options,
  placeholder = 'Select...',
  className = '',
  triggerClassName = ''
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the selected option label
  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between rounded-md px-3 py-2 text-sm bg-[#0a0a0a] text-white border border-[#1dff00]/30 hover:bg-[#0a0a0a]/80 hover:border-[#1dff00]/50 transition-colors ${triggerClassName}`}
        aria-label={placeholder}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[180px] bg-[#0a0a0a] border border-[#1dff00]/30 rounded-md shadow-lg">
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="w-full flex items-center justify-between px-3 py-2 rounded text-left text-sm text-white hover:bg-[#1dff00]/10 transition-colors"
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className="h-4 w-4 text-[#1dff00]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SimpleDropdown;
