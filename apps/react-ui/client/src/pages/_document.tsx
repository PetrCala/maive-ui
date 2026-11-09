import { Html, Head, Main, NextScript } from "next/document";

/**
 * Minimal custom document, present only to put `lang="en"` on `<html>`
 * (#596). ThemeProvider toggles the `dark` class on `document.documentElement`
 * at runtime, which a static attribute here does not interfere with.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
