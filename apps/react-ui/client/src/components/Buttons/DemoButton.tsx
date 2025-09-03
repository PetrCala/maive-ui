import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { DataProcessingService } from "@src/services/dataProcessingService";
import ActionButton from "@src/components/Buttons/ActionButton";
import CONST from "@src/CONST";

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleDemoClick = async () => {
    // Start the transition animation
    setIsTransitioning(true);

    // Wait for the transition animation to complete (300ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Now set loading state
    setIsLoading(true);

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
      setIsTransitioning(false);
    }
  };

  return (
    <ActionButton
      ref={buttonRef}
      onClick={() => {
        void handleDemoClick();
      }}
      variant="purple"
      size={size}
      disabled={isLoading || isTransitioning}
      className={`${className} transition-all duration-300 ${
        isTransitioning ? "scale-95 opacity-75" : "scale-100 opacity-100"
      }`}
    >
      {isTransitioning
        ? "Starting..."
        : isLoading
          ? "Loading..."
          : "Run a demo"}
    </ActionButton>
  );
}
