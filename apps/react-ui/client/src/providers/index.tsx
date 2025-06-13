// src/providers/index.tsx
import React from "react"
import { ThemeProvider } from "./ThemeProvider"

export const Providers = ({ children }: { children: React.ReactNode }) => {
	return <ThemeProvider>{children}</ThemeProvider>
}
