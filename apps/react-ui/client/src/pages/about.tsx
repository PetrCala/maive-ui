import Head from "next/head";
import TEXT from "@lib/text";
import CONST from "@src/CONST";
import {
  MAIVEInfoContent,
  MAIVEInfoGettingStarted,
} from "@components/MAIVEInfo";
import VersionInfo from "@components/VersionInfo";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - About MAIVE`}</title>
        <meta
          name="description"
          content="Learn how MAIVE corrects for publication bias, p-hacking, and spurious precision."
        />
      </Head>
      <div className="px-4 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto space-y-10">
          <header className="space-y-4 text-center sm:text-left">
            <p className="text-sm uppercase tracking-wide text-muted">
              Meta-Analysis Instrumental Variable Estimator
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-primary">
              {TEXT.maiveModal.title}
            </h1>
            <p className="text-lg text-secondary leading-relaxed max-w-3xl">
              Adjust your analyses for publication bias, p-hacking, and spurious
              precision using MAIVE. Explore the methodology, see where it
              shines, and access the resources that power the estimator.
            </p>
          </header>

          <section className="surface-elevated rounded-xl border border-primary/10 p-6 sm:p-8 space-y-8">
            <MAIVEInfoContent />
            <MAIVEInfoGettingStarted className="pt-2" shouldShowIcon={false} />
          </section>

          <div className="text-right">
            <VersionInfo />
          </div>
        </div>
      </div>
    </>
  );
}
