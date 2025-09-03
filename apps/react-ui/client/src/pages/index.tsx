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
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col items-center w-full max-w-md mx-auto animate-fade-in">
              <svg
                className="animate-spin h-12 w-12 text-purple-600 dark:text-purple-400 mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              <span className="text-lg font-medium text-gray-700 dark:text-gray-200 text-center">
                Loading Demo Data...
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                Preparing your demo analysis
              </span>
            </div>
          </div>
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

            <div className="flex flex-col gap-4 justify-center items-center mb-8 w-fit mx-auto">
              <ActionButton
                href="/upload"
                variant="primary"
                size="lg"
                className="w-full px-20"
              >
                {TEXT.home.uploadYourData}
              </ActionButton>

              <DemoButton
                isLoading={isLoadingDemo}
                setIsLoading={setIsLoadingDemo}
                size="md"
                className="w-2/3"
              />

              <ActionButton
                onClick={() => setIsModalOpen(true)}
                variant="secondary"
                size="md"
                className="inline-flex gap-2 w-2/3"
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
