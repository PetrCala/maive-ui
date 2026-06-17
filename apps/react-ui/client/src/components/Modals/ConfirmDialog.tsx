"use client";

import type { ReactNode } from "react";
import ActionButton from "@src/components/Buttons/ActionButton";
import SectionHeading from "@src/components/SectionHeading";
import BaseModal from "./BaseModal";

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "secondary" | "success" | "danger" | "purple";
};

/**
 * Small reusable confirmation dialog for destructive or irreversible actions.
 * Built on BaseModal + ActionButton so it inherits app theming, dark mode, and
 * escape-to-close. The confirm handler runs, then the dialog closes.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      maxHeight="max-h-[90vh]"
      showCloseButton={false}
    >
      <div className="p-6 space-y-4">
        <SectionHeading level="h2" text={title} />
        <div className="text-secondary text-sm">{message}</div>
        <div className="flex justify-end gap-3 pt-2">
          <ActionButton variant="secondary" size="sm" onClick={onClose}>
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant={confirmVariant}
            size="sm"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </BaseModal>
  );
}
