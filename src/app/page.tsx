"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { nextEvent } from "@/config/event";

type Phase = "boot" | "await_password" | "checking" | "unlocked" | "waitlist_first_name" | "waitlist_last_name" | "waitlist_email" | "waitlist_phone";

function rand_ms(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function Page() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [showNav, setShowNav] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("33");
  const [waitlistData, setWaitlistData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);

  const [lines, setLines] = useState<
    Array<
      | { type: "bot"; text: string }
      | { type: "typing" }
      | { type: "bot_manifesto_link" }
      | { type: "bot_reserve_link" }
      | { type: "bot_waitlist_link" }
      | { type: "user"; text: string }
    >
  >([]);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastErrorIndexRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  const errorMessages = [
    "hmm, that didn't quite work. feel free to try again.",
    "not quite. you're welcome to try again.",
    "that doesn't seem to be it. take another try.",
    "almost — give it another go.",
    "that wasn't it. try again.",
  ];

  const getRandomErrorMessage = () => {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * errorMessages.length);
    } while (
      errorMessages.length > 1 &&
      randomIndex === lastErrorIndexRef.current
    );
    lastErrorIndexRef.current = randomIndex;
    return errorMessages[randomIndex];
  };

  const push = (item: (typeof lines)[number]) =>
    setLines((prev) => [...prev, item]);

  const botSay = async (item: (typeof lines)[number]) => {
    if (isTypingRef.current) return;
    isTypingRef.current = true;
  
    setLines((prev) => [...prev, { type: "typing" }]);
    await new Promise((r) => setTimeout(r, rand_ms(1000, 3000)));
  
    setLines((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.type === "typing") {
        return [...prev.slice(0, -1), item];
      }
      return [...prev, item];
    });
  
    isTypingRef.current = false;
  };

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      setShowNav(true);

      await botSay({ type: "bot", text: "hey :) welcome to soma space" });

      await botSay({
        type: "bot",
        text:
          "this is a movement gathering rooted in presence and free expression, with gentle guidance throughout. no experience required — just come as you are",
      });

      await botSay({ type: "bot_manifesto_link" });

      await botSay({
        type: "bot",
        text: "to see details of our next gathering and reserve your spot, type the password",
      });

      setPhase("await_password");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatScrollRef.current && bottomRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  async function loadEventStatus() {
    try {
      const res = await fetch(`/api/event-status?eventId=${nextEvent.id}`);
      if (res.ok) {
        const data = await res.json();
        const stats = data.stats;
        return stats.remainingSpots === 0;
      }
    } catch (error) {
      console.error("Error loading event status:", error);
    }
    return false;
  }

  async function createCheckoutSession() {
    if (isCreatingCheckout) return;
    
    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount < 22 || amount > 44) {
      alert("Please enter an amount between $22 and $44");
      return;
    }
    
    setIsCreatingCheckout(true);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: contributionAmount }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to create checkout session:", errorData);
        alert(errorData.message || errorData.error || "Failed to create checkout session. Please try again.");
        return;
      }

      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
        alert("Failed to create checkout session. Please try again.");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  async function submitWaitlist() {
    if (!waitlistData.firstName || !waitlistData.lastName || !waitlistData.email) {
      await botSay({ type: "bot", text: "please provide your first name, last name, and email" });
      return;
    }

    setIsSubmittingWaitlist(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${waitlistData.firstName} ${waitlistData.lastName}`,
          email: waitlistData.email,
          phone: waitlistData.phone || undefined,
          eventId: nextEvent.id,
        }),
      });

      if (res.ok) {
        await botSay({
          type: "bot",
          text: "you've been added to the waitlist. we'll reach out if a spot becomes available.",
        });
        setWaitlistData({ firstName: "", lastName: "", email: "", phone: "" });
        setPhase("unlocked");
      } else {
        const errorData = await res.json().catch(() => ({}));
        await botSay({
          type: "bot",
          text: errorData.message || "failed to add to waitlist. please try again.",
        });
      }
    } catch (error) {
      console.error("Error submitting waitlist:", error);
      await botSay({ type: "bot", text: "an error occurred. please try again." });
    } finally {
      setIsSubmittingWaitlist(false);
    }
  }

  async function submit() {
    const trimmed = input.trim();
    
    // Allow empty input only for optional phone field
    if (!trimmed && phase !== "waitlist_phone") return;

    // Show user input (actual text) - show something even if empty for phone
    push({ type: "user", text: trimmed || "(skipped)" });

    setInput("");

    // Handle waitlist collection phases
    if (phase === "waitlist_first_name") {
      setWaitlistData((prev) => ({ ...prev, firstName: trimmed }));
      await botSay({ type: "bot", text: "last name?" });
      setPhase("waitlist_last_name");
      return;
    }

    if (phase === "waitlist_last_name") {
      setWaitlistData((prev) => ({ ...prev, lastName: trimmed }));
      await botSay({ type: "bot", text: "email?" });
      setPhase("waitlist_email");
      return;
    }

    if (phase === "waitlist_email") {
      // Basic email validation
      if (!trimmed.includes("@")) {
        await botSay({ type: "bot", text: "please enter a valid email address" });
        return;
      }
      setWaitlistData((prev) => ({ ...prev, email: trimmed }));
      await botSay({ type: "bot", text: "phone number? (optional)" });
      setPhase("waitlist_phone");
      return;
    }

    if (phase === "waitlist_phone") {
      setWaitlistData((prev) => ({ ...prev, phone: trimmed || "" }));
      await submitWaitlist();
      return;
    }

    if (phase !== "await_password") return;

    setPhase("checking");

    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: trimmed }),
    });

    if (!res.ok) {
      await botSay({ type: "bot", text: getRandomErrorMessage() });
      setPhase("await_password");
      return;
    }

    setPhase("unlocked");

    // Show typing indicator, then access granted
    await botSay({ type: "bot", text: "access granted" });

    // Show typing indicator, then renewal message
    await botSay({ type: "bot", text: "join us for RENEWAL" });

    // Show typing indicator, then event details
    await botSay({
      type: "bot",
      text: "mountain views, earth home, farm setting, cacao, live dj set",
    });

    await botSay({
      type: "bot",
      text: `${nextEvent.date} • ${nextEvent.time}`,
    });

    await botSay({
      type: "bot",
      text: "location shared after reserving (~25 minutes west of downtown mall)",
    });

    await botSay({
      type: "bot",
      text: "sliding scale contribution ($22–$44, your choice). reach out if you need support",
    });

    // Check event status before showing reserve link
    const isFull = await loadEventStatus();
    
    if (isFull) {
      await botSay({ 
        type: "bot", 
        text: "we checked, and this gathering is currently full" 
      });
      await botSay({ 
        type: "bot", 
        text: "join the waitlist and we'll reach out if a spot opens. we'll also let you know about future gatherings" 
      });
      await botSay({ type: "bot_waitlist_link" });
    } else {
      // Show reserve link
      await botSay({ type: "bot_reserve_link" });
    }
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
      {/* aura */}
      <div className="pointer-events-none absolute inset-0">
        {/* Main central glow */}
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/6 blur-3xl" 
             style={{ animation: 'pulse 8s ease-in-out infinite' }} />
        {/* Secondary organic glows */}
        <div className="absolute top-1/2 left-1/2 h-[450px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/4 blur-2xl" 
             style={{ animation: 'pulse 9s ease-in-out infinite', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 h-[550px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/3 blur-3xl"
             style={{ animation: 'pulse 10s ease-in-out infinite', animationDelay: '2s' }} />
        {/* Subtle organic variations */}
        <div className="absolute top-[45%] left-[48%] h-[300px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/2.5 blur-2xl"
             style={{ animation: 'pulse 11s ease-in-out infinite', animationDelay: '2.5s' }} />
        <div className="absolute top-[55%] left-[52%] h-[320px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/2 blur-2xl"
             style={{ animation: 'pulse 12s ease-in-out infinite', animationDelay: '3s' }} />
      </div>

      <div className="relative mx-auto flex h-screen max-w-2xl flex-col px-6 pt-20 pb-10">
        {/* subtle nav */}
        <header
          className={[
            "mb-8 flex items-center justify-end transition-opacity duration-1000",
            showNav ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <nav className="flex gap-4 text-xs text-white/50">
            <Link className="hover:text-white/80" href="/manifesto">
              manifesto
            </Link>
          </nav>
        </header>

        {/* chat */}
        <section
          className={[
            "flex flex-col transition-opacity duration-1000",
            showNav ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <div className="flex h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-2xl bg-white/5 backdrop-blur">
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3 text-sm leading-relaxed text-white/90">
                {lines.map((l, idx) => {
                  if (l.type === "typing") {
                    return (
                      <div key={idx} className="flex">
                        <p className="text-white/45 max-w-[85%]">
                          ...
                        </p>
                      </div>
                    );
                  }
                  if (l.type === "bot_manifesto_link") {
                    return (
                      <div key={idx} className="flex">
                        <p className="text-white/80 max-w-[85%]">
                          if you&apos;d like to learn more, you can read the full{" "}
                          <Link
                            className="text-[#05fd00] hover:text-[#05fd00]/80"
                            href="/manifesto"
                          >
                            manifesto
                          </Link>{" "}
                          here
                        </p>
                      </div>
                    );
                  }
                  if (l.type === "bot_waitlist_link") {
                    return (
                      <div key={idx} className="flex flex-col gap-3">
                        <button
                          onClick={async () => {
                            await botSay({ type: "bot", text: "first name?" });
                            setPhase("waitlist_first_name");
                          }}
                          className="text-[#05fd00] hover:text-[#05fd00]/80 text-left max-w-[85%]"
                        >
                          join the waitlist →
                        </button>
                      </div>
                    );
                  }
                  if (l.type === "bot_reserve_link") {
                    return (
                      <div key={idx} className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 max-w-[85%]">
                          <span className="text-white/60 text-sm">$</span>
                          <input
                            type="number"
                            min="22"
                            max="44"
                            step="1"
                            value={contributionAmount}
                            onChange={(e) => setContributionAmount(e.target.value)}
                            className="bg-transparent border-b border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] w-20 px-2"
                            placeholder="33"
                          />
                          <button
                            onClick={createCheckoutSession}
                            disabled={isCreatingCheckout}
                            className="text-[#05fd00] hover:text-[#05fd00]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCreatingCheckout ? "creating checkout..." : "reserve your spot →"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (l.type === "user") {
                    return (
                      <div key={idx} className="flex justify-end">
                        <p className="text-white/70 max-w-[85%] text-right">
                          {l.text}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex">
                      <p className="max-w-[85%]">{l.text}</p>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="flex items-center gap-3">
                <input
                  className="w-full bg-transparent px-0 py-2 text-base text-white/90 placeholder:text-white/30 outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={
                    phase === "await_password" ? "password" :
                    phase === "waitlist_first_name" ? "first name" :
                    phase === "waitlist_last_name" ? "last name" :
                    phase === "waitlist_email" ? "email" :
                    phase === "waitlist_phone" ? "phone (optional)" :
                    ""
                  }
                  disabled={
                    phase === "boot" || 
                    phase === "checking" || 
                    phase === "unlocked" || 
                    isSubmittingWaitlist
                  }
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  type={phase === "waitlist_email" ? "email" : phase === "waitlist_phone" ? "tel" : "text"}
                />
                <button
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
                  onClick={submit}
                  disabled={
                    phase === "boot" || 
                    phase === "checking" || 
                    phase === "unlocked" || 
                    isSubmittingWaitlist
                  }
                >
                  send
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}