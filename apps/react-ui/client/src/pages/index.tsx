import Head from "next/head";
import PingButton from "@src/components/Buttons/PingButton";
import MAIVEInfoModal from "@components/MAIVEInfoModal";
import ActionButton from "@src/components/Buttons/ActionButton";
import { useState, useEffect } from "react";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import DemoButton from "@src/components/Buttons/DemoButton";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  useEffect(() => {
    setIsDevelopment(process.env.NODE_ENV === "development");
  }, []);

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Welcome`}</title>
      </Head>
      <main className="home-page-container">
        {isLoadingDemo ? (
          <div className="loading-overlay">Loading Demo...</div>
        ) : (
          <div className="max-w-4xl text-center animate-fade-in">
            <h1 className="text-5xl font-bold mb-6 text-primary tracking-tight">
              {TEXT.home.title}
            </h1>
            <p className="text-xl mb-12 text-secondary leading-relaxed">
              Adjust your data for publication bias, p-hacking, and spurious
              precision.
              <br />
              Powered by the MAIVE estimator (<em>Nature Communications</em>).
            </p>

            <div className="flex flex-col gap-4 justify-center items-center mb-8">
              <ActionButton
                href="/upload"
                variant="primary"
                size="lg"
                className="w-full max-w-xs"
              >
                {TEXT.home.uploadYourData}
              </ActionButton>

              <DemoButton
                isLoading={isLoadingDemo}
                setIsLoading={setIsLoadingDemo}
                size="md"
                className="inline-flex gap-2 w-full max-w-xs"
              />

              <ActionButton
                onClick={() => setIsModalOpen(true)}
                variant="secondary"
                size="md"
                className="inline-flex gap-2 w-full max-w-xs"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {TEXT.home.whatIsMaive}
              </ActionButton>
            </div>
          </div>
        )}

        {isDevelopment && <PingButton />}

        <MAIVEInfoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          shouldShowGettingStarted={true}
        />
      </main>
    </>
  );
}
