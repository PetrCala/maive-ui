import MDXContent from "@context/MDXContent";
import TEXT from "@lib/text";
import CONST from "@src/CONST";

interface MAIVEInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  shouldShowGettingStarted?: boolean;
}

export default function MAIVEInfoModal({
  isOpen,
  onClose,
  shouldShowGettingStarted = false,
}: MAIVEInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {TEXT.maiveModal.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {TEXT.maiveModal.overview.title}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              <MDXContent source={TEXT.maiveModal.overview.text} />
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {TEXT.maiveModal.howItWorks.title}
            </h3>
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              {TEXT.maiveModal.howItWorks.text.map((step, index) => (
                <p key={index} className="leading-relaxed">
                  <MDXContent source={step} />
                </p>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {TEXT.maiveModal.keyFeatures.title}
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              {TEXT.maiveModal.keyFeatures.text.map((feature) => (
                <li key={feature.head}>
                  <strong>{feature.head}:</strong> {feature.text}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {TEXT.maiveModal.applications.title}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {TEXT.maiveModal.applications.text.map((application) => (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {application.head}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {application.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {TEXT.maiveModal.papersAndResources.title}
            </h3>
            <div className="space-y-3">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {TEXT.maiveModal.papersAndResources.maiveWebsite.head}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {TEXT.maiveModal.papersAndResources.maiveWebsite.text}
                </p>
                <a
                  href={CONST.MAIVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  {TEXT.maiveModal.papersAndResources.maiveWebsite.linkText}
                </a>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {TEXT.maiveModal.papersAndResources.maivePaper.head}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {TEXT.maiveModal.papersAndResources.maivePaper.text}
                </p>
                <a
                  href={CONST.MAIVE_PAPER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-400 hover:underline text-sm"
                >
                  {TEXT.maiveModal.papersAndResources.maivePaper.linkText}
                </a>
              </div>
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {TEXT.maiveModal.papersAndResources.maiveCode.head}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {TEXT.maiveModal.papersAndResources.maiveCode.text}
                </p>
                <a
                  href={CONST.MAIVE_GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline text-sm"
                >
                  {TEXT.maiveModal.papersAndResources.maiveCode.linkText}
                </a>
              </div>
            </div>
          </section>

          {!!shouldShowGettingStarted ? (
            <section>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {TEXT.maiveModal.gettingStarted.title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                {TEXT.maiveModal.gettingStarted.text}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    window.location.href = "/upload";
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {TEXT.maiveModal.uploadYourData}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {TEXT.common.close}
                </button>
              </div>
            </section>
          ) : (
            <section>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
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
