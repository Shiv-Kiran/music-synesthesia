"use client";

import type { PromptInstance, PromptLifecycleState } from "@/prompt/prompt-types";

export interface PromptOverlayProps {
  prompt: PromptInstance | null;
  lifecycle: PromptLifecycleState;
  holdTimer: boolean;
  timerDotMs?: number;
  removeMs?: number;
  onChipSelect: (chipId: string, chipLabel: string) => void;
  onPromptZoneHoldChange?: (held: boolean) => void;
}

const PROMPT_TIMER_DOT_MS = 25_000;
const PROMPT_REMOVE_MS = 35_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function PromptOverlay({
  prompt,
  lifecycle,
  holdTimer,
  timerDotMs = PROMPT_TIMER_DOT_MS,
  removeMs = PROMPT_REMOVE_MS,
  onChipSelect,
  onPromptZoneHoldChange,
}: PromptOverlayProps) {
  if (!prompt) {
    return null;
  }

  const elapsed = prompt.elapsed_visible_ms;
  const timerVisible = elapsed >= timerDotMs;
  const timerProgress = timerVisible
    ? clamp(
        1 - (elapsed - timerDotMs) / (removeMs - timerDotMs),
        0,
        1,
      )
    : 1;

  const fadeOpacity =
    lifecycle === "appearing"
      ? 0.95
      : lifecycle === "visible"
        ? 1
        : lifecycle === "fading"
          ? 0.82
          : 0;
  const translateY =
    lifecycle === "appearing" ? "translateY(12px)" : lifecycle === "fading" ? "translateY(8px)" : "translateY(0)";
  const scale = lifecycle === "fading" ? 0.985 : 1;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center px-4 sm:bottom-18">
      <div
        className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md transition-[opacity,transform] duration-500 sm:px-5"
        style={{
          opacity: fadeOpacity,
          transform: `${translateY} scale(${scale})`,
        }}
        onPointerEnter={() => onPromptZoneHoldChange?.(true)}
        onPointerLeave={() => onPromptZoneHoldChange?.(false)}
      >
        <div className="text-center text-sm leading-snug text-white/90 sm:text-base">
          {prompt.text}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {prompt.chips.map((chip, index) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onChipSelect(chip.id, chip.label)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 transition hover:border-white/35 hover:bg-white/12 active:scale-[0.985] sm:text-sm"
              style={{
                animation: "qualia-chip-in 420ms ease both",
                animationDelay: `${index * 80}ms`,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-3 h-1.5 px-1">
          {timerVisible ? (
            <div className="flex items-center gap-2">
              <div className="h-1 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                <div
                  className="h-full rounded-full bg-white/45 transition-[width] duration-100"
                  style={{ width: `${Math.round(timerProgress * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-white/45">{holdTimer ? "hold" : ""}</div>
            </div>
          ) : (
            <div className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}
