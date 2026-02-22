"use client";

import { DEV_DEMO_AUDIO_CLIPS } from "@/audio/dev-demo-clips";

export interface MicPermissionScreenProps {
  supported: boolean | null;
  requesting: boolean;
  errorMessage?: string | null;
  onAllow: () => void;
  showDevBypass?: boolean;
  onUseDevBypass?: () => void;
  activeDevDemoClipId?: string | null;
  devDemoPlaying?: boolean;
  onToggleDevDemoClip?: (clipId: string) => void;
  devDemoPlaybackError?: string | null;
}

export function MicPermissionScreen({
  supported,
  requesting,
  errorMessage,
  onAllow,
  showDevBypass = false,
  onUseDevBypass,
  activeDevDemoClipId = null,
  devDemoPlaying = false,
  onToggleDevDemoClip,
  devDemoPlaybackError = null,
}: MicPermissionScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
      <div>
        <p className="text-xs tracking-[0.22em] text-white/45 uppercase">Qualia</p>
        <h1 className="mt-4 text-2xl leading-tight font-semibold text-white sm:text-4xl">
          we listen through your mic
        </h1>
        <p className="mt-2 text-sm text-white/70 sm:text-base">
          so we can feel the music with you
        </p>
        <p className="mt-3 text-xs text-white/55">no recording. ever.</p>
      </div>

      {supported === false ? (
        <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          Microphone capture is not supported in this browser.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/80">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onAllow}
          disabled={supported !== true || requesting}
          className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm text-white transition hover:border-white/40 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {requesting ? "opening mic..." : "allow listening"}
        </button>

        {showDevBypass && onUseDevBypass ? (
          <button
            type="button"
            onClick={onUseDevBypass}
            disabled={requesting}
            className="rounded-full border border-cyan-200/25 bg-cyan-300/8 px-5 py-2 text-sm text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-50"
          >
            use demo input (dev)
          </button>
        ) : null}
      </div>

      {showDevBypass ? (
        <div className="max-w-lg rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left">
          <p className="text-xs text-white/45">
            Dev mode: deterministic synthetic audio lets you test prompts and visuals without a mic.
          </p>
          <p className="mt-2 text-[11px] text-white/35">
            Preview clips (deterministic demo beats with different grooves/textures):
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEV_DEMO_AUDIO_CLIPS.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => onToggleDevDemoClip?.(clip.id)}
                className="rounded-full border px-3 py-1 text-[11px] transition"
                style={{
                  borderColor:
                    activeDevDemoClipId === clip.id
                      ? "rgba(103, 232, 249, 0.45)"
                      : "rgba(255,255,255,0.12)",
                  background:
                    activeDevDemoClipId === clip.id
                      ? "rgba(34, 211, 238, 0.12)"
                      : "rgba(255,255,255,0.05)",
                  color:
                    activeDevDemoClipId === clip.id
                      ? "rgba(207, 250, 254, 0.98)"
                      : "rgba(255,255,255,0.75)",
                }}
              >
                {activeDevDemoClipId === clip.id && devDemoPlaying ? "pause " : "play "}
                {clip.label}
              </button>
            ))}
          </div>

          {devDemoPlaybackError ? (
            <p className="mt-2 text-[11px] text-red-200/85">{devDemoPlaybackError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
