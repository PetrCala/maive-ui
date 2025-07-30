import MAIVEInfoModal from "@components/MAIVEInfoModal";
import { useState, ComponentType } from "react";

interface HelpButtonProps {
  onPress?: () => void;
  modalComponent?: ComponentType<{ isOpen: boolean; onClose: () => void }>;
  className?: string;
}

export default function HelpButton({
  onPress,
  modalComponent: ModalComponent = MAIVEInfoModal,
  className = "",
}: HelpButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultOnPress = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={onPress || defaultOnPress}
        className={`p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group ${className}`}
      >
        <svg
          className="w-6 h-6 group-hover:scale-110 transition-transform duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
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
        </svg>
      </button>
      <ModalComponent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
