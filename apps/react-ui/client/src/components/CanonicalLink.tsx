import Head from "next/head";
import { useRouter } from "next/router";
import CONST from "@src/CONST";

/**
 * Strip the query string and fragment from a Next.js `asPath`.
 * Exported for tests.
 */
export const canonicalPath = (asPath: string): string => {
  const path = asPath.split(/[?#]/, 1)[0];
  return path.startsWith("/") ? path : `/${path}`;
};

/**
 * `<link rel="canonical">` for every page (#571).
 *
 * The app answers on more than one hostname (the Lambda Function URL origin,
 * and any host a crawler reaches it through), so each page names its one
 * canonical address: `CONST.LINKS.APP.WEBSITE` plus the path, without the
 * query. Rendered from `_app.tsx`; `next/head` merges it with the page's own
 * `<Head>`.
 */
export default function CanonicalLink() {
  const { asPath } = useRouter();
  const href = `${CONST.LINKS.APP.WEBSITE}${canonicalPath(asPath)}`;

  return (
    <Head>
      <link rel="canonical" href={href} key="canonical" />
    </Head>
  );
}
