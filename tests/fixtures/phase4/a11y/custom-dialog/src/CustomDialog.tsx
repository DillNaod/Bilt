import React from "react";

export function CustomDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content">
        <h2>Unmanaged Modal</h2>
        <p>This modal does not trap focus and does not restore focus when closed.</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
