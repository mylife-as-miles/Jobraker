import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ModelDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  models: Array<{ id: string; name: string }>;
}

export function ModelDropdown({ value, onValueChange, models }: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the selected model name
  const selectedModel = models.find(m => m.id === value);

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

  const handleSelect = (modelId: string) => {
    onValueChange(modelId);
    setIsOpen(false);
    console.log('Selected model:', modelId);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between rounded-md px-3 py-2 text-sm bg-neutral-900 text-white border border-neutral-700 w-[180px] hover:bg-neutral-800 transition-colors"
        aria-label="Select model"
      >
        <span>{selectedModel?.name || 'Select model'}</span>
        <ChevronDown
          className={`ml-2 h-4 w-4 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-[180px] bg-neutral-900 border border-neutral-700 rounded-md shadow-lg">
          <div className="p-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded text-left text-sm text-white bg-neutral-900 hover:bg-neutral-800"
              >
                <span>{model.name}</span>
                {value === model.id && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelDropdown;