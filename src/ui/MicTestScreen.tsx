"use client";

export interface MicTestScreenProps {
  rms: number;
  noiseFloorRms: number;
  thresholdRms: number;
  gateActive: boolean;
  autoAdvanceInMs?: number | null;
  title?: string;
  subtitle?: string;
  signalLabel?: string;
  onContinue: () => void;
  onSkip: () => void;
}

function formatRms(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "0.0000";
}

export function MicTestScreen({
  rms,
  noiseFloorRms,
  thresholdRms,
  gateActive,
  autoAdvanceInMs,
  title = "say something, or play a few seconds",
  subtitle = "just making sure we can hear you",
  signalLabel = "mic signal",
  onContinue,
  onSkip,
}: MicTestScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
      <div>
        <p className="text-xs tracking-[0.22em] text-white/45 uppercase">Qualia</p>
        <h2 className="mt-4 text-2xl leading-tight font-semibold text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-white/65">
          {subtitle}
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between text-xs text-white/60">
          <span>{signalLabel}</span>
          <span className={gateActive ? "text-emerald-200" : "text-white/55"}>
            {gateActive ? "listening" : "idle"}
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/35">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-75 ${
              gateActive
                ? "bg-gradient-to-r from-emerald-300/70 to-cyan-300/70"
                : "bg-white/30"
            }`}
            style={{ width: `${Math.min((rms / Math.max(thresholdRms * 1.8, 0.0001)) * 100, 100)}%` }}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-left text-[11px] text-white/55">
          <div>
            <div className="uppercase tracking-wide">rms</div>
            <div className="mt-1 text-white/75">{formatRms(rms)}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide">floor</div>
            <div className="mt-1 text-white/75">{formatRms(noiseFloorRms)}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide">threshold</div>
            <div className="mt-1 text-white/75">{formatRms(thresholdRms)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full border border-white/30 bg-white/12 px-4 py-2 text-sm text-white transition hover:border-white/45 hover:bg-white/18"
        >
          {gateActive ? "continue" : "continue anyway"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm text-white/75 transition hover:border-white/25 hover:text-white"
        >
          skip
        </button>
      </div>

      {typeof autoAdvanceInMs === "number" && autoAdvanceInMs > 0 ? (
        <p className="text-xs text-white/45">
          continuing in {Math.ceil(autoAdvanceInMs / 1000)}s
        </p>
      ) : null}
    </div>
  );
}
