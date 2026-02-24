"use client";

import { useState } from "react";

type WaitlistStatus = "idle" | "loading" | "success" | "exists" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading") {
      return;
    }
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const payload = (await response.json()) as { status?: string; message?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(payload.message ?? "Could not join the waitlist.");
        return;
      }
      if (payload.status === "exists") {
        setStatus("exists");
        setMessage("You’re already on the list.");
        return;
      }
      setStatus("success");
      setMessage("You’re on the list. Invite approvals go out by email.");
    } catch {
      setStatus("error");
      setMessage("Could not join the waitlist.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex w-full flex-col gap-3"
      aria-label="Qualia waitlist"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Name (optional)"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          className="w-full rounded-full border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/85 placeholder:text-white/35 focus:border-white/35 focus:outline-none"
        />
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          className="w-full rounded-full border border-white/25 bg-black/45 px-4 py-3 text-sm text-white/90 placeholder:text-white/40 focus:border-white/45 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm text-white transition hover:border-white/40 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "joining..." : "join the waitlist"}
        </button>
        <span className="text-xs text-white/50">
          Invite beta. We approve manually.
        </span>
      </div>
      {message ? (
        <p className="text-xs text-white/70">{message}</p>
      ) : null}
    </form>
  );
}
