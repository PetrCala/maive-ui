import { useRouter } from "next/navigation";
import { DataProcessingService } from "@src/services/dataProcessingService";
import CONST from "@src/CONST";

type DemoButtonProps = {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
};

export default function DemoButton({
  isLoading,
  setIsLoading,
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
    <button
      onClick={() => {
        void handleDemoClick();
      }}
      disabled={isLoading}
      className="btn-secondary text-base px-6 py-3 inline-flex items-center gap-2 hover:bg-primary/10 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {isLoading ? "Loading..." : "Demo"}
    </button>
  );
}
