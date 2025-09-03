import { useRouter } from "next/navigation";
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

  const handleDemoClick = async () => {
    setIsLoading(true);
    try {
      const dataId = await DataProcessingService.processAndStoreMockDataByName(
        CONST.DEMO_MOCK_DATA_NAME,
      );
      router.push(`/model?dataId=${dataId}`);
    } catch (error) {
      console.error("Error loading demo data:", error);
      alert("Failed to load demo data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <ActionButton
      onClick={() => {
        void handleDemoClick();
      }}
      variant="purple"
      size={size}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? "Loading..." : "Run a demo"}
    </ActionButton>
  );
}
