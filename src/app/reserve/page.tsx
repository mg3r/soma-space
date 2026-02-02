"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useEventConfig } from "@/hooks/useEventConfig";

export default function Page() {
  const { event, config, isLoading: isLoadingConfig, primaryColor, backgroundColor } = useEventConfig();
  const [contributionAmount, setContributionAmount] = useState("33");
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [remainingSpots, setRemainingSpots] = useState<number | null>(null);
  const [isFull, setIsFull] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const errorMessages = [
    "hmm, that didn't quite work. feel free to try again.",
    "not quite. you're welcome to try again.",
    "that doesn't seem to be it. take another try.",
    "almost — give it another go.",
    "that wasn't it. try again.",
  ];

  const getRandomErrorMessage = () => {
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  };

  async function checkPassword() {
    const trimmed = password.trim();
    if (!trimmed) return;

    setError("");

    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        setError(getRandomErrorMessage());
        setPassword("");
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  }

  const loadEventStatus = useCallback(async () => {
    if (!event) return;
    try {
      const res = await fetch(`/api/event-status?eventId=${event.id}`);
      if (res.ok) {
        const data = await res.json();
        const stats = data.stats;
        setRemainingSpots(stats.remainingSpots);
        setIsFull(stats.remainingSpots === 0);
      }
    } catch {
      console.error("Error loading event status");
    }
  }, [event]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEventStatus();
    }
  }, [isAuthenticated, loadEventStatus]);

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
        if (errorData.isFull) {
          // Event is full, show waitlist form
          setShowWaitlist(true);
        } else {
          alert(errorData.message || errorData.error || "Failed to create checkout session. Please try again.");
        }
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  async function submitWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistName || !waitlistEmail) {
      alert("Please enter your name and email");
      return;
    }

    setIsSubmittingWaitlist(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: waitlistName,
          email: waitlistEmail,
          phone: waitlistPhone,
          eventId: event?.id || "",
        }),
      });

      if (res.ok) {
        setWaitlistSuccess(true);
        setWaitlistName("");
        setWaitlistEmail("");
        setWaitlistPhone("");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || "Failed to add to waitlist. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting waitlist:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmittingWaitlist(false);
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPassword();
  };

  // Apply dynamic colors
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary-color", primaryColor);
      document.documentElement.style.setProperty("--background-color", backgroundColor);
    }
  }, [primaryColor, backgroundColor]);

  if (isLoadingConfig || !event) {
    return (
      <main className="relative h-screen overflow-hidden text-white" style={{ backgroundColor }}>
        <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-6 pt-20 pb-10 items-center justify-center">
          <p className="text-sm text-white/50">Loading...</p>
        </div>
      </main>
    );
  }

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="relative h-screen overflow-hidden text-white" style={{ backgroundColor }}>
        <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-6 pt-20 pb-10">
          <div className="flex flex-1 items-center">
            <div className="flex-1">
              <h1 className="text-sm">reserve your spot</h1>

              <p className="mt-6 text-sm text-white/70">
                enter the password to continue
              </p>

              <form onSubmit={handlePasswordSubmit} className="mt-8">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-b border-white/20 text-white/80 text-base focus:outline-none w-full px-2 py-1"
                  style={{ "--focus-border-color": primaryColor } as React.CSSProperties}
                  onFocus={(e) => e.target.style.borderColor = primaryColor}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                  placeholder="password"
                  autoFocus
                />
                {error && (
                  <p className="mt-4 text-sm text-white/60">{error}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Show booking form after authentication
  return (
    <main className="relative h-screen overflow-hidden text-white" style={{ backgroundColor }}>
      <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-6 pt-20 pb-10">
        <div className="flex flex-1 items-center">
          <div className="flex-1">
            <h1 className="text-sm">join us for {event.name}</h1>

            <p className="mt-6 text-sm text-white/70 leading-relaxed">
              {config?.event_description || "a gathering of guided movement, music, and embodied presence — held in a quiet farm setting with mountain views. come to move freely, unwind, and connect as you are."}
            </p>

            <div className="mt-8 space-y-1">
              <p className="text-sm text-white/90">
                {event.date} • {event.time}
              </p>
              <p className="text-sm text-white/90">
                {config?.event_description || event.place}
              </p>
            </div>

            <p className="mt-6 text-sm text-white/70">
              {config?.chat_location_message || event.note || "location shared after reserving (~25 minutes west of downtown mall)"}
            </p>

            <p className="mt-6 text-sm text-white/70 leading-relaxed">
              soma space is held as a respectful, non violent, and consensual container where all bodies are welcome.{" "}
              <Link
                href="/manifesto"
                className="hover:opacity-80"
                style={{ color: primaryColor }}
              >
                read our full manifesto here
              </Link>
              .
            </p>

            {/* Remaining spots indicator - only show when 10 or fewer spots remain (and not full) */}
            {remainingSpots !== null && remainingSpots <= 10 && remainingSpots > 0 && (
              <div className="mt-8">
                <p className="text-sm text-white/70">
                  <span style={{ color: primaryColor }}>{remainingSpots}</span> spot{remainingSpots !== 1 ? "s" : ""} remaining
                </p>
              </div>
            )}

            {/* Waitlist form (shown when full or after failed booking) */}
            {showWaitlist && (
              <div className="mt-8 space-y-4 bg-white/5 border border-white/10 p-6">
                <h2 className="text-sm" style={{ color: primaryColor }}>join the waitlist</h2>
                {waitlistSuccess ? (
                  <p className="text-sm text-white/70">
                    you&apos;ve been added to the waitlist. we&apos;ll reach out if a spot becomes available.
                  </p>
                ) : (
                  <form onSubmit={submitWaitlist} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        value={waitlistName}
                        onChange={(e) => setWaitlistName(e.target.value)}
                        className="bg-white/5 border-b border-white/20 text-white/80 text-base focus:outline-none w-full px-2 py-1"
                        style={{ "--focus-border-color": primaryColor } as React.CSSProperties}
                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                        placeholder="name"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        className="bg-white/5 border-b border-white/20 text-white/80 text-base focus:outline-none w-full px-2 py-1"
                        style={{ "--focus-border-color": primaryColor } as React.CSSProperties}
                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                        placeholder="email"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        value={waitlistPhone}
                        onChange={(e) => setWaitlistPhone(e.target.value)}
                        className="bg-white/5 border-b border-white/20 text-white/80 text-base focus:outline-none w-full px-2 py-1"
                        style={{ "--focus-border-color": primaryColor } as React.CSSProperties}
                        onFocus={(e) => e.target.style.borderColor = primaryColor}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                        placeholder="phone (optional)"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingWaitlist}
                      className="text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ color: primaryColor }}
                    >
                      {isSubmittingWaitlist ? "adding..." : "join waitlist →"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Booking form (shown when not full) */}
            {!isFull && !showWaitlist && (
              <div className="mt-8 space-y-4">
                <p className="text-sm text-white/80">
                  sliding scale contribution ($22–$44, your choice).
                </p>
                <p className="text-sm text-white/70">
                  no one is ever turned away for not having enough. if you need financial support, please reach out to us directly.
                </p>
                
                <div className="flex items-center gap-3">
                  <span className="text-white/60 text-sm">$</span>
                  <input
                    type="number"
                    min="22"
                    max="44"
                    step="1"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    className="bg-transparent border-b border-white/20 text-white/80 text-base focus:outline-none w-20 px-2"
                    style={{ "--focus-border-color": primaryColor } as React.CSSProperties}
                    onFocus={(e) => e.target.style.borderColor = primaryColor}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                    placeholder="33"
                  />
                  <button
                    onClick={createCheckoutSession}
                    disabled={isCreatingCheckout}
                    className="text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: primaryColor }}
                  >
                    {isCreatingCheckout ? "creating checkout..." : "reserve your spot →"}
                  </button>
                </div>
              </div>
            )}

            {/* Show waitlist option if full but form not shown yet */}
            {isFull && !showWaitlist && (
              <div className="mt-8 space-y-4">
                <p className="text-sm text-white/70">
                  this gathering is currently full.
                </p>
                <p className="text-sm text-white/70">
                  join the waitlist and we&apos;ll reach out if a spot opens. we&apos;ll also let you know about future gatherings.
                </p>
                <button
                  onClick={() => setShowWaitlist(true)}
                  className="text-sm hover:opacity-80"
                  style={{ color: primaryColor }}
                >
                  join the waitlist →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
