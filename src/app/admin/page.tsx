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
  notes?: string;
  isExcluded?: boolean;
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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(nextEvent.id);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newCapacity, setNewCapacity] = useState("");
  const [isUpdatingCapacity, setIsUpdatingCapacity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [excludingSessionId, setExcludingSessionId] = useState<string | null>(
    null
  );
  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [customEmails, setCustomEmails] = useState("");
  const [useBcc, setUseBcc] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number } | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const errorMessages = [
    "hmm, that didn't quite work. feel free to try again.",
    "not quite. you're welcome to try again.",
    "that doesn't seem to be it. take another try.",
  ];

  const getRandomErrorMessage = () => {
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  };

  // Check if already authenticated on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/admin/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

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
        setNewCapacity(statsData.stats.capacity.toString());
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

  // Reset email selection when event changes
  useEffect(() => {
    setSelectedSessionIds(new Set());
    setEmailSubject("");
    setEmailBody("");
    setCustomEmails("");
    setEmailResult(null);
    setAttachments([]);
  }, [selectedEvent]);

  // Calculate email recipients
  const getEmailRecipients = () => {
    const emails: string[] = [];
    
    // Parse custom emails first
    const customEmailList: string[] = [];
    if (customEmails.trim()) {
      customEmails.split(/[,\n]/).forEach(email => {
        const trimmed = email.trim();
        if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          customEmailList.push(trimmed);
        }
      });
    }

    // If custom emails are provided, ONLY send to those (unless registrations are also selected)
    if (customEmailList.length > 0 && selectedSessionIds.size === 0) {
      return customEmailList;
    }

    // If user has typed something in custom emails but it's invalid, don't default to all registrations
    // Only include registrations if custom emails field is empty
    const hasCustomEmailInput = customEmails.trim().length > 0;
    
    // Include selected registrations
    if (selectedSessionIds.size > 0) {
      registrations
        .filter(reg => selectedSessionIds.has(reg.sessionId) && !reg.isExcluded)
        .forEach(reg => {
          if (reg.customerEmail && reg.customerEmail !== "N/A") {
            emails.push(reg.customerEmail);
          }
        });
    } else if (!hasCustomEmailInput) {
      // Only include all registrations if no custom email input AND no selection
      registrations
        .filter(reg => !reg.isExcluded)
        .forEach(reg => {
          if (reg.customerEmail && reg.customerEmail !== "N/A") {
            emails.push(reg.customerEmail);
          }
        });
    }

    // Add custom emails to the list (if registrations are also selected)
    customEmailList.forEach(email => emails.push(email));

    return [...new Set(emails)];
  };

  async function sendEmailToRegistrations() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      alert("Please enter both subject and email body");
      return;
    }

    const recipients = getEmailRecipients();
    if (recipients.length === 0) {
      alert("No recipients selected. Please select registrations or add custom email addresses.");
      return;
    }

    if (!confirm(`Send email to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}?`)) {
      return;
    }

    setIsSendingEmail(true);
    setEmailResult(null);
    
    try {
      // Use FormData if there are attachments, otherwise use JSON
      let body: FormData | string;
      const headers: Record<string, string> = {};

      if (attachments.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append("eventId", selectedEvent);
        formData.append("subject", emailSubject);
        formData.append("htmlBody", emailBody);
        if (selectedSessionIds.size > 0) {
          formData.append("selectedSessionIds", JSON.stringify(Array.from(selectedSessionIds)));
        }
        if (customEmails.trim()) {
          formData.append("customEmails", JSON.stringify(customEmails.split(/[,\n]/).map(e => e.trim()).filter(e => e)));
        }
        formData.append("excludeExcluded", "true");
        formData.append("useBcc", useBcc ? "true" : "false");
        
        // Add attachments
        attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file);
        });
        
        body = formData;
        // Don't set Content-Type header - browser will set it with boundary
      } else {
        // Use JSON for no attachments
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
          eventId: selectedEvent,
          subject: emailSubject,
          htmlBody: emailBody,
          selectedSessionIds: selectedSessionIds.size > 0 ? Array.from(selectedSessionIds) : undefined,
          customEmails: customEmails.trim() ? customEmails.split(/[,\n]/).map(e => e.trim()).filter(e => e) : undefined,
          excludeExcluded: true,
          useBcc: useBcc,
        });
      }

      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: headers,
        body: body,
      });

      if (res.ok) {
        const data = await res.json();
        setEmailResult({ sent: data.sent, failed: data.failed });
        if (data.failed > 0 && data.errors) {
          console.error("Email errors:", data.errors);
        }
        alert(`Emails sent: ${data.sent} successful, ${data.failed} failed`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to send emails");
      }
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  }

  const toggleRegistrationSelection = (sessionId: string) => {
    setSelectedSessionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const selectAllRegistrations = () => {
    const activeRegistrations = registrations.filter(reg => !reg.isExcluded);
    setSelectedSessionIds(new Set(activeRegistrations.map(reg => reg.sessionId)));
  };

  const clearSelection = () => {
    setSelectedSessionIds(new Set());
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPassword();
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#111111] text-white">
        <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 pt-20 pb-10">
          <div className="flex flex-1 items-center">
            <div className="flex-1">
              <h1 className="text-sm">admin dashboard</h1>
              <p className="mt-6 text-sm text-white/70">checking authentication...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
            onClick={async () => {
              try {
                await fetch("/api/admin/auth", { method: "DELETE" });
                setIsAuthenticated(false);
                setPassword("");
              } catch (error) {
                console.error("Error logging out:", error);
                // Still log out locally even if API call fails
                setIsAuthenticated(false);
                setPassword("");
              }
            }}
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
            capacity is stored in Supabase and updates immediately
          </p>
        </div>

        {/* Registrations Table */}
        <div className="bg-white/5 border border-white/10">
          <div className="border-b border-white/10 p-4 flex items-center justify-between">
            <h2 className="text-sm text-[#05fd00]">
              registrations ({registrations.length})
            </h2>
            {registrations.filter(r => !r.isExcluded).length > 0 && (
              <button
                onClick={selectedSessionIds.size === registrations.filter(r => !r.isExcluded).length ? clearSelection : selectAllRegistrations}
                className="text-xs text-white/50 hover:text-white/80"
              >
                {selectedSessionIds.size === registrations.filter(r => !r.isExcluded).length ? "clear all" : "select all"}
              </button>
            )}
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
                    <th className="px-4 py-3 text-left text-xs text-white/50 w-12">
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.size > 0 && selectedSessionIds.size === registrations.filter(r => !r.isExcluded).length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllRegistrations();
                          } else {
                            clearSelection();
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
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
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr
                      key={reg.sessionId}
                      className={`border-b border-white/5 hover:bg-white/5 ${
                        reg.isExcluded ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {!reg.isExcluded && (
                          <input
                            type="checkbox"
                            checked={selectedSessionIds.has(reg.sessionId)}
                            onChange={() => toggleRegistrationSelection(reg.sessionId)}
                            className="w-4 h-4"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {reg.customerName}
                        {reg.isExcluded && (
                          <span className="ml-2 text-xs text-yellow-500">
                            (excluded)
                          </span>
                        )}
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
                      <td className="px-4 py-3 text-sm">
                        {reg.isExcluded ? (
                          <button
                            onClick={async () => {
                              if (
                                !confirm(
                                  "Un-exclude this registration from capacity counts?"
                                )
                              )
                                return;
                              setExcludingSessionId(reg.sessionId);
                              try {
                                const res = await fetch(
                                  `/api/admin/exclude?sessionId=${reg.sessionId}`,
                                  { method: "DELETE" }
                                );
                                if (res.ok) {
                                  await loadData();
                                } else {
                                  alert("Failed to un-exclude registration");
                                }
                              } catch {
                                alert("An error occurred");
                              } finally {
                                setExcludingSessionId(null);
                              }
                            }}
                            disabled={excludingSessionId === reg.sessionId}
                            className="text-xs text-yellow-500 hover:text-yellow-400 disabled:opacity-50"
                          >
                            {excludingSessionId === reg.sessionId
                              ? "un-excluding..."
                              : "un-exclude"}
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const reason = prompt(
                                "Reason for exclusion (optional):"
                              );
                              if (reason === null) return; // User cancelled
                              setExcludingSessionId(reg.sessionId);
                              try {
                                const res = await fetch("/api/admin/exclude", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    sessionId: reg.sessionId,
                                    eventId: selectedEvent,
                                    reason: reason || undefined,
                                  }),
                                });
                                if (res.ok) {
                                  await loadData();
                                } else {
                                  alert("Failed to exclude registration");
                                }
                              } catch {
                                alert("An error occurred");
                              } finally {
                                setExcludingSessionId(null);
                              }
                            }}
                            disabled={excludingSessionId === reg.sessionId}
                            className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50"
                          >
                            {excludingSessionId === reg.sessionId
                              ? "excluding..."
                              : "exclude"}
                          </button>
                        )}
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

        {/* Email Section */}
        <div className="mt-8 bg-white/5 border border-white/10 p-6">
          <h2 className="mb-4 text-sm text-[#05fd00]">send email</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs text-white/70">
                subject
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] w-full px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs text-white/70">
                email body (HTML)
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Email body (HTML supported)"
                rows={8}
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] w-full px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs text-white/70">
                email addresses (comma or newline separated)
              </label>
              <p className="mb-2 text-xs text-white/40">
                enter email addresses here, or select registrations above
              </p>
              <textarea
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                rows={3}
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] w-full px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs text-white/70">
                attachments (PDF, images, etc.)
              </label>
              <input
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none focus:border-[#05fd00] w-full px-3 py-2 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#05fd00]/20 file:text-[#05fd00] hover:file:bg-[#05fd00]/30"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx"
              />
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70">
                      <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-400"
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={useBcc}
                  onChange={(e) => setUseBcc(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>use BCC (faster, but less reliable)</span>
              </label>
            </div>
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/50 mb-2">
                recipients: <span className="text-[#05fd00]">{getEmailRecipients().length}</span>
                {selectedSessionIds.size > 0 && (
                  <span className="ml-2">
                    ({selectedSessionIds.size} selected from registrations)
                  </span>
                )}
                {(() => {
                  // Parse custom emails to check if there are valid ones
                  const customEmailList: string[] = [];
                  if (customEmails.trim()) {
                    customEmails.split(/[,\n]/).forEach(email => {
                      const trimmed = email.trim();
                      if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                        customEmailList.push(trimmed);
                      }
                    });
                  }
                  return customEmailList.length > 0 && selectedSessionIds.size === 0 ? (
                    <span className="ml-2 text-white/40">
                      (custom emails only)
                    </span>
                  ) : null;
                })()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={sendEmailToRegistrations}
                  disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim() || getEmailRecipients().length === 0}
                  className="rounded border border-[#05fd00] bg-transparent px-4 py-2 text-sm text-[#05fd00] hover:bg-[#05fd00]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingEmail ? "sending..." : `send to ${getEmailRecipients().length} recipient${getEmailRecipients().length !== 1 ? "s" : ""}`}
                </button>
                {selectedSessionIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-xs text-white/50 hover:text-white/80"
                  >
                    clear selection
                  </button>
                )}
              </div>
              {emailResult && (
                <p className="mt-2 text-xs text-white/50">
                  sent: <span className="text-[#05fd00]">{emailResult.sent}</span> | 
                  failed: <span className="text-red-500">{emailResult.failed}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

