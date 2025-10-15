import MDXContent from "@context/MDXContent";
import TEXT from "@lib/text";
import CONST from "@src/CONST";
import Link from "next/link";
import SectionHeading from "@src/components/SectionHeading";

type MAIVEInfoContentProps = {
  className?: string;
};

export default function MAIVEInfoContent({
  className = "",
}: MAIVEInfoContentProps) {
  return (
    <div className={`space-y-8 ${className}`}>
      <section>
        <SectionHeading level="h3" className="mb-3">
          {TEXT.maiveModal.overview.title}
        </SectionHeading>
        <div className="text-secondary leading-relaxed">
          <MDXContent source={TEXT.maiveModal.overview.text} lineMargin={4} />
        </div>
      </section>

      <section>
        <SectionHeading level="h3" className="mb-3">
          {TEXT.maiveModal.howItWorks.title}
        </SectionHeading>
        <div className="space-y-3 text-secondary">
          {TEXT.maiveModal.howItWorks.text.map((step, index) => (
            <div key={index} className="leading-relaxed">
              <MDXContent source={step} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading level="h3" className="mb-3">
          {TEXT.maiveModal.keyFeatures.title}
        </SectionHeading>
        <ul className="list-disc list-inside space-y-2 text-secondary">
          {TEXT.maiveModal.keyFeatures.text.map((feature) => (
            <li key={feature.head}>
              <strong>{feature.head}:</strong> {feature.text}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading level="h3" className="mb-3">
          {TEXT.maiveModal.applications.title}
        </SectionHeading>
        <div className="grid md:grid-cols-2 gap-4">
          {TEXT.maiveModal.applications.text.map((application) => (
            <div
              key={application.head}
              className="bg-surface-secondary p-4 rounded-lg"
            >
              <h4 className="font-semibold text-primary mb-2">
                {application.head}
              </h4>
              <p className="text-sm text-muted">{application.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading level="h3" className="mb-3">
          {TEXT.maiveModal.papersAndResources.title}
        </SectionHeading>
        <div className="space-y-3">
          <div className="border-l-4 border-primary-500 pl-4">
            <h4 className="font-semibold text-primary">
              {TEXT.maiveModal.papersAndResources.maiveWebsite.head}
            </h4>
            <p className="text-sm text-muted mb-2">
              {TEXT.maiveModal.papersAndResources.maiveWebsite.text}
            </p>
            <Link
              href={CONST.LINKS.MAIVE.WEBSITE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline text-sm interactive"
            >
              {TEXT.maiveModal.papersAndResources.maiveWebsite.linkText}
            </Link>
          </div>
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold text-primary">
              {TEXT.maiveModal.papersAndResources.maivePaper.head}
            </h4>
            <p className="text-sm text-muted mb-2">
              {TEXT.maiveModal.papersAndResources.maivePaper.text}
            </p>
            <Link
              href={CONST.LINKS.MAIVE.PAPER}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:underline text-sm interactive"
            >
              {TEXT.maiveModal.papersAndResources.maivePaper.linkText}
            </Link>
          </div>
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold text-primary">
              {TEXT.maiveModal.papersAndResources.maiveCode.head}
            </h4>
            <p className="text-sm text-muted mb-2">
              {TEXT.maiveModal.papersAndResources.maiveCode.text}
            </p>
            <Link
              href={CONST.LINKS.MAIVE.GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline text-sm interactive"
            >
              {TEXT.maiveModal.papersAndResources.maiveCode.linkText}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
