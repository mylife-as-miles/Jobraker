// Theme utility functions for consistent transparent UI across the platform

export const transparentStyles = {
  // Base transparent styles
  base: {
    background: 'transparent',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  
  // Button variants with transparent backgrounds
  button: {
    default: 'bg-transparent border border-[#1dff00]/30 text-[#1dff00] hover:bg-[#1dff00]/10 hover:border-[#1dff00]/60 backdrop-blur-sm',
    outline: 'bg-transparent border border-[#ffffff]/20 text-[#ffffff] hover:bg-[#ffffff]/10 hover:border-[#ffffff]/40 backdrop-blur-sm',
    ghost: 'bg-transparent text-[#ffffff]/80 hover:bg-[#ffffff]/10 hover:text-[#ffffff] backdrop-blur-sm',
    destructive: 'bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 backdrop-blur-sm',
  },
  
  // Input variants with transparent backgrounds
  input: {
    default: 'bg-transparent border-[#ffffff]/20 text-[#ffffff] placeholder:text-[#ffffff]/60 hover:border-[#ffffff]/40 focus:border-[#1dff00] backdrop-blur-sm',
    search: 'bg-transparent border-[#1dff00]/30 text-[#1dff00] placeholder:text-[#1dff00]/60 hover:border-[#1dff00]/50 focus:border-[#1dff00] backdrop-blur-sm',
    password: 'bg-transparent border-[#888888]/30 text-[#ffffff] placeholder:text-[#888888]/60 hover:border-[#888888]/50 focus:border-[#1dff00] backdrop-blur-sm',
  },
  
  // Card variants with transparent backgrounds
  card: {
    default: 'bg-transparent border border-[#ffffff]/15 backdrop-blur-[25px] hover:border-[#1dff00]/30',
    glass: 'bg-transparent border border-[#ffffff]/10 backdrop-blur-[30px] hover:border-[#ffffff]/20',
    glow: 'bg-transparent border border-[#1dff00]/20 backdrop-blur-[20px] hover:border-[#1dff00]/50',
    minimal: 'bg-transparent border border-[#888888]/20 hover:border-[#888888]/40',
  }
};

// Function to get responsive transparent styles
export const getResponsiveTransparentStyles = (breakpoint: 'mobile' | 'tablet' | 'desktop') => {
  const baseStyles = transparentStyles.base;
  
  switch (breakpoint) {
    case 'mobile':
      return {
        ...baseStyles,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      };
    case 'tablet':
      return {
        ...baseStyles,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      };
    case 'desktop':
      return {
        ...baseStyles,
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
      };
    default:
      return baseStyles;
  }
};

// Function to apply theme-aware transparent styles
export const getThemeAwareStyles = (isDark: boolean = true) => {
  if (isDark) {
    return {
      text: 'text-[#ffffff]',
      textSecondary: 'text-[#ffffff]/80',
      textMuted: 'text-[#ffffff]/60',
      border: 'border-[#ffffff]/20',
      borderHover: 'hover:border-[#ffffff]/40',
      borderFocus: 'focus:border-[#1dff00]',
      accent: 'text-[#1dff00]',
      background: 'bg-transparent',
    };
  } else {
    return {
      text: 'text-[#000000]',
      textSecondary: 'text-[#000000]/80',
      textMuted: 'text-[#000000]/60',
      border: 'border-[#000000]/20',
      borderHover: 'hover:border-[#000000]/40',
      borderFocus: 'focus:border-[#1dff00]',
      accent: 'text-[#1dff00]',
      background: 'bg-transparent',
    };
  }
};

// Function to generate accessible contrast ratios
export const getAccessibleColors = (baseColor: string, opacity: number = 1) => {
  const colors = {
    primary: `rgba(29, 255, 0, ${opacity})`,
    secondary: `rgba(255, 255, 255, ${opacity * 0.8})`,
    muted: `rgba(255, 255, 255, ${opacity * 0.6})`,
    error: `rgba(239, 68, 68, ${opacity})`,
    warning: `rgba(234, 179, 8, ${opacity})`,
    success: `rgba(34, 197, 94, ${opacity})`,
    info: `rgba(59, 130, 246, ${opacity})`,
  };
  
  return colors[baseColor as keyof typeof colors] || colors.primary;
};

// Function to create ripple effect styles
export const createRippleEffect = () => ({
  position: 'relative' as const,
  overflow: 'hidden' as const,
  '&::before': {
    content: '""',
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.3)',
    transform: 'translate(-50%, -50%)',
    transition: 'width 0.3s, height 0.3s',
  },
  '&:active::before': {
    width: '300px',
    height: '300px',
  },
});

// Function to create glass morphism effect
export const createGlassMorphism = (blur: number = 20, opacity: number = 0.05) => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
});

// Function to create neumorphism effect
export const createNeumorphism = () => ({
  background: 'transparent',
  boxShadow: `
    inset 5px 5px 10px rgba(0, 0, 0, 0.2),
    inset -5px -5px 10px rgba(255, 255, 255, 0.1)
  `,
  border: '1px solid rgba(255, 255, 255, 0.1)',
});

// Function to create gradient border effect
export const createGradientBorder = (colors: string[] = ['#1dff00', '#0a8246']) => ({
  position: 'relative' as const,
  background: 'transparent',
  border: 'none',
  '&::before': {
    content: '""',
    position: 'absolute' as const,
    inset: 0,
    padding: '1px',
    background: `linear-gradient(45deg, ${colors.join(', ')})`,
    borderRadius: 'inherit',
    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    maskComposite: 'exclude',
    WebkitMaskComposite: 'xor',
  },
});

// Export all utilities
export default {
  transparentStyles,
  getResponsiveTransparentStyles,
  getThemeAwareStyles,
  getAccessibleColors,
  createRippleEffect,
  createGlassMorphism,
  createNeumorphism,
  createGradientBorder,
};