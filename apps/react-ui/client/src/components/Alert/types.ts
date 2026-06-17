import type { ReactNode } from "react";
import type { AlertType } from "@src/types/alert";

// Optional call-to-action rendered inside an alert (e.g. "View results" on a
// run-finished toast). Kept generic so any caller can route as it sees fit.
type AlertAction = {
  label: string;
  onClick: () => void;
};

type AlertProps = {
  message: ReactNode;
  type?: AlertType;
  className?: string;
  onClick?: () => void;
  standalone?: boolean;
  role?: "alert" | "status";
  showCloseButton?: boolean;
  action?: AlertAction;
};

export type { AlertType, AlertProps, AlertAction };
