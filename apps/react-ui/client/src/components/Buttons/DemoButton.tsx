import ActionButton from "@src/components/Buttons/ActionButton";
import { FaPlay } from "react-icons/fa";

type DemoButtonProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function DemoButton({
  size = "md",
  className,
}: DemoButtonProps) {
  return (
    <ActionButton
      href="/demo"
      variant="secondary"
      size={size}
      className={`${className ?? ""} inline-flex gap-2`}
    >
      <FaPlay className="icon-button" />
      Run a demo
    </ActionButton>
  );
}
