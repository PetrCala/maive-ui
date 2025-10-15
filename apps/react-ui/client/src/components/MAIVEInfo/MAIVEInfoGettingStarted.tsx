import ActionButton from "@components/Buttons/ActionButton";
import DemoButton from "@components/Buttons/DemoButton";
import SectionHeading from "@src/components/SectionHeading";
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
      <SectionHeading
        level="h3"
        text={TEXT.maiveModal.gettingStarted.title}
        className="mb-3"
      />
      <p className="text-secondary leading-relaxed mb-4">
        {TEXT.maiveModal.gettingStarted.text}
      </p>
      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        <DemoButton
          size="md"
          className="w-full sm:w-auto"
          shouldShowIcon={shouldShowIcon}
        />
        <ActionButton
          href="/upload"
          variant="primary"
          size="md"
          className="w-full sm:w-auto"
        >
          {TEXT.maiveModal.uploadYourData}
        </ActionButton>
      </div>
    </section>
  );
}
