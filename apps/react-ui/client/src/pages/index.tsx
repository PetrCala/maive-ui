import PingButton from "@src/components/Buttons/PingButton";
import MAIVEInfoModal from "@components/MAIVEInfoModal";
import Link from "next/link";
import Head from "next/head";
import { useState } from "react";
import CONST from "@src/CONST";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Welcome`}</title>
      </Head>
      <main className="home-page-container">
        <div className="max-w-2xl text-center animate-fade-in">
          <h1 className="text-5xl font-bold mb-6 text-primary tracking-tight">
            Welcome to {CONST.APP_DISPLAY_NAME}
          </h1>
          <p className="text-xl mb-12 text-secondary leading-relaxed">
            Check your data for spurious precision using the MAIVE estimator.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 justify-center items-center mb-8">
            <Link href="/upload" className="btn-primary text-white px-8 py-4">
              Upload Your Data
            </Link>

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
              What is MAIVE?
            </button>
          </div>
        </div>

        {process.env.NODE_ENV === "development" && <PingButton />}

        <MAIVEInfoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          shouldShowGettingStarted={true}
        />
      </main>
    </>
  );
}
