export const useTheme = () => {
  return { isDarkMode: false };
};

export const useDebouncedValue = <T,>(value: T, _delay = 300): T => value;
