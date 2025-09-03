import { useRouter } from "next/navigation";
import { useRef } from "react";
import { DataProcessingService } from "@src/services/dataProcessingService";
import ActionButton from "@src/components/Buttons/ActionButton";
import CONST from "@src/CONST";
import { FaPlay } from "react-icons/fa";

type DemoButtonProps = {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function DemoButton({
  isLoading,
  setIsLoading,
  size = "md",
  className,
}: DemoButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleDemoClick = async () => {
    setIsLoading(true);

    // Wait for the transition animation to complete
    await new Promise((resolve) => setTimeout(resolve, 700));

    try {
      const dataId = await DataProcessingService.processAndStoreMockDataByName(
        CONST.DEMO_MOCK_DATA_NAME,
      );

      // Wait a bit more to ensure loading state is visible
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Navigate to model page
      router.push(`/model?dataId=${dataId}`);
    } catch (error) {
      console.error("Error loading demo data:", error);
      alert("Failed to load demo data. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <ActionButton
      ref={buttonRef}
      onClick={() => {
        void handleDemoClick();
      }}
      variant="secondary"
      size={size}
      disabled={isLoading}
      className={`${className} inline-flex gap-2 transition-all duration-300 ${
        isLoading ? "scale-95 opacity-75" : "scale-100 opacity-100"
      }`}
    >
      <FaPlay className="icon-button" />
      {`${isLoading ? "Loading..." : "Run a demo"}`}
    </ActionButton>
  );
}
