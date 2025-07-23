// src/providers/index.tsx
import React from "react"
import { ThemeProvider } from "./ThemeProvider"
import { GlobalAlertProvider } from "@src/components/GlobalAlertProvider"

export const Providers = ({ children }: { children: React.ReactNode }) => {
	return (
		<ThemeProvider>
			<GlobalAlertProvider>
				{children}
			</GlobalAlertProvider>
		</ThemeProvider>
	)
}
