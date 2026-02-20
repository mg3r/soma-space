"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";
import { useEventConfig } from "@/hooks/useEventConfig";

const WAIVER_TITLE = "soma space – All Events & Gatherings";

const WAIVER_PARAGRAPHS = [
  "I understand that soma space gatherings may include movement, dance, somatic practices, sound, meditation, breathwork, and other physical, emotional, or experiential activities. I acknowledge that participation in these activities involves inherent risks, including but not limited to physical injury, strain, falls, emotional discomfort, or other unforeseen effects.",
  "I voluntarily choose to participate in soma space events and assume full responsibility for my own safety, well-being, and participation. I understand that I am responsible for listening to my body, honoring my limits, and caring for myself throughout any gathering.",
  "I hereby release, waive, and discharge soma space, its organizers, facilitators (including but not limited to Max and Ovi), assistants, volunteers, collaborators, and any hosting venues or property owners from any and all liability, claims, demands, or causes of action arising out of or related to injury, loss, or damage to person or property that may occur during or as a result of my participation, including those caused by negligence.",
  "I acknowledge that soma space gatherings are held as substance-free, consensual, and respectful spaces, guided by shared agreements around consent, safety, personal responsibility, and mutual respect. I agree to participate in alignment with these agreements.",
  "I confirm that I am physically and mentally able to participate, or that I choose to participate regardless, and I understand that I may pause, rest, modify my participation, or leave the space at any time.",
  "By signing below, I acknowledge that this waiver applies to all current and future soma space events that I attend, regardless of location or date, and that I have read, understood, and voluntarily agreed to these terms.",
];

function WalkInWaiverContent() {
  const { primaryColor, backgroundColor, isLoading } = useEventConfig();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [signed, setSigned] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState("");

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const canSign =
    agree &&
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    typedName.trim().toLowerCase() === fullName.trim().toLowerCase();

  const handleSign = useCallback(async () => {
    if (!canSign || !email.trim()) return;
    setError("");
    setIsSigning(true);
    try {
      const res = await fetch("/api/waiver/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          walkIn: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "failed to record signature. please try again.");
        return;
      }
      setSigned(true);
    } catch {
      setError("something went wrong. please try again.");
    } finally {
      setIsSigning(false);
    }
  }, [canSign, email, firstName, lastName]);

  if (isLoading) {
    return (
      <main className="min-h-screen text-white" style={{ backgroundColor: "#111111" }}>
        <div className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm text-white/50">loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor }}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8">
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">
            ← back
          </Link>
        </header>

        <h1 className="text-2xl tracking-tight" style={{ color: primaryColor }}>
          participation agreement
        </h1>

        <p className="mt-2 text-sm text-white/60">
          please read the full agreement below, then sign to complete your waiver.
        </p>

        <div className="mt-8 max-h-[40vh] overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-6">
          <div className="font-sans text-sm leading-relaxed text-white/90">
            <p className="mb-4 font-medium text-white">{WAIVER_TITLE}</p>
            {WAIVER_PARAGRAPHS.map((para, i) => (
              <p key={i} className="mb-4 last:mb-0">
                {para}
              </p>
            ))}
          </div>
        </div>

        {!signed ? (
          <div className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/60">first name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFirstName(v);
                    setTypedName([v, lastName].filter(Boolean).join(" "));
                  }}
                  placeholder="First"
                  className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLastName(v);
                    setTypedName([firstName, v].filter(Boolean).join(" "));
                  }}
                  placeholder="Last"
                  className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 rounded border-white/30 bg-white/5"
                style={{ accentColor: primaryColor }}
              />
              <span>i have read and agree to the participation agreement above.</span>
            </label>
            <div>
              <p className="mb-1 text-sm text-white/70">
                type your full name to sign:{" "}
                <strong className="text-white/90">{fullName || "(first and last name)"}</strong>
              </p>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="first last"
                className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                style={{ borderColor: agree && canSign ? primaryColor : undefined }}
              />
            </div>
            <button
              type="button"
              onClick={handleSign}
              disabled={!canSign || isSigning}
              className="rounded px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: canSign ? primaryColor : "rgba(255,255,255,0.2)" }}
            >
              {isSigning ? "signing…" : "sign agreement"}
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-white/80">
              thanks, {firstName}. you&apos;re signed. you&apos;re all set.
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </main>
  );
}

export default function WalkInWaiverPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen text-white" style={{ backgroundColor: "#111111" }}>
          <div className="mx-auto max-w-2xl px-6 py-10">
            <p className="text-sm text-white/50">loading...</p>
          </div>
        </main>
      }
    >
      <WalkInWaiverContent />
    </Suspense>
  );
}
