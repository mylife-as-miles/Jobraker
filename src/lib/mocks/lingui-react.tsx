import React from "react";
import i18n from "./lingui-core";
export const I18nProvider: React.FC<{ i18n: typeof i18n; children: React.ReactNode }> = ({ children }) => <>{children}</>;
export default I18nProvider;
