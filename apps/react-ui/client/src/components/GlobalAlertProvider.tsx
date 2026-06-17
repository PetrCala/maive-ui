import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import AlertPopup from "./AlertPopup";
import type { AlertType } from "@src/types/alert";
import type { AlertAction } from "@src/components/Alert/types";
import CONST from "@src/CONST";

type GlobalAlertContextType = {
  showAlert: (
    message: string,
    type?: AlertType,
    duration?: number,
    action?: AlertAction,
  ) => void;
};

const GlobalAlertContext = createContext<GlobalAlertContextType | undefined>(
  undefined,
);

export const useGlobalAlert = () => {
  const ctx = useContext(GlobalAlertContext);
  if (!ctx) {
    throw new Error("useGlobalAlert must be used within GlobalAlertProvider");
  }
  return ctx;
};

export const GlobalAlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AlertType>(CONST.ALERT_TYPES.INFO);
  const [duration, setDuration] = useState(2500);
  const [action, setAction] = useState<AlertAction | undefined>(undefined);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showAlert = useCallback(
    (
      msg: string,
      lvl: AlertType = CONST.ALERT_TYPES.INFO,
      dur = 2500,
      act?: AlertAction,
    ) => {
      setMessage(msg);
      setType(lvl);
      setDuration(dur);
      setAction(act);
      setOpen(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setOpen(false), dur);
    },
    [],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return (
    <GlobalAlertContext.Provider
      value={useMemo(() => ({ showAlert }), [showAlert])}
    >
      {children}
      <AlertPopup
        message={message}
        type={type}
        open={open}
        onClose={handleClose}
        duration={duration}
        action={action}
      />
    </GlobalAlertContext.Provider>
  );
};
