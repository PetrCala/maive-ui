import type { ReactNode } from "react";
import type { AlertType } from "@src/types/alert";

type AlertProps = {
  message: ReactNode;
  type?: AlertType;
  className?: string;
  onClick?: () => void;
  standalone?: boolean;
  role?: "alert" | "status";
  showCloseButton?: boolean;
};

export type { AlertType, AlertProps };
