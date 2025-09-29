import type { AlertType } from "@src/types/alert";

type AlertProps = {
  message: string;
  type?: AlertType;
  className?: string;
  onClick?: () => void;
  standalone?: boolean;
  role?: "alert" | "status";
};

export type { AlertType, AlertProps };
