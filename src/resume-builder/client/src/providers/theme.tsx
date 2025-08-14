import { useTheme } from "@reactive-resume/hooks";
import { useEffect } from "react";

type Props = { children: React.ReactNode };

export const ThemeProvider = ({ children }: Props) => {
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Listen for theme updates from parent (embedded mode)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // In dev, parent may be on a different port; trust message but check shape
      if (!event?.data || typeof event.data !== "object") return;

      if (event.data.type === "SET_THEME") {
        const { vars, dark } = event.data.payload ?? {};

        if (dark === true) document.documentElement.classList.add("dark");
        if (dark === false) document.documentElement.classList.remove("dark");

        if (vars && typeof vars === "object") {
          const root = document.documentElement.style;
          Object.entries(vars as Record<string, string>).forEach(([k, v]) => {
            try {
              root.setProperty(k, String(v));
            } catch {
              // ignore invalid CSS var names
            }
          });
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return children;
};
