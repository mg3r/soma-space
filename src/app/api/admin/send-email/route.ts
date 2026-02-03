import { NextResponse } from "next/server";
import { getEventRegistrations, getAllEventsSummary } from "@/lib/admin";
import { sendEmailToRegistrations } from "@/lib/email";
import { getActiveEventConfig } from "@/lib/event-config";

const ALL_EVENTS_ID = "__all__";

// In-memory rate limit: send-email only (10 requests per minute per IP)
const SEND_EMAIL_LIMIT = 10;
const SEND_EMAIL_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = (forwarded?.split(",")[0]?.trim() || realIp || "unknown").slice(0, 64);
  return `send-email:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (now - entry.windowStart >= SEND_EMAIL_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > SEND_EMAIL_LIMIT) {
    const retryAfterSec = Math.ceil((SEND_EMAIL_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

export async function POST(req: Request) {
  try {
    const key = getClientKey(req);
    const { allowed, retryAfterSec } = checkRateLimit(key);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again in a minute.", retryAfterSec: retryAfterSec ?? 60 },
        { status: 429, headers: retryAfterSec ? { "Retry-After": String(retryAfterSec) } : undefined }
      );
    }

    // Handle both JSON and FormData
    const contentType = req.headers.get("content-type") || "";
    let eventId: string;
    let subject: string;
    let htmlBody: string;
    let selectedSessionIds: string[] | undefined;
    let customEmails: string[] | undefined;
    let excludeExcluded = true;
    let useBcc = false;
    let attachments: Array<{ filename: string; content: string; content_type?: string }> = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData (with file uploads)
      const formData = await req.formData();
      
      eventId = formData.get("eventId") as string;
      subject = formData.get("subject") as string;
      htmlBody = formData.get("htmlBody") as string;
      const selectedIdsStr = formData.get("selectedSessionIds") as string;
      const customEmailsStr = formData.get("customEmails") as string;
      excludeExcluded = formData.get("excludeExcluded") === "true";
      useBcc = formData.get("useBcc") === "true";

      if (selectedIdsStr) {
        try {
          selectedSessionIds = JSON.parse(selectedIdsStr);
        } catch {
          selectedSessionIds = undefined;
        }
      }

      if (customEmailsStr) {
        try {
          customEmails = JSON.parse(customEmailsStr);
        } catch {
          customEmails = undefined;
        }
      }

      // Process file attachments
      const fileEntries = Array.from(formData.entries()).filter(
        ([key]) => key.startsWith("attachment_")
      );

      for (const [, value] of fileEntries) {
        if (value instanceof File) {
          const arrayBuffer = await value.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Content = buffer.toString("base64");
          
          attachments.push({
            filename: value.name,
            content: base64Content,
            content_type: value.type || undefined,
          });
        }
      }
    } else {
      // Handle JSON (backward compatibility)
      const body = await req.json();
      eventId = body.eventId;
      subject = body.subject;
      htmlBody = body.htmlBody;
      selectedSessionIds = body.selectedSessionIds;
      customEmails = body.customEmails;
      excludeExcluded = body.excludeExcluded ?? true;
      useBcc = body.useBcc ?? false;
      
      // Handle attachments from JSON (already base64 encoded)
      if (body.attachments && Array.isArray(body.attachments)) {
        attachments = body.attachments;
      }
    }

    if (!eventId || !subject || !htmlBody) {
      return NextResponse.json(
        { error: "eventId, subject, and htmlBody are required" },
        { status: 400 }
      );
    }

    // Parse custom emails first
    const customEmailList: string[] = [];
    if (customEmails && Array.isArray(customEmails) && customEmails.length > 0) {
      customEmails.forEach((email: string) => {
        const trimmed = email.trim();
        if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          customEmailList.push(trimmed);
        }
      });
    }
    const hasCustomEmailInput = Boolean(customEmails && Array.isArray(customEmails) && customEmails.length > 0);

    // Build list of emails to send to
    const emails: string[] = [];

    // All events: use all-people list (one email per person across events)
    if (eventId === ALL_EVENTS_ID) {
      const { people } = await getAllEventsSummary();
      people.forEach((p) => {
        const e = p.email?.trim();
        if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) emails.push(e);
      });
      customEmailList.forEach((email) => emails.push(email));
    } else {
      // Single event: use registrations
      const registrations = await getEventRegistrations(eventId);

      // If custom emails are provided and no registrations selected, ONLY send to custom emails
      if (customEmailList.length > 0 && (!selectedSessionIds || selectedSessionIds.length === 0)) {
        emails.push(...customEmailList);
      } else {
        // Add selected registrations if specified
        // When explicitly selected, include them regardless of exclusion status
        if (selectedSessionIds && Array.isArray(selectedSessionIds) && selectedSessionIds.length > 0) {
          const selectedRegistrations = registrations.filter(reg =>
            selectedSessionIds!.includes(reg.sessionId)
          );
          selectedRegistrations.forEach(reg => {
            const stripeEmail = reg.customerEmail?.trim();
            const chatEmail = reg.preWaiverEmail?.trim()?.toLowerCase();
            // Chat email is primary; checkout (Stripe) is secondary when different
            if (chatEmail && chatEmail !== "N/A") emails.push(reg.preWaiverEmail!.trim());
            if (stripeEmail && stripeEmail !== "N/A" && stripeEmail.toLowerCase() !== chatEmail) {
              emails.push(stripeEmail);
            }
          });
        } else if (!hasCustomEmailInput) {
          // Only send to all registrations if no custom email input AND no selection
          // (If user typed invalid email, don't default to all)
          const activeRegistrations = excludeExcluded
            ? registrations.filter(reg => !reg.isExcluded)
            : registrations;

          activeRegistrations.forEach(reg => {
            const stripeEmail = reg.customerEmail?.trim();
            const chatEmail = reg.preWaiverEmail?.trim()?.toLowerCase();
            // Chat email is primary; checkout (Stripe) is secondary when different
            if (chatEmail && chatEmail !== "N/A") emails.push(reg.preWaiverEmail!.trim());
            if (stripeEmail && stripeEmail !== "N/A" && stripeEmail.toLowerCase() !== chatEmail) {
              emails.push(stripeEmail);
            }
          });
        }

        // Add custom emails to the list (if registrations are also selected)
        customEmailList.forEach(email => emails.push(email));
      }
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(emails)];

    if (uniqueEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found" },
        { status: 400 }
      );
    }

    // Get event config for dynamic colors
    const eventConfig = await getActiveEventConfig();
    const primaryColor = eventConfig.primary_color || "#05fd00";

    // Send emails with attachments
    const result = await sendEmailToRegistrations(
      uniqueEmails, 
      subject, 
      htmlBody, 
      useBcc,
      attachments.length > 0 ? attachments : undefined,
      primaryColor
    );

    return NextResponse.json({
      success: true,
      total: uniqueEmails.length,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error sending emails:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check if it's a missing API key error
    if (errorMessage.includes("RESEND_API_KEY")) {
      return NextResponse.json(
        { 
          error: "Email service not configured", 
          details: "RESEND_API_KEY environment variable is not set. Please configure it in Vercel.",
          hint: "Go to Vercel dashboard > Settings > Environment Variables and add RESEND_API_KEY"
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to send emails", details: errorMessage },
      { status: 500 }
    );
  }
}
