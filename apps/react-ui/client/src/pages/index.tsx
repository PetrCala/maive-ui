import Head from "next/head";
import Link from "next/link";
import PingButton from "@src/components/Buttons/PingButton";
import ActionButton from "@src/components/Buttons/ActionButton";
import Alert from "@src/components/Alert";
import { useState, useEffect } from "react";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import DemoButton from "@src/components/Buttons/DemoButton";
import { FaInfoCircle } from "react-icons/fa";

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
        <title>{`${CONST.APP_DISPLAY_NAME} - Welcome`}</title>
      </Head>
      <main className="home-page-container">
        <div className="max-w-4xl text-center animate-fade-in px-3 sm:px-0">
          <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-primary tracking-tight">
            {TEXT.home.title}
          </h1>
          <p className="text-lg sm:text-xl mb-8 sm:mb-12 text-secondary leading-relaxed">
            Adjust your data for publication bias, p-hacking, and spurious
            precision.
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
