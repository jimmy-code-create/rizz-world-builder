// Rizz library sheet: media gallery with camera/upload tiles, recent/uploads/
// saved tabs, multi-select numbered badges, drag-to-expand, and floating
// action pills for Photo / Poll / Schedule / Files.

import { useCallback, useRef, useState } from 'react';

interface RizzLibrarySheetProps {
  open: boolean;
  onClose: () => void;
  onPhoto: () => void;
  onPoll: () => void;
  onSchedule: () => void;
  onFiles: () => void;
}

type Tab = 'recent' | 'uploads' | 'saved';

export function RizzLibrarySheet({
  open,
  onClose,
  onPhoto,
  onPoll,
  onSchedule,
  onFiles,
}: RizzLibrarySheetProps) {
  const [tab, setTab] = useState<Tab>('recent');
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length < 10 ? [...prev, id] : prev,
    );
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);

  if (!open) return null;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        padding: 16,
        borderRadius: expanded ? 0 : 16,
        boxShadow: expanded ? '0 0 0 9999px rgba(0,0,0,0.5)' : undefined,
        transition: 'border-radius 0.2s ease, height 0.2s ease',
        height: expanded ? '100vh' : '50%',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={onPhoto}>
          Photo
        </button>
        <button type="button" onClick={onPoll}>
          Poll
        </button>
        <button type="button" onClick={onSchedule}>
          Schedule
        </button>
        <button type="button" onClick={onFiles}>
          Files
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setTab('recent')} aria-pressed={tab === 'recent'}>
          Recent
        </button>
        <button type="button" onClick={() => setTab('uploads')} aria-pressed={tab === 'uploads'}>
          Uploads
        </button>
        <button type="button" onClick={() => setTab('saved')} aria-pressed={tab === 'saved'}>
          Saved
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => {
          const id = `item-${i}`;
          const chosen = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={chosen}
              onClick={() => toggleSelect(id)}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 8,
                border: chosen ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {chosen ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '2px 6px',
                    fontSize: 12,
                  }}
                >
                  {selected.indexOf(id) + 1}
                </span>
              ) : null}
              <span style={{ fontSize: 24 }}>{String.fromCodePoint(0x1F4F7 + i)}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
        <button type="button" onClick={clearSelection} disabled={selected.length === 0}>
          Clear ({selected.length})
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
