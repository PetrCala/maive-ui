import BaseModal from "./BaseModal";
import SectionHeading from "@src/components/SectionHeading";

export default function ParametersHelpModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      maxHeight="max-h-[90vh]"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl"
    >
      <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
        <SectionHeading level="h2">
          Understanding the Model Parameters
        </SectionHeading>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          Model parameters are the options that you can choose to customize your
          model.
        </p>
      </div>
    </BaseModal>
  );
}
