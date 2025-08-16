import { TooltipProvider } from "@reactive-resume/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Outlet } from "react-router";

import { helmetContext } from "../constants/helmet";
import { queryClient } from "../libs/query-client";
import { DialogProvider } from "./dialog";
import { LocaleProvider } from "./locale";
import { ThemeProvider } from "./theme";
import { Toaster } from "./toaster";

const fallbackClient = new QueryClient();

export const Providers = () => (
  <LocaleProvider>
    <HelmetProvider context={helmetContext}>
      <QueryClientProvider client={queryClient ?? fallbackClient}>
        <ThemeProvider>
          <TooltipProvider>
            <DialogProvider>
              <Outlet />

              <Toaster />
            </DialogProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </LocaleProvider>
);
