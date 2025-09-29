import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import LoadingCard from "@components/LoadingCard";
import ActionButton from "@components/Buttons/ActionButton";
import CONST from "@src/CONST";
import { DataProcessingService } from "@src/services/dataProcessingService";

const MINIMUM_VISIBLE_DURATION_MS = 400;

export default function DemoPage() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const minimumLoaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearPendingTimeout = useCallback(() => {
    if (minimumLoaderTimeoutRef.current) {
      clearTimeout(minimumLoaderTimeoutRef.current);
      minimumLoaderTimeoutRef.current = null;
    }
  }, []);

  const runDemo = useCallback(async () => {
    setHasError(false);
    setIsLoading(true);
    clearPendingTimeout();

    try {
      const startTime = performance.now();
      const dataId = await DataProcessingService.processAndStoreMockDataByName(
        CONST.DEMO_MOCK_DATA_NAME,
      );
      const elapsed = performance.now() - startTime;
      const remaining = MINIMUM_VISIBLE_DURATION_MS - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => {
          minimumLoaderTimeoutRef.current = setTimeout(() => {
            minimumLoaderTimeoutRef.current = null;
            resolve(undefined);
          }, remaining);
        });
      }

      router.push(`/model?dataId=${dataId}`);
    } catch (error) {
      console.error("Error loading demo data:", error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [clearPendingTimeout, router]);

  useEffect(() => {
    void runDemo();
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout, runDemo]);

  useEffect(() => {
    if (isLoading) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [isLoading]);

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Demo`}</title>
        <meta
          name="description"
          content="Load demo data to explore how MAIVE corrects for publication bias and p-hacking."
        />
      </Head>

      <main className="content-page-container">
        <div className="flex w-full flex-1 items-center justify-center px-4 py-12">
          {hasError ? (
            <div className="max-w-lg w-full space-y-4 text-center">
              <h1 className="text-3xl font-semibold text-primary">
                We couldn&apos;t load the demo
              </h1>
              <p className="text-secondary leading-relaxed">
                Something went wrong while preparing the demo dataset. Please
                try again, or return to the home page to continue exploring
                MAIVE.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <ActionButton
                  onClick={() => {
                    void runDemo();
                  }}
                  variant="primary"
                  size="md"
                >
                  Try again
                </ActionButton>
                <ActionButton href="/" variant="secondary" size="md">
                  Back to home
                </ActionButton>
              </div>
            </div>
          ) : (
            <LoadingCard
              title="Loading Demo Data..."
              subtitle="Preparing your demo analysis"
              color="purple"
              size="md"
              fullWidth={false}
              containerClassName="w-full max-w-md"
            />
          )}
        </div>
      </main>
    </>
  );
}
