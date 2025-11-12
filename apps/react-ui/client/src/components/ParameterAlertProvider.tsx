import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import ParameterAlertStack from "./ParameterAlertStack";
import CONFIG from "@src/CONFIG";

export type ParameterAlert = {
  id: string;
  message: string;
  timestamp: number;
};

type ParameterAlertContextType = {
  showParameterAlert: (message: string) => void;
};

const ParameterAlertContext = createContext<
  ParameterAlertContextType | undefined
>(undefined);

export const useParameterAlert = () => {
  const ctx = useContext(ParameterAlertContext);
  if (!ctx) {
    throw new Error(
      "useParameterAlert must be used within ParameterAlertProvider",
    );
  }
  return ctx;
};

export const ParameterAlertProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [alerts, setAlerts] = useState<ParameterAlert[]>([]);
  const idCounterRef = useRef(0);
  const timerRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showParameterAlert = useCallback((message: string) => {
    // Check if parameter alerts are enabled
    if (!CONFIG.PARAMETER_ALERTS.ENABLED) {
      return;
    }

    const id = `param-alert-${idCounterRef.current++}`;
    const newAlert: ParameterAlert = {
      id,
      message,
      timestamp: Date.now(),
    };

    setAlerts((prev) => [...prev, newAlert]);

    // Set up auto-dismiss if configured
    if (CONFIG.PARAMETER_ALERTS.AUTO_DISMISS) {
      const timer = setTimeout(() => {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
        timerRefs.current.delete(id);
      }, CONFIG.PARAMETER_ALERTS.AUTO_DISMISS_DURATION);
      timerRefs.current.set(id, timer);
    }
  }, []);

  const dismissAlert = useCallback((id: string) => {
    // Clear timer if exists
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => clearTimeout(timer));
      timerRefs.current.clear(); // eslint-disable-line react-hooks/exhaustive-deps
    };
  }, []);

  const contextValue = useMemo(
    () => ({ showParameterAlert }),
    [showParameterAlert],
  );

  return (
    <ParameterAlertContext.Provider value={contextValue}>
      {children}
      <ParameterAlertStack alerts={alerts} onDismiss={dismissAlert} />
    </ParameterAlertContext.Provider>
  );
};
