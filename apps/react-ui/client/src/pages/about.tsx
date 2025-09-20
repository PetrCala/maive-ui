import Head from "next/head";
import TEXT from "@lib/text";
import CONST from "@src/CONST";
import {
  MAIVEInfoContent,
  MAIVEInfoGettingStarted,
} from "@components/MAIVEInfo";
import ActionButton from "@components/Buttons/ActionButton";
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
            <MAIVEInfoGettingStarted className="pt-2" />
          </section>

          <section className="surface-elevated rounded-xl border border-primary/10 p-6 sm:p-8 space-y-4">
            <h2 className="text-2xl font-semibold text-primary">
              Beyond the basics
            </h2>
            <p className="text-secondary leading-relaxed">
              Ready to dive deeper? Run the interactive demo to see MAIVE in
              action, or review your own data with the upload workflow. You can
              always open the in-app help modal from the header if you prefer a
              quick refresher without leaving your analysis.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton href="/demo" variant="secondary" size="md">
                Explore the demo
              </ActionButton>
              <ActionButton href="/upload" variant="primary" size="md">
                Start an analysis
              </ActionButton>
            </div>
          </section>

          <div className="text-right">
            <VersionInfo />
          </div>
        </div>
      </div>
    </>
  );
}
