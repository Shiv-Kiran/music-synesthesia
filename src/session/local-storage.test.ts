import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VISUAL_STATE } from "@/contracts/defaults";
import { normalizeVisualState } from "@/contracts/normalize";
import type { SessionFingerprint } from "@/contracts/session";
import {
  QUALIA_SESSION_DRAFT_KEY,
  QUALIA_SESSION_LAST_KEY,
  clearSessionDraft,
  createSessionDraftPersistenceController,
  loadLastSession,
  loadSessionDraft,
  saveLastSession,
  saveSessionDraft,
} from "@/session/local-storage";

function makeSession(id = "test-session", endedAt = ""): SessionFingerprint {
  const visual = normalizeVisualState(DEFAULT_VISUAL_STATE, 1_000);
  return {
    id,
    started_at: new Date(1_000).toISOString(),
    ended_at: endedAt,
    mode: "free",
    timeline: [],
    initial_preset: visual,
    dominant_state: visual,
  };
}

describe("session local storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("saves, loads, and clears the draft session", () => {
    const session = makeSession("draft-1");
    saveSessionDraft(session);

    const loaded = loadSessionDraft();
    expect(loaded?.id).toBe("draft-1");

    clearSessionDraft();
    expect(loadSessionDraft()).toBeNull();
  });

  it("saves and loads the last finalized session", () => {
    const session = makeSession("last-1", new Date(5_000).toISOString());
    saveLastSession(session);

    const loaded = loadLastSession();
    expect(loaded?.id).toBe("last-1");
    expect(loaded?.ended_at).toBe(session.ended_at);
  });

  it("returns null and clears corrupt draft JSON", () => {
    window.localStorage.setItem(QUALIA_SESSION_DRAFT_KEY, "{bad json");

    expect(loadSessionDraft()).toBeNull();
    expect(window.localStorage.getItem(QUALIA_SESSION_DRAFT_KEY)).toBeNull();
  });

  it("is SSR-safe when window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(loadSessionDraft()).toBeNull();
    expect(loadLastSession()).toBeNull();
    expect(() => saveSessionDraft(makeSession("ssr-draft"))).not.toThrow();
    expect(() => saveLastSession(makeSession("ssr-last", new Date(1).toISOString()))).not.toThrow();
    expect(() => clearSessionDraft()).not.toThrow();
  });

  it("flushes draft on interval and pagehide using the persistence controller", () => {
    vi.useFakeTimers();
    let currentDraft: SessionFingerprint | null = makeSession("draft-flush");

    const controller = createSessionDraftPersistenceController({
      getDraft: () => currentDraft,
    });
    controller.start();

    vi.advanceTimersByTime(60_000);
    expect(loadSessionDraft()?.id).toBe("draft-flush");

    currentDraft = makeSession("draft-pagehide");
    window.dispatchEvent(new Event("pagehide"));
    expect(loadSessionDraft()?.id).toBe("draft-pagehide");

    currentDraft = makeSession("draft-ended", new Date(8_000).toISOString());
    controller.stop();
    expect(window.localStorage.getItem(QUALIA_SESSION_DRAFT_KEY)).toBeNull();
  });

  it("flushImportant is an immediate alias", () => {
    let currentDraft: SessionFingerprint | null = makeSession("important");
    const controller = createSessionDraftPersistenceController({
      getDraft: () => currentDraft,
    });

    controller.flushImportant();
    expect(loadSessionDraft()?.id).toBe("important");

    currentDraft = null;
    controller.flushImportant();
    expect(loadSessionDraft()).toBeNull();
  });

  it("cleans invalid non-session shapes", () => {
    window.localStorage.setItem(QUALIA_SESSION_LAST_KEY, JSON.stringify({ id: "x" }));

    expect(loadLastSession()).toBeNull();
    expect(window.localStorage.getItem(QUALIA_SESSION_LAST_KEY)).toBeNull();
  });
});
