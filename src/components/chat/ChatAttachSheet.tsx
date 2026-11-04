// Chat attach sheet: media picker with library mode support.
// Keeps DMs/groups behavior, adds library prop for richer attachment sheets.

import { useCallback } from 'react';

interface ChatAttachSheetProps {
  open: boolean;
  onClose: () => void;
  onSend: (items: unknown[]) => void;
  library?: boolean;
}

export function ChatAttachSheet({ open, onClose, onSend, library = false }: ChatAttachSheetProps) {
  const handleSelect = useCallback(
    (items: unknown[]) => {
      onSend(items);
      onClose();
    },
    [onSend, onClose],
  );

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Attach media">
      {library ? (
        <>
          <p>Library mode enabled.</p>
          <button type="button" onClick={() => handleSelect([])}>
            Open library
          </button>
        </>
      ) : (
        <>
          <p>Attach media</p>
          <button type="button" onClick={() => handleSelect([])}>
            Pick file
          </button>
        </>
      )}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
