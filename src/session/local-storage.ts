import type { SessionFingerprint } from "@/contracts/session";

export const QUALIA_SESSION_DRAFT_KEY = "qualia:v1:session:draft";
export const QUALIA_SESSION_LAST_KEY = "qualia:v1:session:last";

interface SessionDraftPersistenceController {
  start: () => void;
  stop: () => void;
  flushNow: () => void;
  flushImportant: () => void;
}

export interface SessionDraftPersistenceControllerParams {
  getDraft: () => SessionFingerprint | null;
}

function getLocalStorageSafe(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionFingerprintLike(value: unknown): value is SessionFingerprint {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== "string") {
    return false;
  }
  if (typeof value.started_at !== "string") {
    return false;
  }
  if (typeof value.ended_at !== "string") {
    return false;
  }
  if (value.mode !== "free" && value.mode !== "song") {
    return false;
  }
  if (!Array.isArray(value.timeline)) {
    return false;
  }
  if (!isRecord(value.initial_preset)) {
    return false;
  }
  if (!isRecord(value.dominant_state)) {
    return false;
  }

  return true;
}

function readSessionFingerprint(key: string): SessionFingerprint | null {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isSessionFingerprintLike(parsed)) {
      try {
        storage.removeItem(key);
      } catch {
        // ignore storage cleanup failures
      }
      return null;
    }

    return parsed;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // ignore storage cleanup failures
    }
    return null;
  }
}

function writeSessionFingerprint(key: string, session: SessionFingerprint): void {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(session));
  } catch {
    // local persistence is best-effort and must not disrupt UX
  }
}

function clearStorageKey(key: string): void {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadSessionDraft(): SessionFingerprint | null {
  return readSessionFingerprint(QUALIA_SESSION_DRAFT_KEY);
}

export function saveSessionDraft(session: SessionFingerprint): void {
  writeSessionFingerprint(QUALIA_SESSION_DRAFT_KEY, session);
}

export function clearSessionDraft(): void {
  clearStorageKey(QUALIA_SESSION_DRAFT_KEY);
}

export function loadLastSession(): SessionFingerprint | null {
  return readSessionFingerprint(QUALIA_SESSION_LAST_KEY);
}

export function saveLastSession(session: SessionFingerprint): void {
  writeSessionFingerprint(QUALIA_SESSION_LAST_KEY, session);
}

export function createSessionDraftPersistenceController({
  getDraft,
}: SessionDraftPersistenceControllerParams): SessionDraftPersistenceController {
  let intervalId: number | null = null;
  let pagehideHandler: ((event: PageTransitionEvent) => void) | null = null;

  const flushNow = () => {
    const draft = getDraft();
    if (!draft || draft.ended_at !== "") {
      clearSessionDraft();
      return;
    }

    saveSessionDraft(draft);
  };

  const flushImportant = () => {
    flushNow();
  };

  const start = () => {
    if (typeof window === "undefined") {
      return;
    }
    if (intervalId !== null) {
      return;
    }

    pagehideHandler = () => {
      flushNow();
    };
    window.addEventListener("pagehide", pagehideHandler);
    intervalId = window.setInterval(flushNow, 60_000);
  };

  const stop = () => {
    flushNow();

    if (typeof window === "undefined") {
      intervalId = null;
      pagehideHandler = null;
      return;
    }

    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (pagehideHandler) {
      window.removeEventListener("pagehide", pagehideHandler);
      pagehideHandler = null;
    }
  };

  return {
    start,
    stop,
    flushNow,
    flushImportant,
  };
}

