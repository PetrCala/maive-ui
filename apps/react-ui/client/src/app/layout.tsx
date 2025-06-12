import "./globals.css"
import { ThemeProvider } from "./providers"

export const metadata = {
	title: "MAIVE Estimator",
	description: "Advanced data analysis and estimation tool",
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider>{children}</ThemeProvider>
			</body>
		</html>
	)
}
