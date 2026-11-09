import Head from "next/head";
import Link from "next/link";
import PingButton from "@src/components/Buttons/PingButton";
import ActionButton from "@src/components/Buttons/ActionButton";
import Alert from "@src/components/Alert";
import { useState, useEffect } from "react";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import TEXT from "@src/lib/text";
import DemoButton from "@src/components/Buttons/DemoButton";
import { useRunsStore } from "@src/store/runsStore";
import { FaInfoCircle } from "react-icons/fa";

const PENDING_STATUSES = ["queued", "running"];

// Search title, snippet and shared-link preview for the landing page (#596).
// Inner pages keep `${APP_DISPLAY_NAME} - <Page>`; only the home page carries
// the long form and the Open Graph tags.
const TITLE =
  "EasyMeta: MAIVE meta-analysis corrected for p-hacking and publication bias";
const DESCRIPTION =
  "Free web app and API, no account needed. Runs MAIVE (Nature Communications, 2025) " +
  "beside PET-PEESE, EK and RTMA, with R code to reproduce the results.";
// Same base as the canonical link (CanonicalLink.tsx), so the preview URL and
// the canonical never drift apart.
const HOME_URL = `${CONST.LINKS.APP.WEBSITE}/`;

type StatusBannerResponse = {
  show: boolean;
  message: string;
};

const DEFAULT_BANNER_MESSAGE =
  "The current release may be unstable. Please proceed with caution.";

const isStatusBannerResponse = (
  payload: unknown,
): payload is StatusBannerResponse => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const data = payload as Partial<Record<keyof StatusBannerResponse, unknown>>;

  return typeof data.show === "boolean" && typeof data.message === "string";
};

export default function Home() {
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [isLoadingUploadPage, setIsLoadingUploadPage] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string>("");
  const [shouldShowBanner, setShouldShowBanner] = useState(false);
  const [hasDismissedBanner, setHasDismissedBanner] = useState(false);

  // The home page has no header, so this is the only path back to past runs for
  // a returning user. Shown only when there is something to see (runs are
  // per-browser); the count comes from the same store the header badge uses.
  const runsList = useRunsStore((state) => state.runsList);
  const activeRunCount = runsList.filter((run) =>
    PENDING_STATUSES.includes(run.status),
  ).length;
  const showMyRuns = CONFIG.ASYNC_RUNS_ENABLED && runsList.length > 0;

  useEffect(() => {
    setIsDevelopment(process.env.NODE_ENV === "development");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadBannerState = async () => {
      try {
        const response = await fetch("/api/system-status", {
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as unknown;

        if (!isStatusBannerResponse(payload)) {
          return;
        }

        if (payload.show) {
          setBannerMessage(payload.message || DEFAULT_BANNER_MESSAGE);
          setShouldShowBanner(true);
          setHasDismissedBanner(false);
        } else {
          setShouldShowBanner(false);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
      }
    };

    void loadBannerState();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={HOME_URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta name="twitter:card" content="summary" />
      </Head>
      <main className="home-page-container">
        <div className="page-shell text-center animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-primary tracking-tight">
            {TEXT.home.title}
          </h1>
          {/* text-lg at every width: at sm:text-xl the longer lead line (#596) came
              out as wide as the H1 and flattened the hero's inverted-funnel taper. */}
          <p className="text-lg mb-8 sm:mb-12 text-secondary leading-relaxed">
            Estimate the mean effect corrected for publication bias, p-hacking,
            and spurious precision.
            <br />
            Powered by the MAIVE estimator (
            <em>
              <Link
                href="https://doi.org/10.1038/s41467-025-63261-0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-current no-underline"
              >
                Nature Communications
              </Link>
            </em>
            ).
          </p>

          <div className="flex flex-col gap-4 justify-center items-center mb-8 w-full max-w-md sm:max-w-lg mx-auto">
            <ActionButton
              href="/upload"
              onClick={() => setIsLoadingUploadPage(true)}
              variant="primary"
              size="lg"
              className={`w-full sm:w-auto self-center px-8 sm:px-12 lg:px-20 ${
                isLoadingUploadPage ? "opacity-75" : "opacity-100"
              }`}
            >
              {TEXT.home.uploadYourData}
            </ActionButton>

            <ActionButton
              href="/about"
              variant="secondary"
              size="md"
              className="inline-flex w-full sm:w-auto self-center items-center justify-center gap-2 px-4 sm:px-6"
            >
              <FaInfoCircle className="icon-button" />
              {TEXT.home.whatIsMaive}
            </ActionButton>

            <DemoButton
              size="md"
              className="w-full sm:w-auto self-center px-4 sm:px-6"
              shouldShowIcon={true}
            />
          </div>

          {showMyRuns && (
            <Link
              href="/runs"
              className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
            >
              {activeRunCount > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                  </span>
                  {`${activeRunCount} run${activeRunCount === 1 ? "" : "s"} in progress: view My Runs`}
                </>
              ) : (
                `View My Runs (${runsList.length})`
              )}
            </Link>
          )}

          {/* Two short centred lines rather than one (#596): a single line is
              wider than the primary button and reads as a base under the funnel
              instead of its tip. The margin only separates it from the My Runs
              link above; otherwise the buttons' own mb-8 is the gap. */}
          <p className={`text-sm text-muted ${showMyRuns ? "mt-4" : ""}`}>
            Free, no account &nbsp;·&nbsp; PET-PEESE, EK and RTMA too
            <br />
            Reproducible R code &nbsp;·&nbsp;{" "}
            <Link
              href={CONST.LINKS.PUBLIC_API.DOCS_ROUTE}
              className="underline"
            >
              Public API
            </Link>
          </p>
        </div>

        {isDevelopment && <PingButton />}
      </main>

      {shouldShowBanner && !hasDismissedBanner && (
        <Alert
          message={bannerMessage}
          type={CONST.ALERT_TYPES.WARNING}
          standalone
          role="status"
          onClick={() => setHasDismissedBanner(true)}
        />
      )}
    </>
  );
}
