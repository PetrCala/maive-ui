import ActionButton from "@components/Buttons/ActionButton";
import TEXT from "@lib/text";

type MAIVEInfoGettingStartedProps = {
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
};

export default function MAIVEInfoGettingStarted({
  onClose,
  showCloseButton = false,
  className = "",
}: MAIVEInfoGettingStartedProps) {
  return (
    <section className={className}>
      <h3 className="text-xl font-semibold text-primary mb-3">
        {TEXT.maiveModal.gettingStarted.title}
      </h3>
      <p className="text-secondary leading-relaxed mb-4">
        {TEXT.maiveModal.gettingStarted.text}
      </p>
      <div className="flex flex-wrap gap-3">
        <ActionButton href="/upload" variant="primary" size="md">
          {TEXT.maiveModal.uploadYourData}
        </ActionButton>
        {showCloseButton && (
          <ActionButton onClick={onClose} variant="secondary" size="md">
            {TEXT.common.close}
          </ActionButton>
        )}
      </div>
    </section>
  );
}
