import ActionButton from "@src/components/Buttons/ActionButton";
import TEXT from "@lib/text";
import BaseModal from "./BaseModal";
import SectionHeading from "@src/components/SectionHeading";
import VersionInfo from "@src/components/VersionInfo";
import {
  MAIVEInfoContent,
  MAIVEInfoGettingStarted,
} from "@components/MAIVEInfo";

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
        <SectionHeading level="h2">{TEXT.maiveModal.title}</SectionHeading>
      </div>

      <div className="p-6 flex flex-col h-full justify-between">
        <div className="space-y-6 flex-1 overflow-y-auto overscroll-contain">
          <MAIVEInfoContent />

          {!!shouldShowGettingStarted ? (
            <MAIVEInfoGettingStarted className="pt-2" />
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

        <VersionInfo className="text-right mt-4" />
      </div>
    </BaseModal>
  );
}
