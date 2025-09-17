import MDXContent from "@context/MDXContent";
import ActionButton from "@src/components/Buttons/ActionButton";
import TEXT from "@lib/text";
import CONST from "@src/CONST";
import Link from "next/link";
import { version } from "../../../package.json";
import BaseModal from "./BaseModal";

type MAIVEInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  shouldShowGettingStarted?: boolean;
};

export default function MAIVEInfoModal({
  isOpen,
  onClose,
  shouldShowGettingStarted = false,
}: MAIVEInfoModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-4xl"
      maxHeight="max-h-[90vh]"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-primary">
        <h2 className="text-2xl font-bold text-primary">
          {TEXT.maiveModal.title}
        </h2>
      </div>

      <div className="p-6 flex flex-col h-full justify-between">
        <div className="space-y-6 flex-1 overflow-y-auto overscroll-contain">
          <section>
            <h3 className="text-xl font-semibold text-primary mb-3">
              {TEXT.maiveModal.overview.title}
            </h3>
            <div className="text-secondary leading-relaxed">
              <MDXContent
                source={TEXT.maiveModal.overview.text}
                lineMargin={4}
              />
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-primary mb-3">
              {TEXT.maiveModal.howItWorks.title}
            </h3>
            <div className="space-y-3 text-secondary">
              {TEXT.maiveModal.howItWorks.text.map((step, index) => (
                <div key={index} className="leading-relaxed">
                  <MDXContent source={step} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-primary mb-3">
              {TEXT.maiveModal.keyFeatures.title}
            </h3>
            <ul className="list-disc list-inside space-y-2 text-secondary">
              {TEXT.maiveModal.keyFeatures.text.map((feature) => (
                <li key={feature.head}>
                  <strong>{feature.head}:</strong> {feature.text}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-primary mb-3">
              {TEXT.maiveModal.applications.title}
            </h3>
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
            <h3 className="text-xl font-semibold text-primary mb-3">
              {TEXT.maiveModal.papersAndResources.title}
            </h3>
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

          {!!shouldShowGettingStarted ? (
            <section>
              <h3 className="text-xl font-semibold text-primary mb-3">
                {TEXT.maiveModal.gettingStarted.title}
              </h3>
              <p className="text-secondary leading-relaxed mb-4">
                {TEXT.maiveModal.gettingStarted.text}
              </p>
              <div className="flex gap-3">
                <ActionButton href="/upload" variant="primary" size="md">
                  {TEXT.maiveModal.uploadYourData}
                </ActionButton>
                <ActionButton onClick={onClose} variant="secondary" size="md">
                  {TEXT.common.close}
                </ActionButton>
              </div>
            </section>
          ) : (
            <section>
              <div className="flex gap-3">
                <ActionButton onClick={onClose} variant="secondary" size="md">
                  {TEXT.common.close}
                </ActionButton>
              </div>
            </section>
          )}
        </div>

        <div className="text-xs text-muted text-right mt-4">
          Version {version}
        </div>
      </div>
    </BaseModal>
  );
}
