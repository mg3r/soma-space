"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { nextEvent } from "@/config/event";
import Link from "next/link";
import type { EventConfig } from "@/lib/event-config";

type Registration = {
  sessionId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preWaiverEmail?: string;
  amountPaid: number;
  paymentDate: string;
  eventId: string;
  notes?: string;
  isExcluded?: boolean;
  isRefunded?: boolean;
  exclusionReason?: string;
  waiverSigned?: boolean;
  isGuest?: boolean;
  guestIndex?: number;
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

type AbandonedPendingOrder = {
  id: string;
  event_id: string;
  tickets: Array<{ name: string; email: string; amount: number }>;
  created_at: string;
};

type AllEventsMetrics = {
  totalRegistrations: number;
  totalRevenue: number;
  totalRefunded: number;
};

type PersonSummary = {
  email: string;
  name: string;
  phone: string;
  eventIds: string[];
  eventCount: number;
  totalAmount: number;
};

const ALL_EVENTS_ID = "__all__";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(nextEvent.id);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pendingOrders, setPendingOrders] = useState<AbandonedPendingOrder[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [allEventsMetrics, setAllEventsMetrics] = useState<AllEventsMetrics | null>(null);
  const [allEventsPeople, setAllEventsPeople] = useState<PersonSummary[]>([]);
  const [isLoadingAllEvents, setIsLoadingAllEvents] = useState(false);
  const [peopleFilterEvent, setPeopleFilterEvent] = useState<string>("");
  const [peopleFilterMinEvents, setPeopleFilterMinEvents] = useState<string>("");
  const [peopleFilterMinAmount, setPeopleFilterMinAmount] = useState<string>("");
  const [peopleSortBy, setPeopleSortBy] = useState<"name" | "email" | "events" | "amount">("name");
  const [peopleSortAsc, setPeopleSortAsc] = useState(true);
  const [funnel, setFunnel] = useState<{ started: number; abandoned: number; completed: number; guests: number } | null>(null);
  const [registrationsOverTime, setRegistrationsOverTime] = useState<{ series: { date: string; count: number }[]; newThisWeek: number } | null>(null);
  const [newCapacity, setNewCapacity] = useState("");
  const [isUpdatingCapacity, setIsUpdatingCapacity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [excludingSessionId, setExcludingSessionId] = useState<string | null>(
    null
  );
  const [excludingGuestKey, setExcludingGuestKey] = useState<string | null>(null);
  const [resendingWaiverKey, setResendingWaiverKey] = useState<string | null>(null);
  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [customEmails, setCustomEmails] = useState("");
  const [useBcc, setUseBcc] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const emailEditorRef = useRef<HTMLDivElement>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const [emailFontSize, setEmailFontSize] = useState<"small" | "medium" | "large">("small");
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
  // Track which event we're loading so stale responses don't overwrite (race fix)
  const loadEventIdRef = useRef<string | null>(null);

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
        // Refresh overview so capacity and stats reflect the saved config (use saved event id in case it changed)
        await loadData(data.config?.event_id);
        showToast("Event configuration saved successfully", "success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || "Failed to save event configuration", "error");
      }
    } catch (error) {
      console.error("Error saving event config:", error);
      showToast("An error occurred while saving the event configuration", "error");
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
      showToast("Event ID can only contain letters, numbers, underscores, and hyphens.", "error");
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
      // Create a copy without the ID, with new event_id and name (default name = new event ID)
      const newConfig: EventConfig = {
        ...eventConfig,
        id: undefined, // Clear ID to create new record
        event_id: trimmedEventId,
        event_name: trimmedEventId,
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
        showToast(`New event configuration "${trimmedEventId}" created successfully!`, "success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        const details = errorData.details ? `\n\n${errorData.details}` : "";
        showToast((errorData.error || "Failed to create new event configuration") + details, "error");
      }
    } catch (error) {
      console.error("Error saving as new event:", error);
      showToast("An error occurred while creating the new event configuration", "error");
    } finally {
      setIsSavingAsNewEvent(false);
    }
  };

  const saveEmailTemplate = async () => {
    if (!templateName.trim() || !emailSubject.trim() || !emailBody.trim()) {
      showToast("Please enter a template name, subject, and body", "error");
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
        showToast("Template saved successfully", "success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || "Failed to save template", "error");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showToast("An error occurred while saving the template", "error");
    }
  };

  const loadEmailTemplate = (template: { subject: string; body: string; attachments?: Array<{ filename: string; content: string; content_type?: string }> }) => {
    setEmailSubject(template.subject);
    setEmailBody(template.body);
    // Set the editor content directly to preserve HTML formatting
    if (emailEditorRef.current) {
      emailEditorRef.current.innerHTML = template.body;
      // Apply current font size to the editor
      const fontSize = emailFontSize === "small" ? "14px" : emailFontSize === "medium" ? "15px" : "16px";
      emailEditorRef.current.style.fontSize = fontSize;
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
        showToast(errorData.error || "Failed to delete template", "error");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      showToast("An error occurred while deleting the template", "error");
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

  const loadData = useCallback(async (eventIdOverride?: string) => {
    const eventId = eventIdOverride ?? selectedEvent;
    loadEventIdRef.current = eventId;
    setIsLoading(true);
    try {
      // Load registrations
      const regRes = await fetch(`/api/admin/registrations?eventId=${eventId}`);
      if (regRes.ok) {
        const regData = await regRes.json();
        const regs = regData.registrations || [];
        if (loadEventIdRef.current === eventId) {
          setRegistrations(regs);
        }
      }

      // Load waitlist
      const waitlistRes = await fetch(`/api/admin/waitlist?eventId=${eventId}`);
      if (waitlistRes.ok) {
        const waitlistData = await waitlistRes.json();
        if (loadEventIdRef.current === eventId) {
          setWaitlist(waitlistData.waitlist || []);
        }
      }

      // Load stats
      const statsRes = await fetch(`/api/admin/stats?eventId=${eventId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const st = statsData.stats;
        if (loadEventIdRef.current === eventId) {
          setStats(st);
          setNewCapacity(st?.capacity?.toString() ?? "");
        }
      }

      // Load abandoned pending orders (started sign-up but never completed)
      const pendingRes = await fetch(`/api/admin/pending-orders?eventId=${eventId}`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        if (loadEventIdRef.current === eventId) {
          setPendingOrders(pendingData.pendingOrders || []);
        }
      }

      // Load abandonment funnel
      const funnelRes = await fetch(`/api/admin/funnel?eventId=${eventId}`);
      if (funnelRes.ok) {
        const funnelData = await funnelRes.json();
        if (loadEventIdRef.current === eventId) {
          setFunnel(funnelData.funnel ?? { started: 0, abandoned: 0, completed: 0, guests: 0 });
        }
      }

      // Load registrations over time (last 30 days)
      const overTimeRes = await fetch(`/api/admin/registrations-over-time?eventId=${eventId}&days=30`);
      if (overTimeRes.ok && loadEventIdRef.current === eventId) {
        const overTimeData = await overTimeRes.json();
        const series = Array.isArray(overTimeData.series) ? overTimeData.series : [];
        setRegistrationsOverTime({ series, newThisWeek: overTimeData.newThisWeek ?? 0 });
      }
    } catch {
      console.error("Error loading data");
    } finally {
      if (loadEventIdRef.current === eventId) {
        setIsLoading(false);
      }
    }
  }, [selectedEvent]);

  async function updateCapacity() {
    if (!newCapacity || isNaN(parseInt(newCapacity)) || parseInt(newCapacity) < 0) {
      showToast("Please enter a valid capacity number", "error");
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
        showToast(data.message || "Capacity updated.", "success");
        await loadData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || "Failed to update capacity", "error");
      }
    } catch {
      showToast("An error occurred. Please try again.", "error");
    } finally {
      setIsUpdatingCapacity(false);
    }
  }

  const loadAllEvents = useCallback(async () => {
    setIsLoadingAllEvents(true);
    try {
      const res = await fetch("/api/admin/all-events");
      if (res.ok) {
        const data = await res.json();
        setAllEventsMetrics(data.metrics ?? null);
        setAllEventsPeople(data.people ?? []);
      }
    } catch (e) {
      console.error("Error loading all-events:", e);
    } finally {
      setIsLoadingAllEvents(false);
    }
  }, []);

  const filteredAndSortedPeople = useMemo(() => {
    let list = [...allEventsPeople];
    if (peopleFilterEvent) {
      list = list.filter((p) => p.eventIds.includes(peopleFilterEvent));
    }
    if (peopleFilterMinEvents) {
      const min = parseInt(peopleFilterMinEvents, 10);
      if (!isNaN(min)) list = list.filter((p) => p.eventCount >= min);
    }
    if (peopleFilterMinAmount) {
      const min = parseFloat(peopleFilterMinAmount);
      if (!isNaN(min)) list = list.filter((p) => p.totalAmount >= min);
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (peopleSortBy) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "");
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "events":
          cmp = a.eventCount - b.eventCount;
          break;
        case "amount":
          cmp = a.totalAmount - b.totalAmount;
          break;
        default:
          cmp = (a.name || "").localeCompare(b.name || "");
      }
      return peopleSortAsc ? cmp : -cmp;
    });
    return list;
  }, [allEventsPeople, peopleFilterEvent, peopleFilterMinEvents, peopleFilterMinAmount, peopleSortBy, peopleSortAsc]);

  function downloadCSV(filename: string, headers: string[], rows: string[][]) {
    const escape = (s: string) => {
      const t = String(s ?? "");
      if (t.includes(",") || t.includes("\n") || t.includes('"')) return `"${t.replace(/"/g, '""')}"`;
      return t;
    };
    const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRegistrationsCSV() {
    const headers = ["name", "waiver", "email", "phone", "amount", "date", "excluded", "refunded", "guest"];
    const rows = registrations.map((r) => [
      r.customerName ?? "",
      r.waiverSigned ? "signed" : "—",
      r.preWaiverEmail ?? r.customerEmail ?? "",
      r.customerPhone ?? "",
      String(r.amountPaid ?? 0),
      r.paymentDate ?? "",
      r.isExcluded ? "yes" : "",
      r.isRefunded ? "yes" : "",
      r.isGuest ? "yes" : "",
    ]);
    downloadCSV(`registrations-${selectedEvent}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  function exportPeopleCSV() {
    const headers = ["name", "email", "phone", "events attended", "# events", "total amount"];
    const rows = filteredAndSortedPeople.map((p) => [
      p.name ?? "",
      p.email ?? "",
      p.phone ?? "",
      p.eventIds.map((eid) => allEventConfigs.find((c) => c.event_id === eid)?.event_name || eid).join("; ") || "—",
      String(p.eventCount ?? 0),
      String(p.totalAmount ?? 0),
    ]);
    downloadCSV(`people-all-events-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      loadEmailTemplates();
    }
  }, [isAuthenticated, loadData, loadEmailTemplates]);

  // Reload data when selected event changes (All events vs single event)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (selectedEvent === ALL_EVENTS_ID) {
      loadAllEvents();
    } else if (selectedEvent) {
      loadData();
    }
  }, [selectedEvent, isAuthenticated, loadData, loadAllEvents]);

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

  // Admin uses neutral black/white/gray only (no event colors)
  const adminAccent = "rgba(255,255,255,0.85)";
  const adminAccentHoverBg = "rgba(255,255,255,0.08)";
  const adminAccentMuted = "rgba(255,255,255,0.12)";
  const backgroundColor = activeEventConfig?.background_color || "#111111";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--background-color", backgroundColor);
    }
  }, [backgroundColor]);

  // Reset email selection when event changes
  useEffect(() => {
    setSelectedSessionIds(new Set());
    setEmailSubject("");
    setEmailBody("");
    setCustomEmails("");
    setEmailResult(null);
    setAttachments([]);
    setEmailFontSize("small");
    if (emailEditorRef.current) {
      emailEditorRef.current.innerHTML = "";
      emailEditorRef.current.style.fontSize = "14px";
    }
  }, [selectedEvent]);

  // Apply font size to editor when font size changes
  useEffect(() => {
    if (emailEditorRef.current) {
      const fontSize = emailFontSize === "small" ? "14px" : emailFontSize === "medium" ? "15px" : "16px";
      emailEditorRef.current.style.fontSize = fontSize;
    }
  }, [emailFontSize]);

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
    const customEmailList: string[] = [];
    if (customEmails.trim()) {
      customEmails.split(/[,\n]/).forEach(email => {
        const trimmed = email.trim();
        if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          customEmailList.push(trimmed);
        }
      });
    }

    // All events: send to all people + custom emails
    if (selectedEvent === ALL_EVENTS_ID) {
      const peopleEmails = allEventsPeople.map((p) => p.email);
      return [...new Set([...peopleEmails, ...customEmailList])];
    }

    const emails: string[] = [];
    // If custom emails only (no registrations selected), return just custom emails
    if (customEmailList.length > 0 && selectedSessionIds.size === 0) {
      return customEmailList;
    }

    const hasCustomEmailInput = customEmails.trim().length > 0;
    const addRegEmails = (reg: Registration) => {
      const stripeEmail = reg.customerEmail?.trim();
      const chatEmail = reg.preWaiverEmail?.trim()?.toLowerCase();
      if (chatEmail && chatEmail !== "N/A") emails.push(reg.preWaiverEmail!.trim());
      if (stripeEmail && stripeEmail !== "N/A" && stripeEmail.toLowerCase() !== chatEmail) {
        emails.push(stripeEmail);
      }
    };
    if (selectedSessionIds.size > 0) {
      registrations
        .filter(reg => selectedSessionIds.has(reg.sessionId))
        .forEach(addRegEmails);
    } else if (!hasCustomEmailInput) {
      registrations
        .filter(reg => !reg.isExcluded)
        .forEach(addRegEmails);
    }

    customEmailList.forEach(email => emails.push(email));
    return [...new Set(emails)];
  };

  async function sendEmailToRegistrations() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      showToast("Please enter both subject and email body", "error");
      return;
    }

    const recipients = getEmailRecipients();
    if (recipients.length === 0) {
      showToast("No recipients selected. Please select registrations or add custom email addresses.", "error");
      return;
    }

    if (!confirm(`Send email to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}?`)) {
      return;
    }

    setIsSendingEmail(true);
    setEmailResult(null);
    
    try {
      // Wrap email body with font size
      const fontSize = emailFontSize === "small" ? "14px" : emailFontSize === "medium" ? "15px" : "16px";
      const wrappedHtmlBody = `<div style="font-size: ${fontSize};">${emailBody}</div>`;
      
      // Use FormData if there are attachments, otherwise use JSON
      let body: FormData | string;
      const headers: Record<string, string> = {};

      if (attachments.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append("eventId", selectedEvent);
        formData.append("subject", emailSubject);
        formData.append("htmlBody", wrappedHtmlBody);
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
          htmlBody: wrappedHtmlBody,
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
        setEmailResult({ sent: data.sent, failed: data.failed, errors: data.errors ?? [] });
        if (data.failed > 0 && data.errors?.length) {
          showToast(`${data.sent} sent, ${data.failed} failed — see list below`, "error");
        } else {
          showToast(`Sent to ${data.sent} recipient${data.sent !== 1 ? "s" : ""}`, "success");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.details || errorData.error || "Failed to send emails";
        showToast(errorMsg, "error");
        console.error("Email send error:", errorData);
      }
    } catch {
      showToast("An error occurred. Please try again.", "error");
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
                  onFocus={(e) => e.target.style.borderColor = adminAccent}
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
      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-sm">admin dashboard</h1>
            <Link
              href="/"
              className="mt-2 block text-xs text-white/50 hover:text-white/80 touch-manipulation"
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
            className="min-h-[44px] touch-manipulation rounded border border-white/20 px-3 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5"
          >
            sign out
          </button>
        </div>

        {/* Event Selector: full width on mobile, constrained on larger screens */}
        <div className="mb-6 sm:mb-8 w-full sm:max-w-xs">
          <label className="mb-2 block text-sm text-white/70">
            select event
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full min-h-[44px] touch-manipulation bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none px-3 py-2 rounded"
            onFocus={(e) => e.target.style.borderColor = adminAccent}
            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
          >
            <option value={ALL_EVENTS_ID}>all events</option>
            {allEventConfigs.length > 0 ? (
              allEventConfigs
                .filter((config) => config.event_id && config.event_id.trim() !== "")
                .sort((a, b) => {
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

        {/* Tabs: touch-friendly, wrap on small screens */}
        <div className="mb-6 sm:mb-8 border-b border-white/10 -mx-1 px-1">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`min-h-[44px] min-w-[44px] px-3 pb-3 pt-1 text-sm transition-colors touch-manipulation ${
                activeTab === "overview"
                  ? "border-b-2"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={activeTab === "overview" ? { color: adminAccent, borderColor: adminAccent } : undefined}
            >
              overview
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`min-h-[44px] min-w-[44px] px-3 pb-3 pt-1 text-sm transition-colors touch-manipulation ${
                activeTab === "email"
                  ? "border-b-2"
                  : "text-white/50 hover:text-white/80"
              }`}
              style={activeTab === "email" ? { color: adminAccent, borderColor: adminAccent } : undefined}
            >
              email
            </button>
            <button
                onClick={() => setActiveTab("event-config")}
                className={`min-h-[44px] min-w-[44px] px-2 sm:px-3 pb-3 pt-1 text-sm transition-colors touch-manipulation ${
                  activeTab === "event-config"
                    ? "border-b-2"
                    : "text-white/50 hover:text-white/80"
                }`}
                style={activeTab === "event-config" ? { color: adminAccent, borderColor: adminAccent } : undefined}
              >
                event config
              </button>
          </div>
        </div>

        {activeTab === "overview" && (
          <>
        {selectedEvent === ALL_EVENTS_ID ? (
          /* All-events view: metrics + people table */
          <div className="space-y-8">
            {allEventsMetrics && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
                  <p className="text-xs text-white/50">total registrations</p>
                  <p className="mt-1 text-xl sm:text-2xl text-white">{allEventsMetrics.totalRegistrations}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
                  <p className="text-xs text-white/50">total revenue</p>
                  <p className="mt-1 text-xl sm:text-2xl text-white">${allEventsMetrics.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 sm:p-4 col-span-2 md:col-span-1">
                  <p className="text-xs text-white/50">total refunded</p>
                  <p className="mt-1 text-xl sm:text-2xl text-white/50">${allEventsMetrics.totalRefunded.toFixed(2)}</p>
                </div>
              </div>
            )}
            <div className="bg-white/5 border border-white/10 overflow-hidden">
              <div className="border-b border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm" style={{ color: adminAccent }}>
                    people ({filteredAndSortedPeople.length}{allEventsPeople.length !== filteredAndSortedPeople.length ? ` of ${allEventsPeople.length}` : ""})
                  </h2>
                  {filteredAndSortedPeople.length > 0 && (
                    <button
                      type="button"
                      onClick={exportPeopleCSV}
                      className="min-h-[44px] touch-manipulation rounded border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors"
                      style={{ borderColor: adminAccent, color: adminAccent }}
                    >
                      export csv
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/50">
                  one row per person (by email). events attended and total amount across all events.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-xs text-white/50 w-full sm:w-auto">filter:</span>
                  <select
                    value={peopleFilterEvent}
                    onChange={(e) => setPeopleFilterEvent(e.target.value)}
                    className="min-h-[44px] touch-manipulation bg-white/5 border border-white/20 text-white/80 text-xs focus:outline-none px-2 py-2 rounded"
                  >
                    <option value="">all events</option>
                    {allEventConfigs.filter((c) => c.event_id).map((c) => (
                      <option key={c.event_id} value={c.event_id}>{c.event_name || c.event_id}</option>
                    ))}
                  </select>
                  <select
                    value={peopleFilterMinEvents}
                    onChange={(e) => setPeopleFilterMinEvents(e.target.value)}
                    className="min-h-[44px] touch-manipulation bg-white/5 border border-white/20 text-white/80 text-xs focus:outline-none px-2 py-2 rounded"
                  >
                    <option value="">any # events</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                  </select>
                  <select
                    value={peopleFilterMinAmount}
                    onChange={(e) => setPeopleFilterMinAmount(e.target.value)}
                    className="min-h-[44px] touch-manipulation bg-white/5 border border-white/20 text-white/80 text-xs focus:outline-none px-2 py-2 rounded"
                  >
                    <option value="">any amount</option>
                    <option value="50">&gt; $50</option>
                    <option value="100">&gt; $100</option>
                  </select>
                  <span className="text-xs text-white/50 sm:ml-2">sort:</span>
                  <select
                    value={peopleSortBy}
                    onChange={(e) => setPeopleSortBy(e.target.value as "name" | "email" | "events" | "amount")}
                    className="min-h-[44px] touch-manipulation bg-white/5 border border-white/20 text-white/80 text-xs focus:outline-none px-2 py-2 rounded"
                  >
                    <option value="name">name</option>
                    <option value="email">email</option>
                    <option value="events"># events</option>
                    <option value="amount">amount</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setPeopleSortAsc((a) => !a)}
                    className="min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center text-xs text-white/50 hover:text-white/80 rounded border border-white/20 hover:bg-white/5"
                  >
                    {peopleSortAsc ? "↑" : "↓"}
                  </button>
                </div>
              </div>
              {isLoadingAllEvents ? (
                <div className="p-8 text-center text-sm text-white/50">loading...</div>
              ) : filteredAndSortedPeople.length === 0 ? (
                <div className="p-8 text-center text-sm text-white/50">
                  {allEventsPeople.length === 0 ? "no people yet" : "no people match filters"}
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0" style={{ WebkitOverflowScrolling: "touch" }}>
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">name</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">email</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">phone</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">events attended</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs text-white/50">#</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs text-white/50">total amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedPeople.map((p) => (
                        <tr key={p.email} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">{p.name}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">{p.email}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">{p.phone === "—" ? "—" : p.phone}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                            {p.eventIds.map((eid) => allEventConfigs.find((c) => c.event_id === eid)?.event_name || eid).join(", ") || "—"}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-sm text-white/80">{p.eventCount}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right text-sm text-white/80">${p.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
        {/* Stats Summary */}
        {stats && (
          <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-7">
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
              <p className="text-xs text-white/50">registered</p>
              <p className="mt-1 text-2xl text-white">{stats.registered}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
              <p className="text-xs text-white/50">excluded</p>
              <p className="mt-1 text-xl sm:text-2xl text-white/60">{stats.excluded}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
              <p className="text-xs text-white/50">capacity</p>
              <p className="mt-1 text-xl sm:text-2xl text-white">{stats.capacity}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
              <p className="text-xs text-white/50">remaining</p>
              <p className="mt-1 text-xl sm:text-2xl" style={{ color: adminAccent }}>{stats.remainingSpots}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
              <p className="text-xs text-white/50">total revenue</p>
              <p className="mt-1 text-xl sm:text-2xl text-white">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4">
              <p className="text-xs text-white/50">refunded</p>
              <p className="mt-1 text-xl sm:text-2xl text-white/50">${stats.refundedAmount.toFixed(2)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-3 sm:p-4 col-span-2 md:col-span-1">
              <p className="text-xs text-white/50">avg contribution</p>
              <p className="mt-1 text-xl sm:text-2xl text-white/80">${stats.averageContribution.toFixed(2)}</p>
            </div>
          </div>
          {registrations.length > 0 && (
            <>
              <p className="mb-4 text-xs text-white/50">
                waiver: <span className="text-white">{registrations.filter((r) => r.waiverSigned).length}/{registrations.length} signed</span>
                {" · "}
                last registration: <span className="text-white">{(() => {
                  const latest = new Date(Math.max(...registrations.map((r) => new Date(r.paymentDate).getTime())));
                  const now = new Date();
                  // Compare calendar days in local time so "today" / "yesterday" match the table dates
                  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                  const latestStart = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate()).getTime();
                  const days = Math.floor((nowStart - latestStart) / (24 * 60 * 60 * 1000));
                  if (days === 0) return "today";
                  if (days === 1) return "yesterday";
                  if (days < 7) return `${days} days ago`;
                  return latest.toLocaleDateString();
                })()}</span>
              </p>
              {funnel !== null && (
                <div className="mb-6 sm:mb-8">
                  <p className="text-xs text-white/50 mb-2">sign-up funnel</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                    <span>started: <strong>{funnel.started}</strong></span>
                    <span>completed: <strong style={{ color: adminAccent }}>{funnel.completed}</strong></span>
                    <span>guests: <strong style={{ color: adminAccent }}>{funnel.guests}</strong></span>
                    <span>abandoned: <strong className="text-white/60">{funnel.abandoned}</strong></span>
                  </div>
                  <div className="mt-2 h-2 w-full max-w-xs bg-white/10 rounded overflow-hidden flex">
                    {funnel.started > 0 ? (
                      <>
                        <div
                          className="h-full rounded-l"
                          style={{ width: `${(funnel.completed / funnel.started) * 100}%`, backgroundColor: adminAccent }}
                          title={`completed: ${funnel.completed}`}
                        />
                        <div
                          className="h-full rounded-r"
                          style={{ width: `${(funnel.abandoned / funnel.started) * 100}%`, backgroundColor: "rgba(255,255,255,0.3)" }}
                          title={`abandoned: ${funnel.abandoned}`}
                        />
                      </>
                    ) : (
                      <div className="h-full w-full rounded bg-white/5" title="no sign-up activity yet" />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {/* Registrations over time: show when we have data and (list or stats show registrations) */}
          {registrationsOverTime !== null && (registrations.length > 0 || (stats && stats.registered > 0)) && (
            <div className="mb-8">
              <p className="text-xs text-white/50 mb-2">
                registrations + guests over time (last 30 days)
                <span className="ml-2" style={{ color: adminAccent }}>
                  new this week: {registrationsOverTime.newThisWeek}
                </span>
              </p>
              {registrationsOverTime.series.length === 0 ? (
                <p className="text-xs text-white/50">no sign-ups in this range</p>
              ) : (
              <div className="flex items-end gap-1 h-12 w-full max-w-md">
                {registrationsOverTime.series.map(({ date, count }) => {
                  const max = Math.max(1, ...registrationsOverTime.series.map((s) => s.count));
                  const h = max > 0 ? (count / max) * 100 : 0;
                  const [y, m, d] = date.split("-").map(Number);
                  const localDate = new Date(y, m - 1, d);
                  const tooltipText = `${localDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${count === 1 ? "1 sign-up" : `${count} sign-ups`}`;
                  return (
                    <div
                      key={date}
                      className="chart-bar-with-tooltip shrink-0 rounded-t bg-white/20 hover:bg-white/40 transition-colors"
                      style={{ width: 6, height: `${Math.max(h, 2)}%` }}
                      data-tooltip={tooltipText}
                    />
                  );
                })}
              </div>
              )}
            </div>
          )}
          </>
        )}

            {/* Capacity Management */}
        <div className="mb-6 sm:mb-8 bg-white/5 border border-white/10 p-4 sm:p-6">
          <h2 className="mb-4 text-sm" style={{ color: adminAccent }}>capacity management</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <label className="mb-2 block text-xs text-white/70">
                current capacity
              </label>
              <input
                type="number"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                min="0"
                className="min-h-[44px] touch-manipulation bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full min-w-0 max-w-[8rem] sm:w-24 px-3 py-2 rounded"
                onFocus={(e) => e.target.style.borderColor = adminAccent}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
              />
            </div>
            <button
              onClick={updateCapacity}
              disabled={isUpdatingCapacity}
              className="min-h-[44px] touch-manipulation rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50"
              style={{ borderColor: adminAccent, color: adminAccent }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = adminAccentHoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              {isUpdatingCapacity ? "updating..." : "update capacity"}
            </button>
          </div>
          <p className="mt-4 text-xs text-white/50">
            capacity comes from event configuration; you can adjust it here and it stays in sync.
          </p>
        </div>

        {/* Registrations Table */}
        <div className="bg-white/5 border border-white/10">
          <div className="border-b border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm" style={{ color: adminAccent }}>
                registrations for {selectedEvent} ({registrations.length})
              </h2>
              {registrations.length > 0 && (
                <button
                  type="button"
                  onClick={exportRegistrationsCSV}
                  className="min-h-[44px] touch-manipulation rounded border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors"
                  style={{ borderColor: adminAccent, color: adminAccent }}
                >
                  export csv
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-white/50">
              event is selected in the dropdown above. checkout uses the <strong>active</strong> event—set your event as active before testing so new registrations appear here.
            </p>
            <p className="mt-1 text-xs text-white/50">
              emails: <strong>chat</strong> is primary; <strong>checkout</strong> (Stripe) shown when different. bulk send includes both. waiver: ✓ signed, — not signed.
            </p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-white/50">
              loading...
            </div>
          ) : registrations.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/50 space-y-2">
              <p>no registrations yet for {selectedEvent}</p>
              <p className="text-xs text-white/40 max-w-md mx-auto">
                Confirm the dropdown above is set to the event you paid for (e.g. BELONGING). Registrations sync when Stripe sends a webhook after checkout—on localhost run <code className="bg-white/10 px-1 rounded">npm run stripe:listen</code> and set <code className="bg-white/10 px-1 rounded">STRIPE_WEBHOOK_SECRET</code>; in production check Stripe Dashboard → Webhooks → your endpoint → Recent deliveries.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0" style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">
                      name
                    </th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">
                      waiver
                    </th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">
                      email
                    </th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">
                      phone
                    </th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs text-white/50">
                      amount
                    </th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">
                      date
                    </th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs text-white/50">
                      actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr
                      key={reg.isGuest && reg.guestIndex != null ? `${reg.sessionId}-guest-${reg.guestIndex}` : reg.sessionId}
                      className={`border-b border-white/5 hover:bg-white/5 ${
                        reg.isExcluded ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {reg.customerName}
                        {reg.isGuest && (
                          <span className="ml-2 text-xs text-white/50">(guest)</span>
                        )}
                        {reg.isRefunded && (
                          <span className="ml-2 text-xs text-white/50">
                            (refunded)
                          </span>
                        )}
                        {reg.isExcluded && !reg.isRefunded && (
                          <span className="ml-2 text-xs text-white/60">
                            (excluded)
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {reg.waiverSigned === true ? (
                          <span className="text-white/70" title="Waiver signed">✓</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="text-white/40" title="Waiver not signed">—</span>
                            {reg.isGuest && reg.guestIndex != null && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const key = `${reg.sessionId}-${reg.guestIndex}`;
                                  setResendingWaiverKey(key);
                                  try {
                                    const res = await fetch("/api/admin/resend-waiver", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ sessionId: reg.sessionId, guestIndex: reg.guestIndex }),
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.success) showToast("Waiver reminder sent.", "success");
                                    } else {
                                      const err = await res.json().catch(() => ({}));
                                      showToast(err?.error || "Failed to resend waiver.", "error");
                                    }
                                  } catch {
                                    showToast("An error occurred.", "error");
                                  } finally {
                                    setResendingWaiverKey(null);
                                  }
                                }}
                                disabled={resendingWaiverKey !== null}
                                className="min-h-[44px] touch-manipulation px-2 py-2 text-xs text-white/50 hover:text-white/80 disabled:opacity-50 rounded"
                              >
                                {resendingWaiverKey === `${reg.sessionId}-${reg.guestIndex}` ? "sending…" : "resend waiver"}
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        <div>
                          {reg.preWaiverEmail ? (
                            <>
                              <span className="text-white/40 text-xs">chat: </span>{reg.preWaiverEmail}
                              {reg.customerEmail && reg.customerEmail.trim().toLowerCase() !== reg.preWaiverEmail.trim().toLowerCase() && (
                                <div className="text-xs text-white/50 mt-0.5">checkout: {reg.customerEmail}</div>
                              )}
                            </>
                          ) : (
                            reg.customerEmail
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {reg.customerPhone}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-white/80">
                        ${reg.amountPaid.toFixed(2)}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {new Date(reg.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm">
                        {reg.isGuest && reg.guestIndex != null ? (
                          reg.isExcluded ? (
                            <button
                              onClick={async () => {
                                if (!confirm("Un-exclude this guest from capacity count?")) return;
                                const key = `${reg.sessionId}-${reg.guestIndex}`;
                                setExcludingGuestKey(key);
                                try {
                                  const res = await fetch(
                                    `/api/admin/exclude-guest?sessionId=${encodeURIComponent(reg.sessionId)}&guestIndex=${reg.guestIndex}`,
                                    { method: "DELETE" }
                                  );
                                  if (res.ok) await loadData();
                                  else showToast("Failed to un-exclude guest", "error");
                                } catch {
                                  showToast("An error occurred", "error");
                                } finally {
                                  setExcludingGuestKey(null);
                                }
                              }}
                              disabled={excludingGuestKey !== null}
                              className="text-xs text-white/60 hover:text-white/70 disabled:opacity-50"
                            >
                              {excludingGuestKey === `${reg.sessionId}-${reg.guestIndex}` ? "un-excluding…" : "un-exclude"}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (!confirm("Exclude this guest from capacity count? (e.g. they can't make it)")) return;
                                const key = `${reg.sessionId}-${reg.guestIndex}`;
                                setExcludingGuestKey(key);
                                try {
                                  const res = await fetch("/api/admin/exclude-guest", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      sessionId: reg.sessionId,
                                      guestIndex: reg.guestIndex,
                                      eventId: selectedEvent,
                                    }),
                                  });
                                  if (res.ok) await loadData();
                                  else showToast("Failed to exclude guest", "error");
                                } catch {
                                  showToast("An error occurred", "error");
                                } finally {
                                  setExcludingGuestKey(null);
                                }
                              }}
                              disabled={excludingGuestKey !== null}
                              className="text-xs text-white/50 hover:text-white/70 disabled:opacity-50"
                            >
                              {excludingGuestKey === `${reg.sessionId}-${reg.guestIndex}` ? "excluding…" : "exclude"}
                            </button>
                          )
                        ) : !reg.isGuest && (reg.isExcluded ? (
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
                                  showToast("Failed to un-exclude registration", "error");
                                }
                              } catch {
                                showToast("An error occurred", "error");
                              } finally {
                                setExcludingSessionId(null);
                              }
                            }}
                            disabled={excludingSessionId === reg.sessionId}
                            className="text-xs text-white/60 hover:text-white/70 disabled:opacity-50"
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
                                  showToast("Failed to exclude registration", "error");
                                }
                              } catch {
                                showToast("An error occurred", "error");
                              } finally {
                                setExcludingSessionId(null);
                              }
                            }}
                            disabled={excludingSessionId === reg.sessionId}
                            className="text-xs text-white/50 hover:text-white/70 disabled:opacity-50"
                          >
                            {excludingSessionId === reg.sessionId
                              ? "excluding..."
                              : "exclude"}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending orders (abandoned) — started sign-up but never completed */}
        <div className="mt-8 bg-white/5 border border-white/10">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-sm" style={{ color: adminAccent }}>
              pending orders — abandoned ({pendingOrders.length})
            </h2>
            <p className="mt-1 text-xs text-white/50">
              started the sign-up flow but did not complete checkout. excludes anyone who later registered (same or different session).
            </p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-white/50">
              loading...
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/50">
              no abandoned pending orders for {selectedEvent}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      created
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      purchaser
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      email
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-white/50">
                      tickets
                    </th>
                    <th className="px-4 py-3 text-right text-xs text-white/50">
                      amount(s)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order) => {
                    const purchaser = order.tickets?.[0];
                    const totalAmount = order.tickets?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) ?? 0;
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                          {new Date(order.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                          {purchaser?.name ?? "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                          {purchaser?.email ?? "—"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                          {order.tickets?.length ?? 0} {order.tickets?.length === 1 ? "ticket" : "tickets"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-white/80">
                          ${totalAmount.toFixed(2)}
                          {order.tickets && order.tickets.length > 1 && (
                            <span className="ml-1 text-xs text-white/50">
                              ({order.tickets.map((t) => `$${Number(t.amount).toFixed(2)}`).join(" + ")})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Waitlist Table */}
        <div className="mt-8 bg-white/5 border border-white/10">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-sm" style={{ color: adminAccent }}>
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
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {entry.name}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {entry.email}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                        {entry.phone || "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
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
          </>
        )}

        {activeTab === "email" && (
          <>
            {selectedEvent === ALL_EVENTS_ID ? (
              <div className="mb-8 bg-white/5 border border-white/10 p-4">
                <h2 className="text-sm" style={{ color: adminAccent }}>
                  recipients: all people ({allEventsPeople.length})
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  this email will go to everyone who has registered for any event. add custom emails below to include additional addresses.
                </p>
              </div>
            ) : (
            /* Registrations Table for Email Tab */
            <div className="mb-8 bg-white/5 border border-white/10">
              <div className="border-b border-white/10 p-4 flex items-center justify-between">
                <h2 className="text-sm" style={{ color: adminAccent }}>
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
                          waiver
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
                          key={reg.isGuest && reg.guestIndex != null ? `${reg.sessionId}-guest-${reg.guestIndex}` : reg.sessionId}
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
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                            {reg.customerName}
                            {reg.isGuest && (
                              <span className="ml-2 text-xs text-white/50">(guest)</span>
                            )}
                            {reg.isRefunded && (
                              <span className="ml-2 text-xs text-white/50">
                                (refunded)
                              </span>
                            )}
                            {reg.isExcluded && !reg.isRefunded && (
                              <span className="ml-2 text-xs text-white/60">
                                (excluded)
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                            {reg.waiverSigned === true ? (
                              <span className="text-white/70" title="Waiver signed">✓</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="text-white/40" title="Waiver not signed">—</span>
                                {reg.isGuest && reg.guestIndex != null && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const key = `${reg.sessionId}-${reg.guestIndex}`;
                                      setResendingWaiverKey(key);
                                      try {
                                        const res = await fetch("/api/admin/resend-waiver", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ sessionId: reg.sessionId, guestIndex: reg.guestIndex }),
                                        });
                                        if (res.ok) {
                                          const data = await res.json();
                                          if (data.success) showToast("Waiver reminder sent.", "success");
                                        } else {
                                          const err = await res.json().catch(() => ({}));
                                          showToast(err?.error || "Failed to resend waiver.", "error");
                                        }
                                      } catch {
                                        showToast("An error occurred.", "error");
                                      } finally {
                                        setResendingWaiverKey(null);
                                      }
                                    }}
                                    disabled={resendingWaiverKey !== null}
                                    className="text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
                                  >
                                    {resendingWaiverKey === `${reg.sessionId}-${reg.guestIndex}` ? "sending…" : "resend waiver"}
                                  </button>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                            <div>
                              {reg.preWaiverEmail ? (
                                <>
                                  <span className="text-white/40 text-xs">chat: </span>{reg.preWaiverEmail}
                                  {reg.customerEmail && reg.customerEmail.trim().toLowerCase() !== reg.preWaiverEmail.trim().toLowerCase() && (
                                    <div className="text-xs text-white/50 mt-0.5">checkout: {reg.customerEmail}</div>
                                  )}
                                </>
                              ) : (
                                reg.customerEmail
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                            {reg.customerPhone}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-white/80">
                            ${reg.amountPaid.toFixed(2)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-white/80">
                            {new Date(reg.paymentDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )}

            {/* Email Form */}
            <div className="bg-white/5 border border-white/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm" style={{ color: adminAccent }}>send email</h2>
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
                    showToast("Please enter subject and body to save as template", "error");
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
                onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                              link.style.color = adminAccent;
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
                          link.style.color = adminAccent;
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
                <div className="w-px bg-white/20" />
                <button
                  type="button"
                  onClick={() => {
                    setEmailFontSize("small");
                    if (emailEditorRef.current) {
                      emailEditorRef.current.style.fontSize = "14px";
                      setEmailBody(emailEditorRef.current.innerHTML);
                    }
                  }}
                  className={`px-2 py-1 text-xs hover:text-white hover:bg-white/10 border border-white/10 ${
                    emailFontSize === "small" ? "text-white bg-white/20" : "text-white/70"
                  }`}
                  title="Small Font (14px)"
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailFontSize("medium");
                    if (emailEditorRef.current) {
                      emailEditorRef.current.style.fontSize = "15px";
                      setEmailBody(emailEditorRef.current.innerHTML);
                    }
                  }}
                  className={`px-2 py-1 text-xs hover:text-white hover:bg-white/10 border border-white/10 ${
                    emailFontSize === "medium" ? "text-white bg-white/20" : "text-white/70"
                  }`}
                  title="Medium Font (15px)"
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailFontSize("large");
                    if (emailEditorRef.current) {
                      emailEditorRef.current.style.fontSize = "16px";
                      setEmailBody(emailEditorRef.current.innerHTML);
                    }
                  }}
                  className={`px-2 py-1 text-xs hover:text-white hover:bg-white/10 border border-white/10 ${
                    emailFontSize === "large" ? "text-white bg-white/20" : "text-white/70"
                  }`}
                  title="Large Font (16px)"
                >
                  L
                </button>
                <div className="w-px bg-white/20" />
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
                style={{ 
                  fontSize: emailFontSize === "small" ? "14px" : emailFontSize === "medium" ? "15px" : "16px",
                  minHeight: '200px', 
                  color: 'rgba(255, 255, 255, 0.8)' 
                }}
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
                className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                                "--file-bg": adminAccentMuted,
                                "--file-color": adminAccent,
                                "--file-hover-bg": "rgba(255,255,255,0.15)"
                              } as React.CSSProperties}
                              onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                        className="text-white/50 hover:text-white/70"
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
                recipients: <span style={{ color: adminAccent }}>{getEmailRecipients().length}</span>
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
              {getEmailRecipients().length > 0 && (
                <p className="text-xs text-white/50 mb-2">
                  sending to:{" "}
                  <span className="text-white/70 break-all">
                    {getEmailRecipients().join(", ")}
                  </span>
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={sendEmailToRegistrations}
                  disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim() || getEmailRecipients().length === 0}
                  className="rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: adminAccent, color: adminAccent }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = adminAccentHoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {isSendingEmail ? `sending to ${getEmailRecipients().length} recipient${getEmailRecipients().length !== 1 ? "s" : ""}…` : `send to ${getEmailRecipients().length} recipient${getEmailRecipients().length !== 1 ? "s" : ""}`}
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
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-white/50">
                    sent: <span style={{ color: adminAccent }}>{emailResult.sent}</span>
                    {" | "}
                    failed: <span className="text-white/50">{emailResult.failed}</span>
                  </p>
                  {emailResult.failed > 0 && emailResult.errors && emailResult.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded border border-white/10 bg-white/5 p-2">
                      <p className="mb-1 text-xs text-white/50">failed addresses:</p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-white/70">
                        {emailResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
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
                <h3 className="text-sm" style={{ color: adminAccent }}>email templates</h3>
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
                onFocus={(e) => e.target.style.borderColor = adminAccent}
                onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                  />
                  <button
                    onClick={saveEmailTemplate}
                    disabled={!templateName.trim() || !emailSubject.trim() || !emailBody.trim()}
                    className="w-full rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: adminAccent, color: adminAccent }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = adminAccentHoverBg}
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
                          style={{ color: adminAccent, borderColor: adminAccent }}
                          >
                            load
                          </button>
                          <button
                            onClick={() => deleteEmailTemplate(template.id)}
                            className="text-xs text-white/50 hover:text-white/70 border border-white/20 px-3 py-1 rounded"
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
            <h2 className="text-sm" style={{ color: adminAccent }}>event configuration</h2>
            
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
                        borderColor: adminAccent,
                        backgroundColor: adminAccentHoverBg,
                        color: adminAccent
                      } : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{config.event_name || config.event_id}</span>
                        <div className="flex items-center gap-2">
                          {config.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: adminAccentMuted, color: adminAccent }}>
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
                      no event config found. create one to get started.
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
                          stripe_image_url: "",
                          stripe_min_amount: 2200,
                          stripe_max_amount: 4400,
                          capacity: 25,
                          is_active: true,
                        });
                      }}
                      className="rounded border bg-transparent px-4 py-2 text-sm hover:opacity-80"
                      style={{ borderColor: adminAccent, color: adminAccent }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = adminAccentHoverBg}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/50 mb-1">Description</label>
                          <textarea
                            value={eventConfig.event_description || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, event_description: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Capacity</label>
                          <input
                            type="number"
                            value={eventConfig.capacity || 25}
                            onChange={(e) => setEventConfig({ ...eventConfig, capacity: parseInt(e.target.value) || 25 })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Multi-ticket */}
                    <div className="bg-white/5 border border-white/10 p-4 space-y-4">
                      <h3 className="text-xs text-white/70 uppercase">multi-ticket</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eventConfig.multi_ticket_enabled || false}
                          onChange={(e) => setEventConfig({ ...eventConfig, multi_ticket_enabled: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-white/70">Allow multiple tickets per order (purchaser + guests)</span>
                      </label>
                      {eventConfig.multi_ticket_enabled && (
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Max guests per order (max tickets = guests + 1)</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={eventConfig.max_guests_per_order ?? 3}
                            onChange={(e) => setEventConfig({ ...eventConfig, max_guests_per_order: Math.min(5, Math.max(1, parseInt(e.target.value) || 3)) })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-24 px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                          <span className="ml-2 text-xs text-white/50">→ max {(eventConfig.max_guests_per_order ?? 3) + 1} tickets</span>
                        </div>
                      )}
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
                              onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                              onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
                            onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/50 mb-1">Product Description</label>
                          <textarea
                            value={eventConfig.stripe_product_description || ""}
                            onChange={(e) => setEventConfig({ ...eventConfig, stripe_product_description: e.target.value })}
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            placeholder="Leave empty for auto-generated: “soma space presents [event name]” in your event color. Or set e.g. /checkout.jpg or full URL."
                            className="bg-white/5 border border-white/20 text-white/80 text-sm focus:outline-none w-full px-3 py-2"
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                            onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                onFocus={(e) => e.target.style.borderColor = adminAccent}
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
                    style={{ borderColor: adminAccent, color: adminAccent }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = adminAccentHoverBg}
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
                        borderColor: "rgba(255,255,255,0.5)", 
                        color: adminAccent,
                        backgroundColor: "transparent"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
                        e.currentTarget.style.borderColor = adminAccent;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
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
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded border px-4 py-3 text-sm shadow-lg"
          style={{
            backgroundColor: toast.type === "error" ? "rgba(120,40,40,0.95)" : "rgba(20,60,40,0.95)",
            borderColor: toast.type === "error" ? "rgba(255,120,120,0.4)" : "rgba(120,255,140,0.4)",
            color: "#eee",
          }}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}

