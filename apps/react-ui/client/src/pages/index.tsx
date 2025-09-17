import Head from "next/head";
import PingButton from "@src/components/Buttons/PingButton";
import { MAIVEInfoModal } from "@src/components/Modals";
import ActionButton from "@src/components/Buttons/ActionButton";
import { useState, useEffect } from "react";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import DemoButton from "@src/components/Buttons/DemoButton";
import LoadingCard from "@src/components/LoadingCard";
import { FaInfoCircle } from "react-icons/fa";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [isLoadingUploadPage, setIsLoadingUploadPage] = useState(false);
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
            <LoadingCard
              title="Loading Demo Data..."
              subtitle="Preparing your demo analysis"
              color="purple"
              size="md"
              className="mx-auto"
            />
          </div>
        ) : (
          <div className="max-w-4xl text-center animate-fade-in px-3 sm:px-0">
            <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-primary tracking-tight">
              {TEXT.home.title}
            </h1>
            <p className="text-lg sm:text-xl mb-8 sm:mb-12 text-secondary leading-relaxed">
              Adjust your data for publication bias, p-hacking, and spurious
              precision.
              <br />
              Powered by the MAIVE estimator (<em>Nature Communications</em>).
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
                onClick={() => setIsModalOpen(true)}
                variant="secondary"
                size="md"
                className="inline-flex w-full sm:w-auto self-center items-center justify-center gap-2 px-4 sm:px-6"
              >
                <FaInfoCircle className="icon-button" />
                {TEXT.home.whatIsMaive}
              </ActionButton>

              <DemoButton
                isLoading={isLoadingDemo}
                setIsLoading={setIsLoadingDemo}
                size="md"
                className="w-full sm:w-auto self-center px-4 sm:px-6"
              />
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
