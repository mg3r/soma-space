"use client";

import Link from "next/link";
import { useState } from "react";

export default function Page() {
  const [contributionAmount, setContributionAmount] = useState("33");
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  const errorMessages = [
    "hmm, that didn&apos;t quite work. feel free to try again.",
    "not quite. you&apos;re welcome to try again.",
    "that doesn&apos;t seem to be it. take another try.",
    "almost — give it another go.",
    "that wasn&apos;t it. try again.",
  ];

  const getRandomErrorMessage = () => {
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  };

  async function checkPassword() {
    const trimmed = password.trim();
    if (!trimmed) return;

    setIsChecking(true);
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
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsChecking(false);
    }
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
        alert(errorData.message || errorData.error || "Failed to create checkout session. Please try again.");
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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPassword();
  };

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
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
                  className="bg-white/5 border-b border-white/20 text-white/80 text-base focus:outline-none focus:border-[#05fd00] w-full px-2 py-1"
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
    <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
      <div className="relative mx-auto flex h-screen max-w-4xl flex-col px-6 pt-20 pb-10">
        <div className="flex flex-1 items-center">
          <div className="flex-1">
            <h1 className="text-sm">join us for RENEWAL</h1>

            <p className="mt-6 text-sm text-white/70 leading-relaxed">
              an evening of guided movement, music, and embodied presence — held in a quiet farm setting with mountain views. come to move freely, unwind, and connect as you are.
            </p>

            <div className="mt-8 space-y-1">
              <p className="text-sm text-white/90">
                friday, 1/23 • 7:00–9:30 pm
              </p>
              <p className="text-sm text-white/90">
                mountain views, earth home, farm setting, cacao, live dj set
              </p>
            </div>

            <p className="mt-6 text-sm text-white/70">
              location shared after reserving (~25 minutes west of downtown mall)
            </p>

            <p className="mt-6 text-sm text-white/70 leading-relaxed">
              no one is ever turned away for not having enough. if you need financial support, please reach out to us directly. soma space is held as a respectful, non violent, and consensual container where all bodies are welcome.{" "}
              <Link
                href="/manifesto"
                className="text-[#05fd00] hover:text-[#05fd00]/80"
              >
                read our full manifesto here
              </Link>
              .
            </p>

            <div className="mt-8 space-y-4">
              <p className="text-sm text-white/80">
                sliding scale contribution ($22–$44, your choice).
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
                  className="bg-transparent border-b border-white/20 text-white/80 text-base focus:outline-none focus:border-[#05fd00] w-20 px-2"
                  placeholder="33"
                />
                <button
                  onClick={createCheckoutSession}
                  disabled={isCreatingCheckout}
                  className="text-sm text-[#05fd00] hover:text-[#05fd00]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingCheckout ? "creating checkout..." : "reserve your spot →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
