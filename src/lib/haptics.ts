/**
 * Haptic Feedback Utility - Enhanced
 * 
 * Provides consistent haptic feedback across the app for premium feel.
 * Supports various interaction types with appropriate vibration patterns.
 */

type HapticPattern = 
  | 'light'      // Quick tap (10ms) - buttons, toggles
  | 'medium'     // Standard tap (15ms) - sends, reactions
  | 'heavy'      // Strong tap (25ms) - errors, important actions
  | 'success'    // Success pattern (10ms, 50ms, 10ms) - completed actions
  | 'error'      // Error pattern (50ms, 25ms, 50ms) - failed actions
  | 'selection'; // Selection change (5ms) - scrolling through options

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 15,
  heavy: 25,
  success: [10, 50, 10],
  error: [50, 25, 50],
  selection: 5,
};

/**
 * Trigger haptic feedback if supported by the device.
 * Safe to call on any device - gracefully degrades if not supported.
 */
export function haptic(pattern: HapticPattern = 'medium'): void {
  if (!navigator.vibrate) return;
  
  const vibration = PATTERNS[pattern];
  
  try {
    if (Array.isArray(vibration)) {
      navigator.vibrate(vibration);
    } else {
      navigator.vibrate(vibration);
    }
  } catch (error) {
    // Silently fail if vibration is blocked or unsupported
    console.debug('Haptic feedback not available:', error);
  }
}

/**
 * Haptic feedback for button presses
 */
export function hapticButton(): void {
  haptic('light');
}

/**
 * Haptic feedback for sending messages/posts
 */
export function hapticSend(): void {
  haptic('medium');
}

/**
 * Haptic feedback for reactions
 */
export function hapticReaction(): void {
  haptic('medium');
}

/**
 * Haptic feedback for successful actions
 */
export function hapticSuccess(): void {
  haptic('success');
}

/**
 * Haptic feedback for errors
 */
export function hapticError(): void {
  haptic('error');
}

/**
 * Haptic feedback for long press detection
 */
export function hapticLongPress(): void {
  haptic('heavy');
}

/**
 * Haptic feedback for story transitions
 */
export function hapticStoryTransition(): void {
  haptic('light');
}

/**
 * Haptic feedback for joining voice room
 */
export function hapticVoiceJoin(): void {
  haptic('success');
}

/**
 * Haptic feedback for leaving voice room
 */
export function hapticVoiceLeave(): void {
  haptic('medium');
}

/**
 * Haptic feedback for scrolling through items
 */
export function hapticSelection(): void {
  haptic('selection');
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * React hook for haptic feedback
 */
export function useHaptic() {
  return {
    button: hapticButton,
    send: hapticSend,
    reaction: hapticReaction,
    success: hapticSuccess,
    error: hapticError,
    longPress: hapticLongPress,
    storyTransition: hapticStoryTransition,
    voiceJoin: hapticVoiceJoin,
    voiceLeave: hapticVoiceLeave,
    selection: hapticSelection,
    isSupported: isHapticSupported(),
  };
}
