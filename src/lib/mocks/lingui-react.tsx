import * as React from "react";

export const I18nProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Trans = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const useLingui = () => ({ i18n: { _: (id: string) => id } });
