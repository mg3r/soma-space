"use client";

import { useState, useEffect, useCallback } from "react";
import { nextEvent } from "@/config/event";
import Link from "next/link";

type Registration = {
  sessionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amountPaid: number;
  paymentDate: string;
  eventId: string;
};

type Stats = {
  eventId: string;
  capacity: number;
  registered: number;
  remainingSpots: number;
  totalRevenue: number;
  averageContribution: number;
};

type WaitlistEntry = {
  id: string;
  event_id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(nextEvent.id);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [capacity, setCapacity] = useState(22);
  const [newCapacity, setNewCapacity] = useState("");
  const [isUpdatingCapacity, setIsUpdatingCapacity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const errorMessages = [
    "hmm, that didn't quite work. feel free to try again.",
    "not quite. you're welcome to try again.",
    "that doesn't seem to be it. take another try.",
  ];

  const getRandomErrorMessage = () => {
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  };

  async function checkPassword() {
    const trimmed = password.trim();
    if (!trimmed) return;

    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load registrations
      const regRes = await fetch(`/api/admin/registrations?eventId=${selectedEvent}`);
      if (regRes.ok) {
        const regData = await regRes.json();
        setRegistrations(regData.registrations || []);
      }

      // Load waitlist
      const waitlistRes = await fetch(`/api/admin/waitlist?eventId=${selectedEvent}`);
      if (waitlistRes.ok) {
        const waitlistData = await waitlistRes.json();
        setWaitlist(waitlistData.waitlist || []);
      }

      // Load stats
      const statsRes = await fetch(`/api/admin/stats?eventId=${selectedEvent}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        setCapacity(statsData.stats.capacity);
      }

      // Load capacity
      const capRes = await fetch(`/api/admin/capacity?eventId=${selectedEvent}`);
      if (capRes.ok) {
        const capData = await capRes.json();
        const currentCapacity = capData.capacity || 22;
        setCapacity(currentCapacity);
        setNewCapacity(currentCapacity.toString());
      }
    } catch {
      console.error("Error loading data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent]);

  async function updateCapacity() {
    if (!newCapacity || isNaN(parseInt(newCapacity)) || parseInt(newCapacity) < 0) {
      alert("Please enter a valid capacity number");
      return;
    }

    setIsUpdatingCapacity(true);
    try {
      const res = await fetch("/api/admin/capacity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent,
          capacity: parseInt(newCapacity),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Capacity update noted. Remember to update environment variables in Vercel for this to take effect.");
        await loadData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to update capacity");
      }
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setIsUpdatingCapacity(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPassword();
  };

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#111111] text-white">
        <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 pt-20 pb-10">
          <div className="flex flex-1 items-center">
            <div className="flex-1">
              <h1 className="text-sm">admin dashboard</h1>

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

  // Show dashboard after authentication
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#111111] text-white">
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-sm">admin dashboard</h1>
            <Link
              href="/"
              className="mt-2 text-xs text-white/50 hover:text-white/80"
            >
              ← back to site
            </Link>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="text-xs text-white/50 hover:text-white/80"
          >
            sign out
          </button>
        </div>

        {/* Event Selector */}
        <div className="mb-8">
          <label className="mb-2 block text-sm text-white/70">
            select event
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] px-3 py-2"
          >
            <option value="RENEWAL">RENEWAL</option>
            {/* Add more events here as needed */}
          </select>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">registered</p>
              <p className="mt-1 text-2xl text-white">{stats.registered}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">capacity</p>
              <p className="mt-1 text-2xl text-white">{stats.capacity}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">remaining</p>
              <p className="mt-1 text-2xl text-[#05fd00]">{stats.remainingSpots}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">total revenue</p>
              <p className="mt-1 text-2xl text-white">${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Capacity Management */}
        <div className="mb-8 bg-white/5 border border-white/10 p-6">
          <h2 className="mb-4 text-sm text-[#05fd00]">capacity management</h2>
          <div className="flex items-center gap-4">
            <div>
              <label className="mb-2 block text-xs text-white/70">
                current capacity
              </label>
              <input
                type="number"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                min="0"
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] w-24 px-3 py-2"
              />
            </div>
            <button
              onClick={updateCapacity}
              disabled={isUpdatingCapacity}
              className="mt-6 rounded border border-[#05fd00] bg-transparent px-4 py-2 text-sm text-[#05fd00] hover:bg-[#05fd00]/10 disabled:opacity-50"
            >
              {isUpdatingCapacity ? "updating..." : "update capacity"}
            </button>
          </div>
          <p className="mt-4 text-xs text-white/50">
            {capacity === parseInt(newCapacity) 
              ? "capacity is stored in Supabase and updates immediately"
              : "if Supabase is not configured, update EVENT_CAPACITY_" + selectedEvent + " or EVENT_CAPACITY in Vercel environment variables"}
          </p>
        </div>

        {/* Registrations Table */}
        <div className="bg-white/5 border border-white/10">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-sm text-[#05fd00]">
              registrations ({registrations.length})
            </h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-white/50">
              loading...
            </div>
          ) : registrations.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/50">
              no registrations yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      name
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      email
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      phone
                    </th>
                    <th className="px-4 py-3 text-right text-xs text-white/50">
                      amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr
                      key={reg.sessionId}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-sm text-white/80">
                        {reg.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {reg.customerEmail}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {reg.customerPhone}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-white/80">
                        ${reg.amountPaid.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {new Date(reg.paymentDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Waitlist Table */}
        <div className="mt-8 bg-white/5 border border-white/10">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-sm text-[#05fd00]">
              waitlist ({waitlist.length})
            </h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-white/50">
              loading...
            </div>
          ) : waitlist.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/50">
              no waitlist entries yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      name
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      email
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-sm text-white/80">
                        {entry.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {entry.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {entry.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

