import { LandingCanvas } from "@/ui/LandingCanvas";
import { WaitlistForm } from "@/ui/WaitlistForm";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#070510] text-white">
      <div className="absolute inset-0">
        <LandingCanvas />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_78%_72%,rgba(120,108,255,0.14),transparent_60%)]" />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-black/35 p-8 backdrop-blur">
          <p className="text-xs tracking-[0.3em] text-white/55 uppercase">
            Qualia
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            some people feel music differently.
            <br />
            this is for them.
          </h1>
          <p className="mt-3 text-sm text-white/70 sm:text-base">
            qualia listens through your mic and builds a living visual world from how
            you hear.
            <br />
            nothing recorded. nothing stored. just you and the music.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              feels the beat
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              asks how it sounds
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              never records
            </span>
          </div>

          <WaitlistForm />

          <div className="mt-6 text-xs text-white/50">small list. slow invites. worth the wait.</div>
        </div>
      </div>
    </main>
  );
}
