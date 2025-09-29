import Head from "next/head";
import TEXT from "@lib/text";
import CONST from "@src/CONST";
import { GoBackButton } from "@src/components/Buttons";
import {
  MAIVEInfoContent,
  MAIVEInfoGettingStarted,
} from "@components/MAIVEInfo";
import VersionInfo from "@components/VersionInfo";

export default function AboutPage() {
  const shouldShowDescription = false;
  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - About MAIVE`}</title>
        <meta
          name="description"
          content="Learn how MAIVE corrects for publication bias, p-hacking, and spurious precision."
        />
      </Head>
      <main className="content-page-container">
        <div className="max-w-5xl w-full px-2 sm:px-0">
          <GoBackButton href="/" text="Back to Home" />

          <div className="card p-6 sm:p-8 space-y-8">
            <header className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold text-primary">
                {TEXT.maiveModal.title}
              </h1>
              {shouldShowDescription && (
                <p className="text-lg text-secondary leading-relaxed">
                  Adjust your meta-analysis for publication bias, p-hacking, and
                  spurious precision using MAIVE. Explore the methodology and
                  access the resources that power the estimator.
                </p>
              )}
            </header>

            <MAIVEInfoContent />
            <MAIVEInfoGettingStarted className="pt-2" shouldShowIcon={false} />
          </div>

          <div className="text-right mt-6">
            <VersionInfo />
          </div>
        </div>
      </main>
    </>
  );
}
