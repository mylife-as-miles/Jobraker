import React, { useEffect } from 'react';
import { useFixWhiteBackgrounds } from '../utils/fix-white-backgrounds';

interface WhiteBackgroundFixerProps {
  autoFix?: boolean;
  showDebugInfo?: boolean;
}

export const WhiteBackgroundFixer: React.FC<WhiteBackgroundFixerProps> = ({
  autoFix = true,
  showDebugInfo = false
}) => {
  const { fixedElements, manualFix, restoreAll, fixedCount } = useFixWhiteBackgrounds();

  useEffect(() => {
    if (autoFix) {
      // Auto-fix on component mount
      manualFix();
    }
  }, [autoFix, manualFix]);

  if (!showDebugInfo) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-[#1dff00]/30 rounded-lg p-3 text-xs text-white">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-2 h-2 bg-[#1dff00] rounded-full"></div>
        <span>White Background Fixer</span>
      </div>
      
      <div className="space-y-1 text-[#ffffff80]">
        <div>Fixed Elements: {fixedCount}</div>
        <div className="flex space-x-2">
          <button
            onClick={manualFix}
            className="px-2 py-1 bg-[#1dff00]/20 border border-[#1dff00]/30 rounded text-[#1dff00] hover:bg-[#1dff00]/30 transition-colors"
          >
            Fix Now
          </button>
          <button
            onClick={restoreAll}
            className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
      
      {fixedElements.length > 0 && (
        <div className="mt-2 max-h-20 overflow-y-auto">
          <div className="text-[#ffffff60] text-xs">Fixed:</div>
          {fixedElements.slice(0, 5).map((item, index) => (
            <div key={index} className="text-[#ffffff60] text-xs truncate">
              {item.elementType}: {item.element.tagName.toLowerCase()}
            </div>
          ))}
          {fixedElements.length > 5 && (
            <div className="text-[#ffffff60] text-xs">
              +{fixedElements.length - 5} more...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhiteBackgroundFixer;