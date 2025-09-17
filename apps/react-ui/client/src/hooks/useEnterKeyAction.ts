import { useEffect } from "react";

type UseEnterKeyActionOptions = {
  enabled?: boolean;
  preventDefault?: boolean;
  target?: Document | HTMLElement | null;
};

const isClient = typeof window !== "undefined";

export function useEnterKeyAction(
  callback: () => void,
  options: UseEnterKeyActionOptions = {},
) {
  const { enabled = true, preventDefault = false, target } = options;

  useEffect(() => {
    if (!enabled || !isClient) {
      return;
    }

    const eventTarget = target ?? document;

    if (!eventTarget) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) {
        return;
      }

      if (preventDefault) {
        event.preventDefault();
      }

      callback();
    };

    eventTarget.addEventListener("keydown", handleKeyDown);

    return () => {
      eventTarget.removeEventListener("keydown", handleKeyDown);
    };
  }, [callback, enabled, preventDefault, target]);
}
