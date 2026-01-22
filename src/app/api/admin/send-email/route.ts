import { NextResponse } from "next/server";
import { getEventRegistrations } from "@/lib/admin";
import { sendEmailToRegistrations } from "@/lib/email";

export async function POST(req: Request) {
  try {
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
    if (customEmails && Array.isArray(customEmails)) {
      customEmails.forEach((email: string) => {
        const trimmed = email.trim();
        if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          customEmailList.push(trimmed);
        }
      });
    }

    // Build list of emails to send to
    const emails: string[] = [];

    // Get registrations for the event (needed for all cases)
    const registrations = await getEventRegistrations(eventId);

    // If custom emails are provided and no registrations selected, ONLY send to custom emails
    if (customEmailList.length > 0 && (!selectedSessionIds || selectedSessionIds.length === 0)) {
      emails.push(...customEmailList);
    } else {
      // Add selected registrations if specified
      if (selectedSessionIds && Array.isArray(selectedSessionIds) && selectedSessionIds.length > 0) {
        const selectedRegistrations = registrations.filter(reg => 
          selectedSessionIds.includes(reg.sessionId) && 
          (!excludeExcluded || !reg.isExcluded)
        );
        selectedRegistrations.forEach(reg => {
          if (reg.customerEmail && reg.customerEmail !== "N/A") {
            emails.push(reg.customerEmail);
          }
        });
      } else if (customEmailList.length === 0) {
        // If no selection and no custom emails, send to all (excluding excluded if requested)
        const activeRegistrations = excludeExcluded 
          ? registrations.filter(reg => !reg.isExcluded)
          : registrations;
        
        activeRegistrations.forEach(reg => {
          if (reg.customerEmail && reg.customerEmail !== "N/A") {
            emails.push(reg.customerEmail);
          }
        });
      }

      // Add custom emails to the list (if registrations are also selected)
      customEmailList.forEach(email => emails.push(email));
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(emails)];

    if (uniqueEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found" },
        { status: 400 }
      );
    }

    // Send emails with attachments
    const result = await sendEmailToRegistrations(
      uniqueEmails, 
      subject, 
      htmlBody, 
      useBcc,
      attachments.length > 0 ? attachments : undefined
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
    return NextResponse.json(
      { error: "Failed to send emails", details: errorMessage },
      { status: 500 }
    );
  }
}
