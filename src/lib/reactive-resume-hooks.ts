export const useTheme = () => {
  return { isDarkMode: false };
};

export const useDebouncedValue = <T,>(value: T, _delay = 300): T => value;

export const useBreakpoint = () => {
  // Simple desktop detection; SSR-safe
  const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  return { isDesktop };
};
