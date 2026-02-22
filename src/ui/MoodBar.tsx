"use client";

import { useMemo, useRef, useState } from "react";

import { qualiaSelectors } from "@/state/selectors";
import { useQualiaStore } from "@/state/qualia-store";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function moodPoleToPercent(moodPole: number): number {
  return ((clamp(moodPole, -1, 1) + 1) / 2) * 100;
}

function clientXToMoodPole(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) {
    return 0;
  }

  const normalized = clamp((clientX - rect.left) / rect.width, 0, 1);
  return normalized * 2 - 1;
}

export function MoodBar() {
  const moodPole = useQualiaStore(qualiaSelectors.moodPole);
  const huePrimary = useQualiaStore(qualiaSelectors.huePrimary);
  const hueSecondary = useQualiaStore(qualiaSelectors.hueSecondary);
  const setMoodPole = useQualiaStore((state) => state.setMoodPole);

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const active = hovered || dragging;
  const handleLeftPercent = moodPoleToPercent(moodPole);

  const gradient = useMemo(
    () =>
      `linear-gradient(90deg,
        hsl(${Math.round(huePrimary)} 78% 58% / 0.9) 0%,
        hsl(${Math.round((huePrimary + hueSecondary) / 2)} 72% 64% / 0.85) 50%,
        hsl(${Math.round(hueSecondary)} 84% 62% / 0.9) 100%)`,
    [huePrimary, hueSecondary],
  );

  const updateFromClientX = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }

    setMoodPole(clientXToMoodPole(clientX, bar.getBoundingClientRect()));
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-3 sm:px-6 sm:pb-4">
      <div className="mx-auto w-full max-w-5xl">
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label="Mood"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={Number(moodPole.toFixed(2))}
          className="pointer-events-auto relative cursor-ew-resize rounded-full border border-white/10 bg-black/35 px-1.5 py-1.5 outline-none backdrop-blur-md transition-[height,background-color,border-color,transform] duration-200 focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20"
          style={{
            height: active ? 38 : 16,
            backgroundColor: active ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.3)",
            borderColor: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
            transform: active ? "translateY(0)" : "translateY(1px)",
          }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => {
            if (!dragging) {
              setHovered(false);
            }
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            setHovered(true);
            updateFromClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!dragging) {
              return;
            }
            updateFromClientX(event.clientX);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setDragging(false);
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setDragging(false);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.1 : 0.04;
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              setMoodPole(moodPole - step);
              return;
            }
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              setMoodPole(moodPole + step);
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              setMoodPole(-1);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              setMoodPole(1);
            }
          }}
        >
          <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2">
            <div
              className="h-1.5 rounded-full border border-white/10"
              style={{ background: gradient }}
            />
          </div>

          <div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.2)] transition-[opacity,transform] duration-150"
            style={{
              left: `${handleLeftPercent}%`,
              opacity: active ? 1 : 0.72,
              transform: `translate(-50%, -50%) scale(${active ? 1 : 0.92})`,
            }}
          />

          <div
            className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center justify-between text-[10px] tracking-[0.16em] text-white/45 uppercase transition-opacity duration-150"
            style={{ opacity: active ? 1 : 0 }}
          >
            <span>shadow</span>
            <span>glow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
