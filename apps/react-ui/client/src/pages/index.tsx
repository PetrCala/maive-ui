import PingButton from "@src/components/Buttons/PingButton";
import MAIVEInfoModal from "@components/MAIVEInfoModal";
import Link from "next/link";
import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import { DemoService } from "@src/services/demoService";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsDevelopment(process.env.NODE_ENV === "development");
  }, []);

  const handleDemoClick = async () => {
    setIsLoadingDemo(true);
    try {
      const dataId = await DemoService.loadAndStoreDemoData();
      router.push(`/model?dataId=${dataId}`);
    } catch (error) {
      console.error("Error loading demo data:", error);
      alert("Failed to load demo data. Please try again.");
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Welcome`}</title>
      </Head>
      <main className="home-page-container">
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

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 justify-center items-center mb-8">
            <Link href="/upload" className="btn-primary text-white px-8 py-4">
              {TEXT.home.uploadYourData}
            </Link>

            <button
              onClick={() => {
                void handleDemoClick();
              }}
              disabled={isLoadingDemo}
              className="btn-secondary text-base px-6 py-3 inline-flex items-center gap-2 hover:bg-primary/10 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {isLoadingDemo ? "Loading Demo..." : "Demo"}
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-secondary text-base px-6 py-3 inline-flex items-center gap-2"
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
            </button>
          </div>
        </div>

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
