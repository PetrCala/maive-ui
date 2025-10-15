import Head from "next/head";
import TEXT from "@lib/text";
import CONST from "@src/CONST";
import { GoBackButton } from "@src/components/Buttons";
import {
  MAIVEInfoContent,
  MAIVEInfoGettingStarted,
} from "@components/MAIVEInfo";
import VersionInfo from "@components/VersionInfo";
import SectionHeading from "@src/components/SectionHeading";

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
              <SectionHeading
                level="h1"
                text={TEXT.maiveModal.title}
                description={
                  shouldShowDescription
                    ? TEXT.maiveModal.description
                    : undefined
                }
              />
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
