// Utility to identify and fix white background elements
import { useState, useEffect, useCallback } from 'react';

export interface WhiteBackgroundElement {
  element: HTMLElement;
  originalBackground: string;
  elementType: 'button' | 'input' | 'card' | 'other';
}

// Function to detect elements with white backgrounds
export const detectWhiteBackgrounds = (): WhiteBackgroundElement[] => {
  const whiteBackgroundElements: WhiteBackgroundElement[] = [];
  
  // Common white background classes and styles to look for
  const whiteBackgroundSelectors = [
    '.bg-white',
    '.bg-gray-50',
    '.bg-gray-100',
    '.bg-gray-200',
    '.bg-slate-50',
    '.bg-slate-100',
    '.bg-neutral-50',
    '.bg-neutral-100',
    '[style*="background: white"]',
    '[style*="background-color: white"]',
    '[style*="background: #fff"]',
    '[style*="background-color: #fff"]',
    '[style*="background: #ffffff"]',
    '[style*="background-color: #ffffff"]',
    '.btn-light',
    '.btn-outline-light',
    '.form-control-light',
    '.card-light'
  ];

  whiteBackgroundSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlElement);
      const backgroundColor = computedStyle.backgroundColor;
      
      // Check if background is actually white or light
      if (
        backgroundColor === 'rgb(255, 255, 255)' ||
        backgroundColor === 'rgba(255, 255, 255, 1)' ||
        backgroundColor === '#ffffff' ||
        backgroundColor === '#fff' ||
        backgroundColor === 'white' ||
        backgroundColor.includes('rgb(248, 250, 252)') || // gray-50
        backgroundColor.includes('rgb(243, 244, 246)') || // gray-100
        backgroundColor.includes('rgb(229, 231, 235)')    // gray-200
      ) {
        let elementType: 'button' | 'input' | 'card' | 'other' = 'other';
        
        if (htmlElement.tagName === 'BUTTON' || htmlElement.getAttribute('role') === 'button') {
          elementType = 'button';
        } else if (htmlElement.tagName === 'INPUT' || htmlElement.tagName === 'TEXTAREA' || htmlElement.tagName === 'SELECT') {
          elementType = 'input';
        } else if (htmlElement.classList.contains('card') || htmlElement.classList.contains('panel')) {
          elementType = 'card';
        }
        
        whiteBackgroundElements.push({
          element: htmlElement,
          originalBackground: backgroundColor,
          elementType
        });
      }
    });
  });

  return whiteBackgroundElements;
};

// Function to apply transparent background fixes
export const applyTransparentFixes = (elements: WhiteBackgroundElement[]): void => {
  elements.forEach(({ element, elementType }) => {
    // Remove white background
    element.style.background = 'transparent';
    element.style.backgroundColor = 'transparent';
    
    // Apply backdrop blur
    element.style.backdropFilter = 'blur(10px)';
    element.style.webkitBackdropFilter = 'blur(10px)';
    
    // Add appropriate styling based on element type
    switch (elementType) {
      case 'button':
        element.style.border = '1px solid rgba(29, 255, 0, 0.3)';
        element.style.color = '#1dff00';
        element.style.transition = 'all 0.3s ease';
        
        // Add hover effect
        element.addEventListener('mouseenter', () => {
          element.style.backgroundColor = 'rgba(29, 255, 0, 0.1)';
          element.style.borderColor = 'rgba(29, 255, 0, 0.6)';
          element.style.transform = 'translateY(-1px)';
          element.style.boxShadow = '0 4px 12px rgba(29, 255, 0, 0.2)';
        });
        
        element.addEventListener('mouseleave', () => {
          element.style.backgroundColor = 'transparent';
          element.style.borderColor = 'rgba(29, 255, 0, 0.3)';
          element.style.transform = 'translateY(0)';
          element.style.boxShadow = 'none';
        });
        break;
        
      case 'input':
        element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        element.style.color = '#ffffff';
        element.style.transition = 'all 0.3s ease';
        
        // Add focus effect
        element.addEventListener('focus', () => {
          element.style.borderColor = '#1dff00';
          element.style.boxShadow = '0 0 15px rgba(29, 255, 0, 0.3)';
        });
        
        element.addEventListener('blur', () => {
          element.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          element.style.boxShadow = 'none';
        });
        break;
        
      case 'card':
        element.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        element.style.backdropFilter = 'blur(15px)';
        element.style.webkitBackdropFilter = 'blur(15px)';
        element.style.transition = 'all 0.3s ease';
        
        // Add hover effect
        element.addEventListener('mouseenter', () => {
          element.style.borderColor = 'rgba(29, 255, 0, 0.3)';
          element.style.boxShadow = '0 0 20px rgba(29, 255, 0, 0.1)';
        });
        
        element.addEventListener('mouseleave', () => {
          element.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          element.style.boxShadow = 'none';
        });
        break;
        
      default:
        element.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        element.style.transition = 'all 0.3s ease';
        break;
    }
    
    // Ensure text remains visible
    if (!element.style.color) {
      element.style.color = '#ffffff';
    }
    
    // Add accessibility attributes
    element.setAttribute('data-transparent-fixed', 'true');
  });
};

// Function to restore original backgrounds (for testing/debugging)
export const restoreOriginalBackgrounds = (elements: WhiteBackgroundElement[]): void => {
  elements.forEach(({ element, originalBackground }) => {
    element.style.background = originalBackground;
    element.style.backgroundColor = originalBackground;
    element.style.backdropFilter = '';
    element.style.webkitBackdropFilter = '';
    element.style.border = '';
    element.style.transition = '';
    element.style.transform = '';
    element.style.boxShadow = '';
    element.removeAttribute('data-transparent-fixed');
  });
};

// Main function to fix white backgrounds
export const fixWhiteBackgrounds = (): WhiteBackgroundElement[] => {
  const whiteElements = detectWhiteBackgrounds();
  applyTransparentFixes(whiteElements);
  
  console.log(`Fixed ${whiteElements.length} elements with white backgrounds:`, whiteElements);
  
  return whiteElements;
};

// Function to continuously monitor for new white background elements
export const startWhiteBackgroundMonitor = (): () => void => {
  let isMonitoring = true;
  
  const monitor = () => {
    if (!isMonitoring) return;
    
    const newWhiteElements = detectWhiteBackgrounds().filter(
      ({ element }) => !element.hasAttribute('data-transparent-fixed')
    );
    
    if (newWhiteElements.length > 0) {
      applyTransparentFixes(newWhiteElements);
      console.log(`Fixed ${newWhiteElements.length} new white background elements`);
    }
    
    // Check again in 1 second
    setTimeout(monitor, 1000);
  };
  
  // Start monitoring
  monitor();
  
  // Return stop function
  return () => {
    isMonitoring = false;
  };
};

// React hook for fixing white backgrounds
export const useFixWhiteBackgrounds = () => {
  const [fixedElements, setFixedElements] = useState<WhiteBackgroundElement[]>([]);
  
  useEffect(() => {
    // Initial fix
    const elements = fixWhiteBackgrounds();
    setFixedElements(elements);
    
    // Start monitoring for new elements
    const stopMonitoring = startWhiteBackgroundMonitor();
    
    // Cleanup
    return () => {
      stopMonitoring();
    };
  }, []);
  
  const manualFix = useCallback(() => {
    const elements = fixWhiteBackgrounds();
    setFixedElements(prev => [...prev, ...elements]);
    return elements;
  }, []);
  
  const restoreAll = useCallback(() => {
    restoreOriginalBackgrounds(fixedElements);
    setFixedElements([]);
  }, [fixedElements]);
  
  return {
    fixedElements,
    manualFix,
    restoreAll,
    fixedCount: fixedElements.length
  };
};

export default {
  detectWhiteBackgrounds,
  applyTransparentFixes,
  restoreOriginalBackgrounds,
  fixWhiteBackgrounds,
  startWhiteBackgroundMonitor,
  useFixWhiteBackgrounds
};