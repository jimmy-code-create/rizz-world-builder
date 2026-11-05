// Keeps the remembered mobile keyboard height used to size the emoji and
// Rizz Library sheets so they do not get clipped by the OS keyboard.

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'rizz:picker-keyboard-height:v1';
const DEFAULT_HEIGHT = 0;

type KeyboardHeightState = number;

function readStoredHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HEIGHT;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HEIGHT;
  } catch {
    return DEFAULT_HEIGHT;
  }
}

function writeStoredHeight(height: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(height));
  } catch {
    // Best-effort persistence.
  }
}

export function usePickerKeyboardHeight(initialHeight?: number): number {
  const stored = typeof initialHeight === 'number' ? initialHeight : readStoredHeight();
  const [height, setHeight] = useState<number>(stored);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const storedAgain = readStoredHeight();
    if (storedAgain > 0) {
      setHeight(storedAgain);
    }
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (height <= 0) return;
    writeStoredHeight(height);
  }, [height]);

  return height;
}

export const PICKER_MIN_HEIGHT = 220;
export const PICKER_MAX_HEIGHT = 520;
export function useStickyPickerHeight(defaultFallback = 360): number {
  const measured = usePickerKeyboardHeight();
  if (measured > 0) {
    return Math.min(Math.max(measured, PICKER_MIN_HEIGHT), PICKER_MAX_HEIGHT);
  }
  return defaultFallback;
}

export const PICKER_KEYBOARD_RESERVE = 12;
