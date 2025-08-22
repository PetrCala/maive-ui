import { pingService } from "@src/api/services/pingService";
import { useCallback } from "react";

/**
 * A button that pings the server and alerts the user with the status and time.
 * @returns A button that pings the server and alerts the user with the status and time.
 */
export default function PingButton() {
  const pingServer = useCallback(async () => {
    try {
      // This is a client-side call to the server-side API
      // For server-side, use the pingClient function
      const response = await pingService.ping();
      console.log(response);
      alert(`Status: ${response.status}, Time: ${response.time}`);
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : "Failed to ping server"}`,
      );
    }
  }, []);

  return (
    <button
      onClick={() => void pingServer()}
      className="fixed bottom-12 right-8 mr-2 px-6 py-3 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
    >
      Ping Server
    </button>
  );
}
