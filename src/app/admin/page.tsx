"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { nextEvent } from "@/config/event";
import Link from "next/link";
import type { EventConfig } from "@/lib/event-config";

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
  isRefunded?: boolean;
  exclusionReason?: string;
};

type Stats = {
  eventId: string;
  capacity: number;
  registered: number;
  activeRegistered: number;
  excluded: number;
  remainingSpots: number;
  totalRevenue: number;
  refundedAmount: number;
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
  const emailEditorRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "email" | "event-config">("overview");
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string; body: string; attachments?: Array<{ filename: string; content: string; content_type?: string }>; updated_at: string }>>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Event config state
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [isLoadingEventConfig, setIsLoadingEventConfig] = useState(false);
  const [isSavingEventConfig, setIsSavingEventConfig] = useState(false);
  const [isSavingAsNewEvent, setIsSavingAsNewEvent] = useState(false);
  const [allEventConfigs, setAllEventConfigs] = useState<EventConfig[]>([]);
  // Active event config (for colors) - separate from selected event config (for editing)
  const [activeEventConfig, setActiveEventConfig] = useState<EventConfig | null>(null);
  // Track if we've initialized the selected event from active event
  const hasInitializedEvent = useRef(false);

  const loadEmailTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/admin/email-templates");
      if (res.ok) {
        const data = await res.json();
        setEmailTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error loading email templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  const loadEventConfig = useCallback(async () => {
    setIsLoadingEventConfig(true);
    try {
      const res = await fetch("/api/admin/event-config?active=true");
      if (res.ok) {
        const data = await res.json();
        setEventConfig(data.config);
      }
    } catch (error) {
      console.error("Error loading event config:", error);
    } finally {
      setIsLoadingEventConfig(false);
    }
  }, []);

  // Load active event config separately (for colors)
  const loadActiveEventConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/event-config?active=true");
      if (res.ok) {
        const data = await res.json();
        setActiveEventConfig(data.config);
      }
    } catch (error) {
      console.error("Error loading active event config:", error);
    }
  }, []);

  const loadAllEventConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/event-config");
      if (res.ok) {
        const data = await res.json();
        setAllEventConfigs(data.configs || []);
      }
    } catch (error) {
      console.error("Error loading all event configs:", error);
    }
  }, []);

  const loadEventConfigById = async (id: string) => {
    setIsLoadingEventConfig(true);
    try {
      const res = await fetch(`/api/admin/event-config?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setEventConfig(data.config);
        // Don't update activeEventConfig here - colors should always come from active event
      }
    } catch (error) {
      console.error("Error loading event config:", error);
    } finally {
      setIsLoadingEventConfig(false);
    }
  };

  const saveEventConfig = async () => {
    if (!eventConfig) return;
    
    setIsSavingEventConfig(true);
    try {
      const method = eventConfig.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/event-config", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setEventConfig(data.config);
        await loadAllEventConfigs();
        // Reload active event config in case the active event changed
        await loadActiveEventConfig();
        // Update selected event to the newly saved one
        if (data.config?.event_id) {
          setSelectedEvent(data.config.event_id);
        }
        alert("Event configuration saved successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to save event configuration");
      }
    } catch (error) {
      console.error("Error saving event config:", error);
      alert("An error occurred while saving the event configuration");
    } finally {
      setIsSavingEventConfig(false);
    }
  };

  const saveAsNewEvent = async () => {
    if (!eventConfig) return;

    // Confirmation dialog with clear warning
    const confirmMessage = `Are you sure you want to create a NEW event configuration based on "${eventConfig.event_name || eventConfig.event_id}"?\n\nThis will:\n- Create a copy of the current configuration\n- Not modify the existing event\n- Set the new event as inactive by default\n\nEnter the new event ID (e.g., "SPRING2025"):`;
    
    const newEventId = prompt(confirmMessage);
    if (!newEventId || !newEventId.trim()) {
      return; // User cancelled or entered nothing
    }

    const trimmedEventId = newEventId.trim();
    
    // Validate event ID format (alphanumeric, underscores, hyphens)
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedEventId)) {
      alert("Event ID can only contain letters, numbers, underscores, and hyphens.");
      return;
    }

    // Check if event ID already exists
    const existingConfig = allEventConfigs.find(
      (config) => config.event_id?.toLowerCase() === trimmedEventId.toLowerCase()
    );
    if (existingConfig) {
      const overwrite = confirm(
        `An event with ID "${trimmedEventId}" already exists.\n\nDo you want to overwrite it?`
      );
      if (!overwrite) {
        return;
      }
    }

    setIsSavingAsNewEvent(true);
    try {
      // Create a copy without the ID, with new event_id and name
      const newConfig: EventConfig = {
        ...eventConfig,
        id: undefined, // Clear ID to create new record
        event_id: trimmedEventId,
        event_name: eventConfig.event_name ? `${eventConfig.event_name} (copy)` : trimmedEventId,
        is_active: false, // New events are inactive by default
      };

      const res = await fetch("/api/admin/event-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setEventConfig(data.config);
        await loadAllEventConfigs();
        // Update selected event to the newly created one
        if (data.config?.event_id) {
          setSelectedEvent(data.config.event_id);
        }
        alert(`New event configuration "${trimmedEventId}" created successfully!`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to create new event configuration");
      }
    } catch (error) {
      console.error("Error saving as new event:", error);
      alert("An error occurred while creating the new event configuration");
    } finally {
      setIsSavingAsNewEvent(false);
    }
  };

  const saveEmailTemplate = async () => {
    if (!templateName.trim() || !emailSubject.trim() || !emailBody.trim()) {
      alert("Please enter a template name, subject, and body");
      return;
    }

    try {
      // Convert attachments to base64 for storage
      const attachmentData = await Promise.all(
        attachments.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          return {
            filename: file.name,
            content: base64,
            content_type: file.type || undefined,
          };
        })
      );

      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          subject: emailSubject,
          body: emailBody,
          attachments: attachments.length > 0 ? attachmentData : undefined,
        }),
      });

      if (res.ok) {
        await loadEmailTemplates();
        setTemplateName("");
        setShowTemplateModal(false);
        alert("Template saved successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("An error occurred while saving the template");
    }
  };

  const loadEmailTemplate = (template: { subject: string; body: string; attachments?: Array<{ filename: string; content: string; content_type?: string }> }) => {
    setEmailSubject(template.subject);
    setEmailBody(template.body);
    // Set the editor content directly to preserve HTML formatting
    if (emailEditorRef.current) {
      emailEditorRef.current.innerHTML = template.body;
    }
    
    // Load attachments if they exist
    if (template.attachments && template.attachments.length > 0) {
      const files = template.attachments.map(att => {
        // Convert base64 back to File object
        const binaryString = atob(att.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: att.content_type || 'application/octet-stream' });
        return new File([blob], att.filename, { type: att.content_type || 'application/octet-stream' });
      });
      setAttachments(files);
    } else {
      setAttachments([]);
    }
    
    setShowTemplateModal(false);
  };

  const deleteEmailTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/email-templates?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await loadEmailTemplates();
        alert("Template deleted successfully");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("An error occurred while deleting the template");
    }
  };

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
      loadEmailTemplates();
    }
  }, [isAuthenticated, loadData, loadEmailTemplates]);

  // Reload data when selected event changes
  useEffect(() => {
    if (isAuthenticated && selectedEvent) {
      loadData();
    }
  }, [selectedEvent, isAuthenticated, loadData]);

  // Load active event config immediately when authenticated (for colors)
  useEffect(() => {
    if (isAuthenticated) {
      loadActiveEventConfig();
      loadAllEventConfigs(); // Load all configs for the dropdown
    }
  }, [isAuthenticated, loadActiveEventConfig, loadAllEventConfigs]);

  // Set initial selected event to active event when configs are first loaded
  useEffect(() => {
    if (isAuthenticated && allEventConfigs.length > 0 && activeEventConfig && !hasInitializedEvent.current) {
      const activeEventId = activeEventConfig.event_id;
      if (activeEventId) {
        setSelectedEvent(activeEventId);
        hasInitializedEvent.current = true;
      }
    }
  }, [isAuthenticated, allEventConfigs, activeEventConfig]);

  // Load event config when event-config tab is opened (for editing)
  useEffect(() => {
    if (isAuthenticated && activeTab === "event-config") {
      loadEventConfig();
    }
  }, [isAuthenticated, activeTab, loadEventConfig]);

  // Load all configs when event-config tab is active (refresh the list)
  useEffect(() => {
    if (activeTab === "event-config" && isAuthenticated) {
      loadAllEventConfigs();
    }
  }, [activeTab, isAuthenticated, loadAllEventConfigs]);

  // Get primary color from active event config (with fallback) - always use active event for colors
  const primaryColor = activeEventConfig?.primary_color || "#05fd00";
  const backgroundColor = activeEventConfig?.background_color || "#111111";

  // Apply dynamic colors from event config
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary-color", primaryColor);
      document.documentElement.style.setProperty("--background-color", backgroundColor);
    }
  }, [primaryColor, backgroundColor]);

  // Reset email selection when event changes
  useEffect(() => {
    setSelectedSessionIds(new Set());
    setEmailSubject("");
    setEmailBody("");
    setCustomEmails("");
    setEmailResult(null);
    setAttachments([]);
    if (emailEditorRef.current) {
      emailEditorRef.current.innerHTML = "";
    }
  }, [selectedEvent]);

  // Sync emailBody to editor when it changes externally
  useEffect(() => {
    if (emailEditorRef.current && emailEditorRef.current.innerHTML !== emailBody) {
      // Only update if content is different to avoid cursor jumping
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      emailEditorRef.current.innerHTML = emailBody || "";
      if (range && selection) {
        try {
          selection.removeAllRanges();
          selection.addRange(range);
        } catch {
          // Ignore selection errors
        }
      }
    }
  }, [emailBody]);

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
    
    // Include selected registrations (including excluded ones)
    if (selectedSessionIds.size > 0) {
      registrations
        .filter(reg => selectedSessionIds.has(reg.sessionId))
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
          alert(`Emails sent: ${data.sent} successful, ${data.failed} failed.\n\nErrors:\n${data.errors.slice(0, 3).join('\n')}${data.errors.length > 3 ? '\n...' : ''}`);
        } else {
          alert(`Emails sent: ${data.sent} successful, ${data.failed} failed`);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.details || errorData.error || "Failed to send emails";
        const hint = errorData.hint ? `\n\n${errorData.hint}` : '';
        alert(`${errorMsg}${hint}`);
        console.error("Email send error:", errorData);
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
    // Include all registrations, including excluded ones
    setSelectedSessionIds(new Set(registrations.map(reg => reg.sessionId)));
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
                  className="bg-white/5 border-b border-white/20 text-white/80 text-base focus:outline-none w-full px-2 py-1"
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

  // Show dashboard after authentication
  return (
    <main className="relative min-h-screen overflow-hidden text-white" style={{ backgroundColor }}>
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
            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none px-3 py-2"
            onFocus={(e) => e.target.style.borderColor = primaryColor}
            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
          >
            {allEventConfigs.length > 0 ? (
              allEventConfigs
                .filter((config) => config.event_id && config.event_id.trim() !== "")
                .sort((a, b) => {
                  // Sort: active first, then by updated_at (most recent first)
                  if (a.is_active && !b.is_active) return -1;
                  if (!a.is_active && b.is_active) return 1;
                  const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                  const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                  return bDate - aDate;
                })
                .map((config) => (
                  <option key={config.id || config.event_id} value={config.event_id}>
                    {config.event_name || config.event_id} {config.is_active ? "(active)" : ""}
                  </option>
                ))
            ) : (
              <option value="RENEWAL">RENEWAL</option>
            )}
          </select>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-white/10">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 text-sm transition-colors ${
                activeTab === "overview"
                  ? "border-b-2"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={activeTab === "overview" ? { color: primaryColor, borderColor: primaryColor } : undefined}
            >
              overview
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`pb-3 text-sm transition-colors ${
                activeTab === "email"
                  ? "border-b-2"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={activeTab === "email" ? { color: primaryColor, borderColor: primaryColor } : undefined}
            >
              email
            </button>
            <button
              onClick={() => setActiveTab("event-config")}
              className={`pb-3 text-sm transition-colors ${
                activeTab === "event-config"
                  ? "border-b-2"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={activeTab === "event-config" ? { color: primaryColor, borderColor: primaryColor } : undefined}
            >
              event configuration
            </button>
          </div>
        </div>

        {activeTab === "overview" && (
          <>
        {/* Stats Summary */}
        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">registered</p>
              <p className="mt-1 text-2xl text-white">{stats.registered}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">excluded</p>
              <p className="mt-1 text-2xl text-yellow-500">{stats.excluded}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">capacity</p>
              <p className="mt-1 text-2xl text-white">{stats.capacity}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">remaining</p>
              <p className="mt-1 text-2xl" style={{ color: primaryColor }}>{stats.remainingSpots}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">total revenue</p>
              <p className="mt-1 text-2xl text-white">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/50">refunded</p>
              <p className="mt-1 text-2xl text-red-500">${stats.refundedAmount.toFixed(2)}</p>
            </div>
          </div>
        )}

            {/* Capacity Management */}
        <div className="mb-8 bg-white/5 border border-white/10 p-6">
          <h2 className="mb-4 text-sm" style={{ color: primaryColor }}>capacity management</h2>
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
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-24 px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = primaryColor}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
              />
            </div>
            <button
              onClick={updateCapacity}
              disabled={isUpdatingCapacity}
              className="mt-6 rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: primaryColor, color: primaryColor }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
          <div className="border-b border-white/10 p-4">
            <h2 className="text-sm" style={{ color: primaryColor }}>
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
                      <td className="px-4 py-3 text-sm text-white/80">
                        {reg.customerName}
                        {reg.isRefunded && (
                          <span className="ml-2 text-xs text-red-500">
                            (refunded)
                          </span>
                        )}
                        {reg.isExcluded && !reg.isRefunded && (
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
            <h2 className="text-sm" style={{ color: primaryColor }}>
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
          </>
        )}

        {activeTab === "email" && (
          <>
            {/* Registrations Table for Email Tab */}
            <div className="mb-8 bg-white/5 border border-white/10">
              <div className="border-b border-white/10 p-4 flex items-center justify-between">
                <h2 className="text-sm" style={{ color: primaryColor }}>
                  registered attendees ({registrations.length})
                </h2>
                {registrations.length > 0 && (
                  <button
                    onClick={selectedSessionIds.size === registrations.length ? clearSelection : selectAllRegistrations}
                    className="text-xs text-white/50 hover:text-white/80"
                  >
                    {selectedSessionIds.size === registrations.length ? "clear all" : "select all"}
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
                            checked={selectedSessionIds.size > 0 && selectedSessionIds.size === registrations.length}
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
                            <input
                              type="checkbox"
                              checked={selectedSessionIds.has(reg.sessionId)}
                              onChange={() => toggleRegistrationSelection(reg.sessionId)}
                              className="w-4 h-4"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-white/80">
                            {reg.customerName}
                            {reg.isRefunded && (
                              <span className="ml-2 text-xs text-red-500">
                                (refunded)
                              </span>
                            )}
                            {reg.isExcluded && !reg.isRefunded && (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Email Form */}
            <div className="bg-white/5 border border-white/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm" style={{ color: primaryColor }}>send email</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="text-xs text-white/50 hover:text-white/80 border border-white/10 px-3 py-1 rounded"
              >
                templates
              </button>
              <button
                onClick={() => {
                  if (!emailSubject.trim() || !emailBody.trim()) {
                    alert("Please enter subject and body to save as template");
                    return;
                  }
                  setShowTemplateModal(true);
                }}
                className="text-xs text-white/50 hover:text-white/80 border border-white/10 px-3 py-1 rounded"
              >
                save template
              </button>
            </div>
          </div>
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
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = primaryColor}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs text-white/70">
                email body
              </label>
              {/* Rich Text Editor Toolbar */}
              <div className="mb-2 flex flex-wrap gap-2 border border-white/20 bg-white/5 p-2">
                <button
                  type="button"
                  onClick={() => {
                    emailEditorRef.current?.focus();
                    document.execCommand('bold', false);
                    if (emailEditorRef.current) setEmailBody(emailEditorRef.current.innerHTML);
                  }}
                  className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  title="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    emailEditorRef.current?.focus();
                    document.execCommand('italic', false);
                    if (emailEditorRef.current) setEmailBody(emailEditorRef.current.innerHTML);
                  }}
                  className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  title="Italic"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    emailEditorRef.current?.focus();
                    document.execCommand('underline', false);
                    if (emailEditorRef.current) setEmailBody(emailEditorRef.current.innerHTML);
                  }}
                  className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  title="Underline"
                >
                  <u>U</u>
                </button>
                <div className="w-px bg-white/20" />
                <button
                  type="button"
                  onClick={() => {
                    if (!emailEditorRef.current) return;
                    
                    emailEditorRef.current.focus();
                    const selection = window.getSelection();
                    
                    if (!selection) return;
                    
                    if (selection.rangeCount === 0) {
                      // No selection - create range at cursor or end of content
                      const range = document.createRange();
                      if (emailEditorRef.current.lastChild) {
                        range.setStartAfter(emailEditorRef.current.lastChild);
                        range.collapse(true);
                      } else {
                        range.selectNodeContents(emailEditorRef.current);
                        range.collapse(false);
                      }
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }
                    
                    const selectedText = selection.toString().trim();
                    
                    if (selectedText) {
                      // Text is selected - create link with selected text
                      const url = prompt("Enter URL for the link:", "https://");
                      if (url && url.trim()) {
                        // Ensure URL has protocol
                        let finalUrl = url.trim();
                        if (!finalUrl.match(/^https?:\/\//i)) {
                          finalUrl = 'https://' + finalUrl;
                        }
                        
                        // Use execCommand to create link
                        document.execCommand('createLink', false, finalUrl);
                        
                        // Update state immediately
                        if (emailEditorRef.current) {
                          // Find and style any links that were just created
                          const links = emailEditorRef.current.querySelectorAll('a');
                          links.forEach((link) => {
                            if (!link.style.color || link.style.color === '') {
                              link.style.color = primaryColor;
                              link.style.textDecoration = 'underline';
                            }
                          });
                          setEmailBody(emailEditorRef.current.innerHTML);
                        }
                      }
                    } else {
                      // No text selected - prompt for both text and URL
                      const linkText = prompt("Enter link text:", "");
                      if (linkText && linkText.trim()) {
                        const url = prompt("Enter URL:", "https://");
                        if (url && url.trim()) {
                          // Ensure URL has protocol
                          let finalUrl = url.trim();
                          if (!finalUrl.match(/^https?:\/\//i)) {
                            finalUrl = 'https://' + finalUrl;
                          }
                          
                          // Insert link at cursor position
                          const range = selection.getRangeAt(0);
                          const link = document.createElement('a');
                          link.href = finalUrl;
                          link.textContent = linkText.trim();
                          link.style.color = primaryColor;
                          link.style.textDecoration = 'underline';
                          range.deleteContents();
                          range.insertNode(link);
                          
                          // Move cursor after the link
                          range.setStartAfter(link);
                          range.collapse(true);
                          selection.removeAllRanges();
                          selection.addRange(range);
                          
                          if (emailEditorRef.current) setEmailBody(emailEditorRef.current.innerHTML);
                        }
                      }
                    }
                  }}
                  className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  title="Insert Link"
                >
                  🔗
                </button>
                <button
                  type="button"
                  onClick={() => {
                    emailEditorRef.current?.focus();
                    document.execCommand('insertUnorderedList', false);
                    if (emailEditorRef.current) setEmailBody(emailEditorRef.current.innerHTML);
                  }}
                  className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  title="Bullet List"
                >
                  •
                </button>
                <button
                  type="button"
                  onClick={() => {
                    emailEditorRef.current?.focus();
                    document.execCommand('insertOrderedList', false);
                    if (emailEditorRef.current) setEmailBody(emailEditorRef.current.innerHTML);
                  }}
                  className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  title="Numbered List"
                >
                  1.
                </button>
              </div>
              {/* Rich Text Editor */}
              <div
                id="email-body-editor"
                ref={emailEditorRef}
                contentEditable
                onInput={(e) => {
                  const target = e.target as HTMLDivElement;
                  setEmailBody(target.innerHTML);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  if (emailEditorRef.current) {
                    setEmailBody(emailEditorRef.current.innerHTML);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/plain');
                  
                  // Insert plain text at cursor position
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    
                    // Create text node with plain text
                    const textNode = document.createTextNode(text);
                    range.insertNode(textNode);
                    
                    // Move cursor to end of inserted text
                    range.setStartAfter(textNode);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  } else if (emailEditorRef.current) {
                    // If no selection, append to end
                    const textNode = document.createTextNode(text);
                    emailEditorRef.current.appendChild(textNode);
                  }
                  
                  // Update state
                  if (emailEditorRef.current) {
                    setEmailBody(emailEditorRef.current.innerHTML);
                  }
                }}
                style={{ minHeight: '200px', color: 'rgba(255, 255, 255, 0.8)' }}
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = primaryColor}
                data-placeholder="Email body (use toolbar above for formatting)"
                suppressContentEditableWarning
              />
              <p className="mt-2 text-xs text-white/40">
                tip: select text and use toolbar buttons to format. supports HTML.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs text-white/70">
                email addresses (comma or newline separated)
              </label>
              <p className="mb-2 text-xs text-white/40">
                enter email addresses here, or select registrations from the list above
              </p>
              <textarea
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                rows={3}
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = primaryColor}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
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
                              className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium hover:file:opacity-80"
                              style={{ 
                                "--file-bg": `${primaryColor}20`,
                                "--file-color": primaryColor,
                                "--file-hover-bg": `${primaryColor}30`
                              } as React.CSSProperties}
                              onFocus={(e) => e.target.style.borderColor = primaryColor}
                              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
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
                recipients: <span style={{ color: primaryColor }}>{getEmailRecipients().length}</span>
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
                  className="rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
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
                  sent: <span style={{ color: primaryColor }}>{emailResult.sent}</span> | 
                  failed: <span className="text-red-500">{emailResult.failed}</span>
                </p>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        {/* Email Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#111111] border border-white/20 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm" style={{ color: primaryColor }}>email templates</h3>
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setTemplateName("");
                  }}
                  className="text-xs text-white/50 hover:text-white/80"
                >
                  close
                </button>
              </div>

              {/* Save Template Form */}
              <div className="mb-6 pb-6 border-b border-white/10">
                <h4 className="text-xs text-white/70 mb-3">save current email as template</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = primaryColor}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                  />
                  <button
                    onClick={saveEmailTemplate}
                    disabled={!templateName.trim() || !emailSubject.trim() || !emailBody.trim()}
                    className="w-full rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    save template
                  </button>
                </div>
              </div>

              {/* Load Templates */}
              <div>
                <h4 className="text-xs text-white/70 mb-3">saved templates</h4>
                {isLoadingTemplates ? (
                  <p className="text-xs text-white/50">loading...</p>
                ) : emailTemplates.length === 0 ? (
                  <p className="text-xs text-white/50">no templates saved yet</p>
                ) : (
                  <div className="space-y-2">
                    {emailTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-white/80 font-medium">{template.name}</p>
                          <p className="text-xs text-white/50 mt-1">{template.subject}</p>
                          <p className="text-xs text-white/40 mt-1">
                            {new Date(template.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => loadEmailTemplate(template)}
                            className="text-xs hover:opacity-80 border px-3 py-1 rounded"
                          style={{ color: primaryColor, borderColor: primaryColor }}
                          >
                            load
                          </button>
                          <button
                            onClick={() => deleteEmailTemplate(template.id)}
                            className="text-xs text-red-500 hover:text-red-400 border border-red-500/50 px-3 py-1 rounded"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "event-config" && (
          <div className="space-y-8">
            <h2 className="text-sm" style={{ color: primaryColor }}>event configuration</h2>
            
            {/* List of all event configs */}
            {allEventConfigs.length > 0 && (
              <div className="bg-white/5 border border-white/10 p-4">
                <h3 className="text-xs text-white/70 uppercase mb-3">previous event configurations</h3>
                <div className="space-y-2">
                  {allEventConfigs.map((config) => (
                    <button
                      key={config.id}
                      onClick={() => loadEventConfigById(config.id!)}
                      className={`w-full text-left px-3 py-2 text-sm rounded border transition-colors ${
                        eventConfig?.id === config.id
                          ? "bg-opacity-10"
                          : "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white/90"
                      }`}
                      style={eventConfig?.id === config.id ? {
                        borderColor: primaryColor,
                        backgroundColor: `${primaryColor}10`,
                        color: primaryColor
                      } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{config.event_name || config.event_id}</span>
                        <div className="flex items-center gap-2">
                          {config.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                              active
                            </span>
                          )}
                          <span className="text-xs text-white/40">
                            {config.event_date || "No date"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setEventConfig({
                      event_id: "",
                      event_name: "",
                      event_date: "",
                      event_time: "",
                      event_place: "",
                      event_address: "",
                      event_note: "",
                      event_description: "",
                      chat_welcome_message: "",
                      chat_intro_message: "",
                      chat_password_prompt: "",
                      chat_access_granted_message: "",
                      chat_event_announcement: "",
                      chat_event_description: "",
                      chat_location_message: "",
                      chat_contribution_message: "",
                      chat_full_message: "",
                      chat_waitlist_message: "",
                      primary_color: "#05fd00",
                      background_color: "#111111",
                      stripe_product_name: "",
                      stripe_product_description: "",
                      stripe_image_url: "",
                      stripe_min_amount: 2200,
                      stripe_max_amount: 4400,
                      capacity: 25,
                      is_active: false,
                    });
                  }}
                  className="mt-3 w-full rounded border border-white/20 bg-transparent px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white/90"
                >
                  + create new event configuration
                </button>
              </div>
            )}
            
            {isLoadingEventConfig ? (
              <p className="text-sm text-white/50">Loading event config...</p>
            ) : (
              <div className="space-y-6">
                {/* Initialize config if none exists */}
                {!eventConfig && allEventConfigs.length === 0 && (
                  <div className="bg-white/5 border border-white/10 p-4">
                    <p className="text-sm text-white/70 mb-4">
                      No event config found. Create one to get started.
                    </p>
                    <button
                      onClick={() => {
                        setEventConfig({
                          event_id: "RENEWAL",
                          event_name: "RENEWAL",
                          event_date: "friday, 1/23",
                          event_time: "7:00–9:30 pm",
                          event_place: "farfields farm",
                          event_address: "40 farfields ln, afton, va 22920",
                          event_note: "exact address shared after reserving.",
                          event_description: "mountain views, earth home, farm setting, cacao, live dj set",
                          chat_welcome_message: "hey :) welcome to soma space",
                          chat_intro_message: "this is a movement gathering rooted in presence and free expression, with gentle guidance throughout. no experience required — just come as you are",
                          chat_password_prompt: "to see details of our next gathering and reserve your spot, type the password",
                          chat_access_granted_message: "access granted",
                          chat_event_announcement: "join us for RENEWAL",
                          chat_event_description: "mountain views, earth home, farm setting, cacao, live dj set",
                          chat_location_message: "location shared after reserving (~25 minutes west of downtown mall)",
                          chat_contribution_message: "sliding scale contribution ($22–$44, your choice). nobody turned away for lack of funds. reach out if you need support!",
                          chat_full_message: "we checked, and this gathering is currently full",
                          chat_waitlist_message: "join the waitlist and we'll reach out if a spot opens. we'll also let you know about future gatherings",
                          primary_color: "#05fd00",
                          background_color: "#111111",
                          stripe_product_name: "soma space",
                          stripe_product_description: "soma space is a guided movement gathering rooted in presence, free expression, and connection. participants are invited to move with music and explore embodied awareness. no prior movement or dance experience is required.\n\nno one is ever turned away for not having enough. if you need financial support, please reach out to us directly.",
                          stripe_image_url: "/renewal-checkout.jpg",
                          stripe_min_amount: 2200,
                          stripe_max_amount: 4400,
                          capacity: 25,
                          is_active: true,
                        });
                      }}
                      className="rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      initialize with defaults
                    </button>
                  </div>
                )}

                {eventConfig && (
                  <div className="space-y-6">
                    {/* Event Details */}
                    <div className="bg-white/5 border border-white/10 p-4 space-y-4">
                      <h3 className="text-xs text-white/70 uppercase">event details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Event ID</label>
                          <input
                            type="text"
                            value={eventConfig.event_id || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_id: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Event Name</label>
                          <input
                            type="text"
                            value={eventConfig.event_name || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_name: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Date</label>
                          <input
                            type="text"
                            value={eventConfig.event_date || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_date: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Time</label>
                          <input
                            type="text"
                            value={eventConfig.event_time || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_time: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Place</label>
                          <input
                            type="text"
                            value={eventConfig.event_place || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_place: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Address</label>
                          <input
                            type="text"
                            value={eventConfig.event_address || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_address: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/50 mb-1">Note</label>
                          <input
                            type="text"
                            value={eventConfig.event_note || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_note: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/50 mb-1">Description</label>
                          <textarea
                            value={eventConfig.event_description || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_description: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Colors */}
                    <div className="bg-white/5 border border-white/10 p-4 space-y-4">
                      <h3 className="text-xs text-white/70 uppercase">colors</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Primary Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={eventConfig.primary_color || "#05fd00"}
                              onChange={(e) => setEventConfig({ ...eventConfig, primary_color: e.target.value })}
                              className="h-10 w-20 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={eventConfig.primary_color || "#05fd00"}
                              onChange={(e) => setEventConfig({ ...eventConfig, primary_color: e.target.value })}
                              className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none flex-1 px-3 py-2"
                              onFocus={(e) => e.target.style.borderColor = primaryColor}
                              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Background Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={eventConfig.background_color || "#111111"}
                              onChange={(e) => setEventConfig({ ...eventConfig, background_color: e.target.value })}
                              className="h-10 w-20 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={eventConfig.background_color || "#111111"}
                              onChange={(e) => setEventConfig({ ...eventConfig, background_color: e.target.value })}
                              className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none flex-1 px-3 py-2"
                              onFocus={(e) => e.target.style.borderColor = primaryColor}
                              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stripe Configuration */}
                    <div className="bg-white/5 border border-white/10 p-4 space-y-4">
                      <h3 className="text-xs text-white/70 uppercase">stripe configuration</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/50 mb-1">Product Name</label>
                          <input
                            type="text"
                            value={eventConfig.stripe_product_name || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, stripe_product_name: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/50 mb-1">Product Description</label>
                          <textarea
                            value={eventConfig.stripe_product_description || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, stripe_product_description: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                            rows={4}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Image URL</label>
                          <input
                            type="text"
                            value={eventConfig.stripe_image_url || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, stripe_image_url: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Capacity</label>
                          <input
                            type="number"
                            value={eventConfig.capacity || 25}
                            onChange={(e) => setEventConfig({ ...eventConfig, capacity: parseInt(e.target.value) || 25 })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Min Amount (cents)</label>
                          <input
                            type="number"
                            value={eventConfig.stripe_min_amount || 2200}
                            onChange={(e) => setEventConfig({ ...eventConfig, stripe_min_amount: parseInt(e.target.value) || 2200 })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Max Amount (cents)</label>
                          <input
                            type="number"
                            value={eventConfig.stripe_max_amount || 4400}
                            onChange={(e) => setEventConfig({ ...eventConfig, stripe_max_amount: parseInt(e.target.value) || 4400 })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="bg-white/5 border border-white/10 p-4 space-y-4">
                      <h3 className="text-xs text-white/70 uppercase">chat messages</h3>
                      <div className="space-y-4">
                        {[
                          { key: "chat_welcome_message" as keyof EventConfig, label: "Welcome Message" },
                          { key: "chat_intro_message" as keyof EventConfig, label: "Intro Message" },
                          { key: "chat_password_prompt" as keyof EventConfig, label: "Password Prompt" },
                          { key: "chat_access_granted_message" as keyof EventConfig, label: "Access Granted" },
                          { key: "chat_event_announcement" as keyof EventConfig, label: "Event Announcement" },
                          { key: "chat_event_description" as keyof EventConfig, label: "Event Description" },
                          { key: "chat_location_message" as keyof EventConfig, label: "Location Message" },
                          { key: "chat_contribution_message" as keyof EventConfig, label: "Contribution Message" },
                          { key: "chat_full_message" as keyof EventConfig, label: "Full Message" },
                          { key: "chat_waitlist_message" as keyof EventConfig, label: "Waitlist Message" },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label className="block text-xs text-white/50 mb-1">{label}</label>
                            <textarea
                              value={(eventConfig[key] as string | undefined) || ""}
                              onChange={(e) => setEventConfig({ ...eventConfig, [key]: e.target.value } as EventConfig)}
                              className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = primaryColor}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Event Password */}
                    <div className="bg-white/5 border border-white/10 p-4 space-y-4">
                      <h3 className="text-xs text-white/70 uppercase">event password</h3>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Password (leave empty to use environment variable)</label>
                        <input
                          type="password"
                          value={eventConfig.event_password || ""}
                          onChange={(e) => setEventConfig({ ...eventConfig, event_password: e.target.value })}
                          className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = primaryColor}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          placeholder="Leave empty to use EVENT_PASSWORD env var"
                        />
                      </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="bg-white/5 border border-white/10 p-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eventConfig.is_active || false}
                          onChange={(e) => setEventConfig({ ...eventConfig, is_active: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-white/70">Set as active event (only one can be active at a time)</span>
                      </label>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={saveEventConfig}
                      disabled={isSavingEventConfig || isSavingAsNewEvent || !eventConfig.event_id || !eventConfig.event_name}
                      className="w-full rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${primaryColor}10`}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {isSavingEventConfig ? "Saving..." : "Save Event Configuration"}
                    </button>

                    {/* Save as New Event Button */}
                    <button
                      onClick={saveAsNewEvent}
                      disabled={isSavingEventConfig || isSavingAsNewEvent || !eventConfig.event_id || !eventConfig.event_name}
                      className="w-full rounded border-2 border-dashed bg-transparent px-4 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed mt-3"
                      style={{ 
                        borderColor: primaryColor + "80", 
                        color: primaryColor,
                        backgroundColor: "transparent"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${primaryColor}15`;
                        e.currentTarget.style.borderColor = primaryColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.borderColor = primaryColor + "80";
                      }}
                    >
                      {isSavingAsNewEvent ? "Creating..." : "Save as New Event"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

