import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ReadySearchParams = {
  params: URLSearchParams;
  // False on the render that happens before the query string is known. Render a
  // placeholder while it is false rather than an empty state: "no ids were
  // given" and "the ids are not readable yet" are indistinguishable otherwise,
  // and only one of them should tell the user to go back and pick again.
  isReady: boolean;
};

/**
 * Read the URL query, distinguishing "empty" from "not known yet".
 *
 * `useSearchParams()` is an App Router hook. In the Pages Router it is backed by
 * the pages router, which does not know the query during the pre-hydration
 * render of a statically optimized page, so on a direct hit or a refresh it
 * yields an empty set for one render before filling in.
 *
 * The page recovers on its own, so this is not about correctness of the final
 * render. It is about what gets painted in the meantime: without the flag, a
 * hard load of /compare?jobIds=... paints "pick at least 2 runs" first, which
 * is a claim about the user's selection rather than about loading, and it is
 * wrong. `window.location.search` is authoritative as soon as the browser has
 * the URL, so it is read once on mount to close the gap.
 *
 * @returns The query parameters, and whether they can be trusted yet
 */
export function useReadySearchParams(): ReadySearchParams {
  const navigationParams = useSearchParams();
  const [locationParams, setLocationParams] = useState<URLSearchParams | null>(
    null,
  );

  useEffect(() => {
    setLocationParams(new URLSearchParams(window.location.search));
  }, []);

  // Prefer whichever source actually has something. The router's copy wins when
  // it is populated, so a client-side navigation that changes the query is
  // picked up; the mount-time snapshot cannot be.
  const hasNavigationParams =
    navigationParams != null && Array.from(navigationParams.keys()).length > 0;

  if (hasNavigationParams) {
    return { params: navigationParams, isReady: true };
  }
  if (locationParams) {
    return { params: locationParams, isReady: true };
  }
  return { params: new URLSearchParams(), isReady: false };
}
