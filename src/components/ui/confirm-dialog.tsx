import React from "react";
import { Button } from "./button";
import Modal from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="text-[#cfcfcf] text-sm mb-4">{message}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>{cancelText}</Button>
        <Button variant="destructive" onClick={onConfirm}>{confirmText}</Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
