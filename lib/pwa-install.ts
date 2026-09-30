export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallSnapshot = { installed: boolean; prompt: BeforeInstallPromptEvent | null };
const serverSnapshot: InstallSnapshot = { installed: false, prompt: null };
let snapshot: InstallSnapshot = serverSnapshot;
let listening = false;
const listeners = new Set<() => void>();

function emit(next: InstallSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

type InstallWindow = Window & { __azarmehrInstall?: BeforeInstallPromptEvent };

export function isIosBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function isAndroidBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

function ensureListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  if (isStandalone()) {
    emit({ installed: true, prompt: null });
    return;
  }
  const queued = (window as InstallWindow).__azarmehrInstall ?? null;
  if (queued) emit({ installed: false, prompt: queued });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    emit({ installed: false, prompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => emit({ installed: true, prompt: null }));
}

export function subscribePwaInstall(listener: () => void) {
  ensureListening();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallSnapshot() {
  return snapshot;
}

export function getPwaInstallServerSnapshot() {
  return serverSnapshot;
}

function takePrompt() {
  const win = window as InstallWindow;
  const queued = win.__azarmehrInstall ?? null;
  if (queued) delete win.__azarmehrInstall;
  return snapshot.prompt ?? queued;
}

/** Opens the browser's own install dialog. Must run inside the click. */
export async function promptPwaInstall() {
  const current = takePrompt();
  if (!current) return 'unavailable' as const;
  emit({ installed: false, prompt: null });
  try {
    await current.prompt();
    const choice = await current.userChoice;
    if (choice.outcome === 'accepted') {
      emit({ installed: true, prompt: null });
      return 'accepted' as const;
    }
    return 'dismissed' as const;
  } catch {
    return 'unavailable' as const;
  }
}

export type InstallOfferRecord = { dismissals: number; snoozeUntil: number };
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseInstallOffer(raw: string | null): InstallOfferRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<InstallOfferRecord>;
    const dismissals = Number(data.dismissals);
    const snoozeUntil = Number(data.snoozeUntil);
    if (!Number.isFinite(dismissals) || !Number.isFinite(snoozeUntil)) return null;
    return { dismissals, snoozeUntil };
  } catch {
    return null;
  }
}

export function shouldShowInstallOffer(record: InstallOfferRecord | null, now: number) {
  if (!record) return true;
  return now >= record.snoozeUntil;
}

/** First «بعداً» waits 7 days, the second 21, and later ones 90. */
export function snoozeInstallOffer(record: InstallOfferRecord | null, now: number): InstallOfferRecord {
  const dismissals = (record?.dismissals ?? 0) + 1;
  const days = dismissals >= 3 ? 90 : dismissals === 2 ? 21 : 7;
  return { dismissals, snoozeUntil: now + days * DAY_MS };
}

if (typeof window !== 'undefined') ensureListening();
