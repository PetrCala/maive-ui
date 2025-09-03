import type { ComponentType } from "react";
import { useState } from "react";
import HoverableIconButton from "@src/components/Buttons/HoverableIconButton";
import MAIVEInfoModal from "@src/components/MAIVEInfoModal";
import { FaQuestionCircle } from "react-icons/fa";

type HelpButtonProps = {
  onPress?: () => void;
  modalComponent?: ComponentType<{ isOpen: boolean; onClose: () => void }>;
  className?: string;
  buttonClassName?: string;
};

export default function HelpButton({
  onPress,
  modalComponent: ModalComponent = MAIVEInfoModal,
  className = "",
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
        className={className}
        buttonClassName={buttonClassName}
        icon={<FaQuestionCircle />}
      />
      <ModalComponent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
