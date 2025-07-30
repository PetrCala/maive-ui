"use client";

import { Providers } from "@providers/index";
import "@styles/globals.css";
import type { AppProps } from "next/app";
import { usePathname } from "next/navigation";
import Header from "@components/Header";

export default function App({ Component, pageProps }: AppProps) {
  const pathname = usePathname();

  // Don't show header on the home page
  const isHomePage = pathname === "/";

  return (
    <Providers>
      {!isHomePage && <Header className="absolute top-4 right-4 z-50" />}
      <Component {...pageProps} />
    </Providers>
  );
}
