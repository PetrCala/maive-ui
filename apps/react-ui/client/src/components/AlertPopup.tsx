import { useEffect, useState, useRef } from "react";
import type { AlertType } from "@src/types/alert";
import Alert from "@src/components/Alert";
import CONST from "@src/CONST";

export type AlertPopupProps = {
  message: string;
  type?: AlertType;
  open: boolean;
  onClose: () => void;
  duration?: number; // ms
};

const FADE_IN_DURATION = 600; // ms
const FADE_OUT_DURATION = 300; // ms

const AlertPopup = ({
  message,
  type = CONST.ALERT_TYPES.INFO,
  open,
  onClose,
  duration = 2500,
}: AlertPopupProps) => {
  const [show, setShow] = useState(open);
  const [visible, setVisible] = useState(open);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fade in/out logic
  useEffect(() => {
    if (open) {
      setVisible(true);
      setTimeout(() => setShow(true), 10);
    } else {
      setShow(false);
      const timer = setTimeout(() => setVisible(false), FADE_OUT_DURATION);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (!open) {
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onClose();
    }, duration);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [open, onClose, duration]);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        pointerEvents: "auto",
        transition: `opacity ${show ? FADE_IN_DURATION : FADE_OUT_DURATION}ms`,
      }}
      className={show ? `opacity-100` : `opacity-0`}
    >
      <Alert message={message} type={type} standalone onClick={onClose} />
    </div>
  );
};

export default AlertPopup;
