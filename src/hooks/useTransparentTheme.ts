import { useState, useEffect, useCallback } from 'react';

interface TransparentThemeConfig {
  isDark: boolean;
  blurIntensity: number;
  opacity: number;
  accentColor: string;
  contrastRatio: number;
}

interface UseTransparentThemeReturn {
  config: TransparentThemeConfig;
  updateConfig: (updates: Partial<TransparentThemeConfig>) => void;
  resetConfig: () => void;
  getButtonStyles: (variant?: string) => string;
  getInputStyles: (variant?: string) => string;
  getCardStyles: (variant?: string) => string;
  isHighContrast: boolean;
  isReducedMotion: boolean;
}

const defaultConfig: TransparentThemeConfig = {
  isDark: true,
  blurIntensity: 15,
  opacity: 0.1,
  accentColor: '#1dff00',
  contrastRatio: 4.5,
};

export const useTransparentTheme = (): UseTransparentThemeReturn => {
  const [config, setConfig] = useState<TransparentThemeConfig>(defaultConfig);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Detect system preferences
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateSystemPreferences = () => {
      setConfig(prev => ({ ...prev, isDark: darkModeQuery.matches }));
      setIsHighContrast(highContrastQuery.matches);
      setIsReducedMotion(reducedMotionQuery.matches);
    };

    // Initial check
    updateSystemPreferences();

    // Add listeners
    darkModeQuery.addEventListener('change', updateSystemPreferences);
    highContrastQuery.addEventListener('change', updateSystemPreferences);
    reducedMotionQuery.addEventListener('change', updateSystemPreferences);

    return () => {
      darkModeQuery.removeEventListener('change', updateSystemPreferences);
      highContrastQuery.removeEventListener('change', updateSystemPreferences);
      reducedMotionQuery.removeEventListener('change', updateSystemPreferences);
    };
  }, []);

  const updateConfig = useCallback((updates: Partial<TransparentThemeConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
  }, []);

  const getButtonStyles = useCallback((variant: string = 'default') => {
    const baseStyles = `
      bg-transparent 
      backdrop-blur-[${config.blurIntensity}px] 
      transition-all duration-300 
      ${isReducedMotion ? '' : 'hover:scale-105 active:scale-95'}
    `;

    const variantStyles = {
      default: `
        border border-[${config.accentColor}]/30 
        text-[${config.accentColor}] 
        hover:bg-[${config.accentColor}]/${config.opacity * 100} 
        hover:border-[${config.accentColor}]/60 
        hover:shadow-[0_0_20px_${config.accentColor}30]
      `,
      outline: `
        border border-[#ffffff]/20 
        text-[#ffffff] 
        hover:bg-[#ffffff]/${config.opacity * 100} 
        hover:border-[#ffffff]/40
      `,
      ghost: `
        text-[#ffffff]/80 
        hover:bg-[#ffffff]/${config.opacity * 100} 
        hover:text-[#ffffff]
      `,
      destructive: `
        border border-red-500/30 
        text-red-400 
        hover:bg-red-500/${config.opacity * 100} 
        hover:border-red-500/60
      `,
    };

    return `${baseStyles} ${variantStyles[variant as keyof typeof variantStyles] || variantStyles.default}`;
  }, [config, isReducedMotion]);

  const getInputStyles = useCallback((variant: string = 'default') => {
    const baseStyles = `
      bg-transparent 
      backdrop-blur-[${config.blurIntensity}px] 
      transition-all duration-300
      ${isHighContrast ? 'border-2' : 'border'}
    `;

    const variantStyles = {
      default: `
        border-[#ffffff]/20 
        text-[#ffffff] 
        placeholder:text-[#ffffff]/60 
        hover:border-[#ffffff]/40 
        focus:border-[${config.accentColor}] 
        focus:shadow-[0_0_15px_${config.accentColor}30]
      `,
      search: `
        border-[${config.accentColor}]/30 
        text-[${config.accentColor}] 
        placeholder:text-[${config.accentColor}]/60 
        hover:border-[${config.accentColor}]/50 
        focus:border-[${config.accentColor}]
      `,
      password: `
        border-[#888888]/30 
        text-[#ffffff] 
        placeholder:text-[#888888]/60 
        hover:border-[#888888]/50 
        focus:border-[${config.accentColor}]
      `,
    };

    return `${baseStyles} ${variantStyles[variant as keyof typeof variantStyles] || variantStyles.default}`;
  }, [config, isHighContrast]);

  const getCardStyles = useCallback((variant: string = 'default') => {
    const baseStyles = `
      bg-transparent 
      backdrop-blur-[${config.blurIntensity * 1.5}px] 
      transition-all duration-300
      ${isHighContrast ? 'border-2' : 'border'}
    `;

    const variantStyles = {
      default: `
        border-[#ffffff]/15 
        hover:border-[${config.accentColor}]/30 
        hover:shadow-[0_0_20px_${config.accentColor}10]
      `,
      glass: `
        border-[#ffffff]/10 
        hover:border-[#ffffff]/20 
        hover:bg-[#ffffff]/${config.opacity * 50}
      `,
      glow: `
        border-[${config.accentColor}]/20 
        hover:border-[${config.accentColor}]/50 
        hover:shadow-[0_0_30px_${config.accentColor}20]
      `,
      minimal: `
        border-[#888888]/20 
        hover:border-[#888888]/40
      `,
    };

    return `${baseStyles} ${variantStyles[variant as keyof typeof variantStyles] || variantStyles.default}`;
  }, [config, isHighContrast]);

  return {
    config,
    updateConfig,
    resetConfig,
    getButtonStyles,
    getInputStyles,
    getCardStyles,
    isHighContrast,
    isReducedMotion,
  };
};

// Hook for managing focus states with transparent backgrounds
export const useTransparentFocus = () => {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setFocusedElement(target.id || target.className);
      }
    };

    const handleBlur = () => {
      setFocusedElement(null);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  const getFocusStyles = useCallback((elementId: string) => {
    if (focusedElement === elementId) {
      return 'ring-2 ring-[#1dff00] ring-offset-2 ring-offset-transparent';
    }
    return '';
  }, [focusedElement]);

  return { focusedElement, getFocusStyles };
};

// Hook for managing hover states with transparent backgrounds
export const useTransparentHover = () => {
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const handleMouseEnter = useCallback((elementId: string) => {
    setHoveredElement(elementId);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredElement(null);
  }, []);

  const getHoverStyles = useCallback((elementId: string) => {
    if (hoveredElement === elementId) {
      return 'transform scale-105 shadow-lg';
    }
    return '';
  }, [hoveredElement]);

  return { hoveredElement, handleMouseEnter, handleMouseLeave, getHoverStyles };
};

export default useTransparentTheme;