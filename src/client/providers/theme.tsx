import { useEffect, useState } from "react";

type Props = { children: React.ReactNode };

export const ThemeProvider = ({ children }: Props) => {
  // Fallback: infer dark mode from document class if external hook isn't available
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Keep local state synced with document class changes
  useEffect(() => {
    const mo = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

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
