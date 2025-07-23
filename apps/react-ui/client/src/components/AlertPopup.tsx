import Alert from "./Alert"

export type AlertLevel = "info" | "success" | "warning" | "error"

export interface AlertPopupProps {
  message: string
  type?: AlertLevel
  open: boolean
  onClose: () => void
  duration?: number // ms
}

const FADE_DURATION = 300 // ms

const AlertPopup = ({ message, type = "info", open, onClose, duration = 2500 }: AlertPopupProps) => {
  return open ? (
    <div
      style={{ pointerEvents: "auto", transition: `opacity ${FADE_DURATION}ms` }}
      className={`opacity-100 transition-opacity duration-300`}
    >
      <Alert
        message={message}
        type={type}
        standalone
        onClick={onClose}
      />
    </div>
  ) : null
}

export default AlertPopup 