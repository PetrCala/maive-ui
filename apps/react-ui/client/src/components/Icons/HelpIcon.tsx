import type { ComponentType } from "react";
import { useState } from "react";
import HoverableIconButton from "@src/components/Buttons/HoverableIconButton";
import MAIVEInfoModal from "@src/components/MAIVEInfoModal";

type HelpButtonProps = {
  onPress?: () => void;
  modalComponent?: ComponentType<{ isOpen: boolean; onClose: () => void }>;
  className?: string;
  buttonClassName?: string;
};

export default function HelpButton({
  onPress,
  modalComponent: ModalComponent = MAIVEInfoModal,
  buttonClassName = "",
}: HelpButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultOnPress = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <HoverableIconButton
        ariaLabel="Help"
        onClick={onPress ?? defaultOnPress}
        buttonClassName={buttonClassName}
        svgContent={
          <>
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
            />
            <line
              x1="12"
              y1="17"
              x2="12.01"
              y2="17"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </>
        }
      />
      <ModalComponent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
