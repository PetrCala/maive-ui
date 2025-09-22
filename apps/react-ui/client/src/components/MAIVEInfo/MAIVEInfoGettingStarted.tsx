import ActionButton from "@components/Buttons/ActionButton";
import DemoButton from "@components/Buttons/DemoButton";
import TEXT from "@lib/text";

type MAIVEInfoGettingStartedProps = {
  className?: string;
  shouldShowIcon?: boolean;
};

export default function MAIVEInfoGettingStarted({
  className = "",
  shouldShowIcon = true,
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
        <DemoButton
          size="md"
          className="w-full sm:w-auto"
          shouldShowIcon={shouldShowIcon}
        />
        <ActionButton href="/upload" variant="primary" size="md">
          {TEXT.maiveModal.uploadYourData}
        </ActionButton>
      </div>
    </section>
  );
}
