"use client";

import { Providers } from "@providers/index";
import "@styles/globals.css";
import type { AppProps } from "next/app";
import { usePathname } from "next/navigation";
import Header from "@components/Header";
import Footer from "@components/Footer";
import Script from "next/script";

export default function App({ Component, pageProps }: AppProps) {
  const pathname = usePathname();

  // Don't show header on the home page
  const isHomePage = pathname === "/";

  return (
    <Providers>
      <Script src="/runtime-config.js" />
      <div className="flex flex-col min-h-screen">
        {!isHomePage && <Header />}
        <main className="flex-1 flex-col">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>
    </Providers>
  );
}
