// src/providers/index.tsx
import React from "react";
import { ThemeProvider } from "./ThemeProvider";
import { GlobalAlertProvider } from "@src/components/GlobalAlertProvider";
import { ParameterAlertProvider } from "@src/components/ParameterAlertProvider";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <GlobalAlertProvider>
        <ParameterAlertProvider>{children}</ParameterAlertProvider>
      </GlobalAlertProvider>
    </ThemeProvider>
  );
};
