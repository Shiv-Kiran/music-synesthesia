"use client";

export interface MicCalibrationScreenProps {
  progress: number; // 0..1
}

export function MicCalibrationScreen({ progress }: MicCalibrationScreenProps) {
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 text-center">
      <div>
        <p className="text-xs tracking-[0.22em] text-white/45 uppercase">Qualia</p>
        <h2 className="mt-4 text-2xl leading-tight font-semibold text-white sm:text-3xl">
          settling in...
        </h2>
        <p className="mt-2 text-sm text-white/65">
          calibrating the room so the visuals ignore background noise
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-white/35 via-white/50 to-white/35 transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-white/45">{pct}%</div>
      </div>
    </div>
  );
}

