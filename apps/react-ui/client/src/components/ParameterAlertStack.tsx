import { useEffect, useState } from "react";
import Alert from "./Alert";
import CONST from "@src/CONST";
import type { ParameterAlert } from "./ParameterAlertProvider";

const MAX_VISIBLE_ALERTS = 3;
const FADE_IN_DURATION = 300;
const FADE_OUT_DURATION = 200;

type ParameterAlertStackProps = {
  alerts: ParameterAlert[];
  onDismiss: (id: string) => void;
};

type AlertState = {
  alert: ParameterAlert;
  show: boolean;
  removing: boolean;
};

const ParameterAlertStack = ({
  alerts,
  onDismiss,
}: ParameterAlertStackProps) => {
  const [alertStates, setAlertStates] = useState<Map<string, AlertState>>(
    new Map(),
  );

  // Update alert states when alerts array changes
  useEffect(() => {
    setAlertStates((prev) => {
      const newMap = new Map(prev);
      const currentAlertIds = new Set(alerts.map((a) => a.id));

      // Add new alerts
      alerts.forEach((alert) => {
        if (!newMap.has(alert.id)) {
          newMap.set(alert.id, {
            alert,
            show: false,
            removing: false,
          });
          // Trigger fade-in after a brief delay
          setTimeout(() => {
            setAlertStates((current) => {
              const updated = new Map(current);
              const existing = updated.get(alert.id);
              if (existing && !existing.removing) {
                updated.set(alert.id, { ...existing, show: true });
              }
              return updated;
            });
          }, 10);
        }
      });

      // Mark dismissed alerts for removal
      for (const [id, state] of newMap.entries()) {
        if (!currentAlertIds.has(id) && !state.removing) {
          newMap.set(id, { ...state, show: false, removing: true });
          // Remove after fade-out
          setTimeout(() => {
            setAlertStates((current) => {
              const updated = new Map(current);
              updated.delete(id);
              return updated;
            });
          }, FADE_OUT_DURATION);
        }
      }

      return newMap;
    });
  }, [alerts]);

  // Sort alerts by timestamp (newest first)
  const sortedAlerts = Array.from(alertStates.values())
    .filter((state) => !state.removing)
    .sort((a, b) => b.alert.timestamp - a.alert.timestamp);

  const visibleAlerts = sortedAlerts.slice(0, MAX_VISIBLE_ALERTS);
  const hiddenAlerts = sortedAlerts.slice(MAX_VISIBLE_ALERTS);

  if (sortedAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed left-6 bottom-6 z-50 flex flex-col-reverse gap-4 pointer-events-none">
      {/* Hidden alerts (behind) */}
      {hiddenAlerts.map(({ alert }) => (
        <div
          key={alert.id}
          className="pointer-events-auto opacity-30"
          style={{ zIndex: 40 }}
        >
          <Alert
            message={alert.message}
            type={CONST.ALERT_TYPES.INFO}
            standalone
            onClick={() => onDismiss(alert.id)}
          />
        </div>
      ))}

      {/* Visible alerts */}
      {visibleAlerts.map(({ alert, show }, index) => (
        <div
          key={alert.id}
          className="pointer-events-auto"
          style={{
            zIndex: 50 - index,
            transition: `opacity ${FADE_IN_DURATION}ms ease-in-out, transform ${FADE_IN_DURATION}ms ease-in-out`,
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <Alert
            message={alert.message}
            type={CONST.ALERT_TYPES.INFO}
            standalone
            onClick={() => onDismiss(alert.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default ParameterAlertStack;

