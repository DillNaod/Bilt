import React from "react";
import * as Dialog from "@radix-ui/react-dialog";

export function ConfirmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Confirm Delete</Dialog.Title>
          <Dialog.Description>Are you sure you want to delete this resource?</Dialog.Description>
          <button onClick={() => onOpenChange(false)}>Cancel</button>
          <button onClick={() => onOpenChange(false)}>Delete</button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
