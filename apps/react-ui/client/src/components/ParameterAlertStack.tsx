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
      Array.from(newMap.entries()).forEach(([id, state]) => {
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
      });

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
    <div className="fixed left-6 bottom-6 z-50 pointer-events-none">
      <div className="relative">
        {/* Hidden alerts behind - shown as subtle stacked shadows */}
        {hiddenAlerts.length > 0 && (
          <>
            {hiddenAlerts.slice(0, 2).map((_, index) => (
              <div
                key={`shadow-${index}`}
                className="absolute left-0 right-0 bottom-0 bg-blue-100/30 dark:bg-blue-900/20 border border-blue-200/30 dark:border-blue-800/30 rounded-lg"
                style={{
                  height: "60px",
                  transform: `translateY(-${(index + 1) * 4}px) scale(${1 - (index + 1) * 0.02})`,
                  zIndex: 45 - index,
                  pointerEvents: "none",
                }}
              />
            ))}
          </>
        )}

        {/* Visible alerts stack */}
        <div className="relative flex flex-col-reverse gap-4">
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
                showCloseButton
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParameterAlertStack;
