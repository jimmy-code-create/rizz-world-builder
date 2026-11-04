/**
 * First-run welcome state for the mobile shell.
 *
 * The app opens on the welcome flow before anyone has an account. The name is
 * kept locally so the login screen can greet them, and a separate flag records
 * that the feature tour was finished — a returning signed-out member should go
 * straight to "welcome back", not sit through the tour again.
 *
 * Every access is defensive: private browsing and the Capacitor WebView can
 * both throw while reading localStorage, and onboarding must still render when
 * storage is unavailable.
 */
const NAME_KEY = "rizz:welcome:name";
const SEEN_KEY = "rizz:welcome:seen";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export type WelcomeState = {
  name: string;
  seen: boolean;
};

export function readWelcomeState(): WelcomeState {
  const store = storage();
  if (!store) return { name: "", seen: false };
  try {
    return {
      name: (store.getItem(NAME_KEY) ?? "").trim().slice(0, 32),
      seen: store.getItem(SEEN_KEY) === "1",
    };
  } catch {
    return { name: "", seen: false };
  }
}

export function readWelcomeName(): string {
  return readWelcomeState().name;
}

export function rememberWelcomeName(name: string) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(NAME_KEY, name.trim().replace(/\s+/g, " ").slice(0, 32));
  } catch {
    // A blocked store must not stop someone entering the app.
  }
}

export function markWelcomeSeen() {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SEEN_KEY, "1");
  } catch {
    // Same as above: the flow still finishes.
  }
}

/** "Not you?" starts the intro over and clears the greeting. */
export function resetWelcome() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(NAME_KEY);
    store.removeItem(SEEN_KEY);
  } catch {
    // Nothing to recover from.
  }
}
