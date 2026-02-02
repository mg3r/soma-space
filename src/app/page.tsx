"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useEventConfig } from "@/hooks/useEventConfig";

type Phase = "boot" | "await_password" | "checking" | "unlocked"
  | "waitlist_first_name" | "waitlist_last_name" | "waitlist_email" | "waitlist_phone"
  | "register_first_name" | "register_last_name" | "register_email"
  | "register_num_tickets" | "register_guest_first_name" | "register_guest_last_name" | "register_guest_email" | "register_guest_amount";

function rand_ms(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function Page() {
  const { event, config, isLoading: isLoadingConfig, primaryColor, backgroundColor } = useEventConfig();
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
  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [numTickets, setNumTickets] = useState(0);
  const [multiTicketGuests, setMultiTicketGuests] = useState<Array<{ name: string; email: string; amount: number }>>([]);
  const [currentGuestFirstName, setCurrentGuestFirstName] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [hasClickedReserveSpot, setHasClickedReserveSpot] = useState(false);

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
    if (hasInitializedRef.current || isLoadingConfig || !event || !config) return;
    hasInitializedRef.current = true;

    // Check if user was previously unlocked for the current event
    let wasUnlocked = false;
    if (typeof window !== "undefined") {
      const storedUnlocked = localStorage.getItem("soma_space_unlocked");
      const storedEventId = localStorage.getItem("soma_space_event_id");
      const storedTimestamp = localStorage.getItem("soma_space_unlocked_timestamp");
      
      // Check if unlocked state exists and is valid
      if (storedUnlocked === "true" && storedEventId === event.id && storedTimestamp) {
        // Check if less than 1 hour has passed (3600000 ms)
        const timestamp = parseInt(storedTimestamp, 10);
        const oneHourAgo = Date.now() - 3600000;
        
        if (timestamp > oneHourAgo) {
          wasUnlocked = true;
        } else {
          // Expired - clear old localStorage entries
          localStorage.removeItem("soma_space_unlocked");
          localStorage.removeItem("soma_space_event_id");
          localStorage.removeItem("soma_space_unlocked_timestamp");
        }
      } else if (storedUnlocked === "true" && storedEventId !== event.id) {
        // Event changed - clear old localStorage entries
        localStorage.removeItem("soma_space_unlocked");
        localStorage.removeItem("soma_space_event_id");
        localStorage.removeItem("soma_space_unlocked_timestamp");
      }
    }

    (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      setShowNav(true);

      if (wasUnlocked) {
        // Restore unlocked state
        await restoreUnlockedState();
      } else {
        // Normal initialization flow - use config messages
        await botSay({ type: "bot", text: config.chat_welcome_message || "hey :) welcome to soma space" });

        await botSay({
          type: "bot",
          text: config.chat_intro_message || "this is a movement gathering rooted in presence and free expression, with gentle guidance throughout. no experience required — just come as you are",
        });

        await botSay({ type: "bot_manifesto_link" });

        await botSay({
          type: "bot",
          text: config.chat_password_prompt || "to see details of our next gathering and reserve your spot, type the password",
        });

        setPhase("await_password");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingConfig, event, config]);

  useEffect(() => {
    if (chatScrollRef.current && bottomRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  async function loadEventStatus() {
    if (!event) return false;
    try {
      const res = await fetch(`/api/event-status?eventId=${event.id}`);
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

  // Function to restore unlocked state from localStorage
  const restoreUnlockedState = async () => {
    if (!event || !config) return;
    setShowNav(true);
    
    // Restore messages (excluding password prompt and access granted since content is already revealed)
    setLines([
      { type: "bot", text: config.chat_welcome_message || "hey :) welcome to soma space" },
      {
        type: "bot",
        text: config.chat_intro_message || "this is a movement gathering rooted in presence and free expression, with gentle guidance throughout. no experience required — just come as you are",
      },
      { type: "bot_manifesto_link" },
      { type: "bot", text: config.chat_event_announcement || `join us for ${event.name}` },
      {
        type: "bot",
        text: config.chat_event_description || config.event_description || "",
      },
      {
        type: "bot",
        text: `${event.date} • ${event.time}`,
      },
      {
        type: "bot",
        text: config.chat_location_message || "location shared after reserving (~25 minutes west of downtown mall)",
      },
      {
        type: "bot",
        text: config.chat_contribution_message || "sliding scale contribution ($22–$44, your choice). nobody turned away for lack of funds. reach out if you need support!",
      },
    ]);

    // Check event status and add appropriate link
    const isFull = await loadEventStatus();
    if (isFull) {
      setLines((prev) => [
        ...prev,
        { 
          type: "bot", 
          text: config.chat_full_message || "we checked, and this gathering is currently full" 
        },
        { 
          type: "bot", 
          text: config.chat_waitlist_message || "join the waitlist and we'll reach out if a spot opens. we'll also let you know about future gatherings" 
        },
        { type: "bot_waitlist_link" },
      ]);
    } else {
      setLines((prev) => [...prev, { type: "bot_reserve_link" }]);
    }

    setPhase("unlocked");
  };

  async function createCheckoutSession(override?: { email?: string; customerName?: string; pendingOrderId?: string }) {
    if (isCreatingCheckout) return;
    
    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount < 22 || amount > 44) {
      alert("Please enter an amount between $22 and $44");
      return;
    }
    
    const email = (override?.email?.trim() ?? registerData.email?.trim()) || undefined;
    const customerName = (override?.customerName?.trim() ?? [registerData.firstName, registerData.lastName].filter(Boolean).join(" ").trim()) || undefined;
    const pendingOrderId = override?.pendingOrderId;

    setIsCreatingCheckout(true);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: contributionAmount,
          email,
          customerName,
          ...(pendingOrderId && { pendingOrderId }),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to create checkout session:", errorData);
        if (errorData.needWaiver) {
          return { needWaiver: true, waiverUrl: errorData.waiverUrl };
        }
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
          eventId: event?.id || "",
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

    // Handle register flow (for waiver + checkout)
    if (phase === "register_first_name") {
      setRegisterData((prev) => ({ ...prev, firstName: trimmed }));
      await botSay({ type: "bot", text: `thanks, ${trimmed}. what's your last name?` });
      setPhase("register_last_name");
      return;
    }

    if (phase === "register_last_name") {
      setRegisterData((prev) => ({ ...prev, lastName: trimmed }));
      await botSay({ type: "bot", text: "and your email?" });
      setPhase("register_email");
      return;
    }

    if (phase === "register_email") {
      if (!trimmed.includes("@")) {
        await botSay({ type: "bot", text: "please enter a valid email address" });
        return;
      }
      const fName = registerData.firstName;
      const lName = registerData.lastName;
      setRegisterData((prev) => ({ ...prev, email: trimmed }));

      const maxTickets = (config?.max_guests_per_order ?? 3) + 1;
      if (config?.multi_ticket_enabled) {
        await botSay({ type: "bot", text: `how many spots do you need? (1–${maxTickets})` });
        setPhase("register_num_tickets");
        return;
      }

      // Single ticket: check waiver then redirect to waiver or checkout
      try {
        const checkRes = await fetch(`/api/waiver/check?email=${encodeURIComponent(trimmed)}`);
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData.signed) {
          await botSay({ type: "bot", text: "you've already signed the waiver. taking you to payment…" });
          const result = await createCheckoutSession({
            email: trimmed,
            customerName: [fName, lName].filter(Boolean).join(" ").trim() || undefined,
          });
          if (result?.needWaiver) {
            const params = new URLSearchParams({
              firstName: fName,
              lastName: lName,
              email: trimmed,
              amount: String(contributionAmount),
            });
            window.location.href = `/waiver?${params.toString()}`;
          }
          return;
        }
      } catch {
        await botSay({ type: "bot", text: "something went wrong. please try again." });
        setPhase("register_email");
        return;
      }
      try {
        const validateRes = await fetch(`/api/validate-email?email=${encodeURIComponent(trimmed)}`);
        const validateData = await validateRes.json().catch(() => ({}));
        if (!validateData.valid) {
          await botSay({ type: "bot", text: validateData.error || "please enter a valid email address" });
          return;
        }
        const params = new URLSearchParams({
          firstName: fName,
          lastName: lName,
          email: trimmed,
          amount: contributionAmount,
        });
        window.location.href = `/waiver?${params.toString()}`;
      } catch {
        await botSay({ type: "bot", text: "something went wrong. please try again." });
        setPhase("register_email");
      }
      return;
    }

    const maxTicketsForGuests = (config?.max_guests_per_order ?? 3) + 1;
    if (phase === "register_num_tickets") {
      const n = parseInt(trimmed, 10);
      if (isNaN(n) || n < 1 || n > maxTicketsForGuests) {
        await botSay({ type: "bot", text: `please enter a number from 1 to ${maxTicketsForGuests}` });
        return;
      }
      setNumTickets(n);
      if (n === 1) {
        const fName = registerData.firstName;
        const lName = registerData.lastName;
        const email = registerData.email;
        try {
          const checkRes = await fetch(`/api/waiver/check?email=${encodeURIComponent(email)}`);
          const checkData = await checkRes.json().catch(() => ({}));
          if (checkData.signed) {
            await botSay({ type: "bot", text: "you've already signed the waiver. taking you to payment…" });
            const result = await createCheckoutSession({
              email,
              customerName: [fName, lName].filter(Boolean).join(" ").trim() || undefined,
            });
            if (result?.needWaiver) {
              const params = new URLSearchParams({
                firstName: fName,
                lastName: lName,
                email,
                amount: String(contributionAmount),
              });
              window.location.href = `/waiver?${params.toString()}`;
            }
            return;
          }
        } catch {
          await botSay({ type: "bot", text: "something went wrong. please try again." });
          return;
        }
        try {
          const validateRes = await fetch(`/api/validate-email?email=${encodeURIComponent(email)}`);
          const validateData = await validateRes.json().catch(() => ({}));
          if (!validateData.valid) {
            await botSay({ type: "bot", text: validateData.error || "please enter a valid email address" });
            return;
          }
          const params = new URLSearchParams({
            firstName: fName,
            lastName: lName,
            email,
            amount: contributionAmount,
          });
          window.location.href = `/waiver?${params.toString()}`;
        } catch {
          await botSay({ type: "bot", text: "something went wrong. please try again." });
        }
        return;
      }
      setMultiTicketGuests([]);
      await botSay({ type: "bot", text: n > 2 ? "what's your first guest's first name?" : "what's your guest's first name?" });
      setPhase("register_guest_first_name");
      return;
    }

    if (phase === "register_guest_first_name") {
      setCurrentGuestFirstName(trimmed);
      const n = multiTicketGuests.length + 1;
      await botSay({ type: "bot", text: n === 1 ? "and their last name?" : `and guest ${n}'s last name?` });
      setPhase("register_guest_last_name");
      return;
    }

    if (phase === "register_guest_last_name") {
      const fullName = [currentGuestFirstName, trimmed].filter(Boolean).join(" ").trim() || "Guest";
      setCurrentGuestFirstName("");
      const nextGuests = [...multiTicketGuests, { name: fullName, email: "", amount: 0 }];
      setMultiTicketGuests(nextGuests);
      const n = nextGuests.length;
      await botSay({ type: "bot", text: n === 1 ? "what's their email?" : `what's guest ${n}'s email?` });
      setPhase("register_guest_email");
      return;
    }

    if (phase === "register_guest_email") {
      if (!trimmed.includes("@")) {
        await botSay({ type: "bot", text: "please enter a valid email address" });
        return;
      }
      const idx = multiTicketGuests.length - 1;
      if (idx < 0) {
        setPhase("register_email");
        return;
      }
      const nextGuests = [...multiTicketGuests];
      nextGuests[idx] = { ...nextGuests[idx], email: trimmed };
      setMultiTicketGuests(nextGuests);
      const n = nextGuests.length;
      await botSay({ type: "bot", text: n === 1 ? "what amount would they like to contribute? ($22–44)" : `contribution for guest ${n}? ($22–44)` });
      setPhase("register_guest_amount");
      return;
    }

    if (phase === "register_guest_amount") {
      const amt = parseFloat(trimmed);
      if (isNaN(amt) || amt < 22 || amt > 44) {
        await botSay({ type: "bot", text: "please enter an amount between 22 and 44" });
        return;
      }
      const idx = multiTicketGuests.length - 1;
      if (idx < 0) {
        setPhase("register_email");
        return;
      }
      const nextGuests = [...multiTicketGuests];
      nextGuests[idx] = { ...nextGuests[idx], amount: amt };
      setMultiTicketGuests(nextGuests);
      const needMore = nextGuests.length < (numTickets - 1);
      if (needMore) {
        const n = nextGuests.length + 1;
        await botSay({ type: "bot", text: `what's guest ${n}'s first name?` });
        setPhase("register_guest_first_name");
        return;
      }
      const fName = registerData.firstName;
      const lName = registerData.lastName;
      const payerEmail = registerData.email;
      const payerAmount = parseFloat(contributionAmount) || 33;
      const tickets = [
        { name: [fName, lName].filter(Boolean).join(" ").trim() || "Guest", email: payerEmail, amount: payerAmount },
        ...nextGuests,
      ];
      try {
        const res = await fetch("/api/pending-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: event?.id || undefined, tickets }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) {
          await botSay({ type: "bot", text: "something went wrong. please try again." });
          return;
        }
        const pendingOrderId = data.id as string;
        // Check waiver before redirecting: if payer already signed, go straight to checkout
        try {
          const checkRes = await fetch(`/api/waiver/check?email=${encodeURIComponent(payerEmail)}`);
          const checkData = await checkRes.json().catch(() => ({}));
          if (checkData.signed) {
            await botSay({ type: "bot", text: "you've already signed the waiver. taking you to payment…" });
            const result = await createCheckoutSession({
              email: payerEmail,
              customerName: [fName, lName].filter(Boolean).join(" ").trim() || undefined,
              pendingOrderId,
            });
            if (result?.needWaiver) {
              const params = new URLSearchParams({
                firstName: fName,
                lastName: lName,
                email: payerEmail,
                amount: String(payerAmount),
                pendingOrderId,
              });
              window.location.href = `/waiver?${params.toString()}`;
            }
            return;
          }
        } catch {
          await botSay({ type: "bot", text: "something went wrong. please try again." });
          return;
        }
        const params = new URLSearchParams({
          firstName: fName,
          lastName: lName,
          email: payerEmail,
          amount: String(payerAmount),
          pendingOrderId,
        });
        window.location.href = `/waiver?${params.toString()}`;
      } catch {
        await botSay({ type: "bot", text: "something went wrong. please try again." });
      }
      return;
    }

    // Handle waitlist collection phases
    if (phase === "waitlist_first_name") {
      setWaitlistData((prev) => ({ ...prev, firstName: trimmed }));
      await botSay({ type: "bot", text: `thanks, ${trimmed}. what's your last name?` });
      setPhase("waitlist_last_name");
      return;
    }

    if (phase === "waitlist_last_name") {
      setWaitlistData((prev) => ({ ...prev, lastName: trimmed }));
      await botSay({ type: "bot", text: "and your email?" });
      setPhase("waitlist_email");
      return;
    }

    if (phase === "waitlist_email") {
      if (!trimmed.includes("@")) {
        await botSay({ type: "bot", text: "please enter a valid email address" });
        return;
      }
      try {
        const validateRes = await fetch(`/api/validate-email?email=${encodeURIComponent(trimmed)}`);
        const validateData = await validateRes.json().catch(() => ({}));
        if (!validateData.valid) {
          await botSay({ type: "bot", text: validateData.error || "please enter a valid email address" });
          return;
        }
      } catch {
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

    if (!event || !config) return;

    // Store unlocked state in localStorage with current event ID and timestamp
    if (typeof window !== "undefined") {
      localStorage.setItem("soma_space_unlocked", "true");
      localStorage.setItem("soma_space_event_id", event.id);
      localStorage.setItem("soma_space_unlocked_timestamp", Date.now().toString());
    }

    setPhase("unlocked");

    // Show typing indicator, then access granted
    await botSay({ type: "bot", text: config.chat_access_granted_message || "access granted" });

    // Show typing indicator, then event announcement
    await botSay({ type: "bot", text: config.chat_event_announcement || `join us for ${event.name}` });

    // Show typing indicator, then event details
    await botSay({
      type: "bot",
      text: config.chat_event_description || config.event_description || "",
    });

    await botSay({
      type: "bot",
      text: `${event.date} • ${event.time}`,
    });

    await botSay({
      type: "bot",
      text: config.chat_location_message || "location shared after reserving (~25 minutes west of downtown mall)",
    });

    await botSay({
      type: "bot",
      text: config.chat_contribution_message || "sliding scale contribution ($22–$44, your choice). nobody turned away for lack of funds. reach out if you need support!",
    });

    // Check event status before showing reserve link
    const isFull = await loadEventStatus();
    
    if (isFull) {
      await botSay({ 
        type: "bot", 
        text: config.chat_full_message || "we checked, and this gathering is currently full" 
      });
      await botSay({ 
        type: "bot", 
        text: config.chat_waitlist_message || "join the waitlist and we'll reach out if a spot opens. we'll also let you know about future gatherings" 
      });
      await botSay({ type: "bot_waitlist_link" });
    } else {
      // Show reserve link
      await botSay({ type: "bot_reserve_link" });
    }
  }

  // Apply dynamic colors
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary-color", primaryColor);
      document.documentElement.style.setProperty("--background-color", backgroundColor);
    }
  }, [primaryColor, backgroundColor]);

  if (isLoadingConfig || !event) {
    return (
      <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
        <div className="relative mx-auto flex h-screen max-w-2xl flex-col px-6 pt-20 pb-10 items-center justify-center">
          <p className="text-sm text-white/50">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden text-white" style={{ backgroundColor }}>
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
                            className="hover:opacity-80"
                            style={{ color: primaryColor }}
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
                          className="hover:opacity-80 text-left max-w-[85%]"
                          style={{ color: primaryColor }}
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
                            className="bg-transparent border-b border-white/20 text-white/80 text-sm focus:outline-none w-20 px-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                            placeholder="33"
                          />
                          {!hasClickedReserveSpot && (
                            <button
                              onClick={async () => {
                                setHasClickedReserveSpot(true);
                                await botSay({ type: "bot", text: "to complete your reservation, please provide your first name" });
                                setPhase("register_first_name");
                              }}
                              disabled={isCreatingCheckout}
                              className="hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: primaryColor }}
                            >
                              reserve your spot →
                            </button>
                          )}
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
                  className="w-full bg-transparent px-0 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={
                    phase === "await_password" ? "password" :
                    phase === "waitlist_first_name" ? "first name" :
                    phase === "waitlist_last_name" ? "last name" :
                    phase === "waitlist_email" ? "email" :
                    phase === "waitlist_phone" ? "phone (optional)" :
                    phase === "register_first_name" ? "first name" :
                    phase === "register_last_name" ? "last name" :
                    phase === "register_email" ? "email" :
                    phase === "register_num_tickets" ? "number of tickets" :
                    phase === "register_guest_first_name" ? "first name" :
                    phase === "register_guest_last_name" ? "last name" :
                    phase === "register_guest_email" ? "email" :
                    phase === "register_guest_amount" ? "amount (22–44)" :
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
                  type={phase === "waitlist_email" || phase === "register_email" || phase === "register_guest_email" ? "email" : phase === "waitlist_phone" ? "tel" : "text"}
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