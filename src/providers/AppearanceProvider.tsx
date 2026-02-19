import React, { createContext, useContext } from "react";
import { useAppearanceSettings } from "../hooks/useAppearanceSettings";

const AppearanceContext = createContext<ReturnType<
  typeof useAppearanceSettings
> | null>(null);

export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const appearance = useAppearanceSettings();

  return (
    <AppearanceContext.Provider value={appearance}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    // Fallback if used outside provider, primarily for migration or testing
    // But ideally should throw or match behavior.
    // For now, throwing error to ensure correct usage.
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return context;
}
