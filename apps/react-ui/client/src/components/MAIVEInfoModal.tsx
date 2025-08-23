import MDXContent from "@context/MDXContent";
import TEXT from "@lib/text";
import CONST from "@src/CONST";

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
  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50"
      onClick={handleOverlayClick}
    >
      <div
        className="modal-content max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={handleModalContentClick}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-primary">
          <h2 className="text-2xl font-bold text-primary">
            {TEXT.maiveModal.title}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-secondary transition-colors interactive"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
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
                <a
                  href={CONST.MAIVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline text-sm interactive"
                >
                  {TEXT.maiveModal.papersAndResources.maiveWebsite.linkText}
                </a>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-primary">
                  {TEXT.maiveModal.papersAndResources.maivePaper.head}
                </h4>
                <p className="text-sm text-muted mb-2">
                  {TEXT.maiveModal.papersAndResources.maivePaper.text}
                </p>
                <a
                  href={CONST.MAIVE_PAPER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline text-sm interactive"
                >
                  {TEXT.maiveModal.papersAndResources.maivePaper.linkText}
                </a>
              </div>
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-primary">
                  {TEXT.maiveModal.papersAndResources.maiveCode.head}
                </h4>
                <p className="text-sm text-muted mb-2">
                  {TEXT.maiveModal.papersAndResources.maiveCode.text}
                </p>
                <a
                  href={CONST.MAIVE_GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline text-sm interactive"
                >
                  {TEXT.maiveModal.papersAndResources.maiveCode.linkText}
                </a>
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
                <button
                  onClick={() => {
                    window.location.href = "/upload";
                  }}
                  className="btn-primary px-6 py-2"
                >
                  {TEXT.maiveModal.uploadYourData}
                </button>
                <button onClick={onClose} className="btn-secondary px-6 py-2">
                  {TEXT.common.close}
                </button>
              </div>
            </section>
          ) : (
            <section>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary px-6 py-2">
                  {TEXT.common.close}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
