"use client";

export interface MicPermissionScreenProps {
  supported: boolean;
  requesting: boolean;
  errorMessage?: string | null;
  onAllow: () => void;
}

export function MicPermissionScreen({
  supported,
  requesting,
  errorMessage,
  onAllow,
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

      {!supported ? (
        <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          Microphone capture is not supported in this browser.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/80">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAllow}
        disabled={!supported || requesting}
        className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm text-white transition hover:border-white/40 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {requesting ? "opening mic..." : "allow listening"}
      </button>
    </div>
  );
}

