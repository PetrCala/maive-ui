import { pingService } from "@src/api/services/pingService";
import { useCallback } from "react";
import ActionButton from "./ActionButton";

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
    <ActionButton
      onClick={() => void pingServer()}
      variant="purple"
      size="md"
      className="fixed bottom-12 right-8 mr-2"
    >
      Ping Server
    </ActionButton>
  );
}
