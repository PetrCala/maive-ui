import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import ParameterAlertStack from "./ParameterAlertStack";
import CONST from "@src/CONST";

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

  const showParameterAlert = useCallback((message: string) => {
    const id = `param-alert-${idCounterRef.current++}`;
    const newAlert: ParameterAlert = {
      id,
      message,
      timestamp: Date.now(),
    };

    setAlerts((prev) => [...prev, newAlert]);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
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
