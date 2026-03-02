import { Resend } from "resend";
import { normalizeEmailHtml } from "./normalize-email-html";

/**
 * Send email notification when event reaches capacity
 */
export async function sendCapacityReachedNotification(
  eventId: string,
  eventName: string,
  capacity: number
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!adminEmail) {
    console.log("ADMIN_EMAIL not set, skipping email notification");
    return;
  }

  // If Resend is not configured, just log
  if (!resendApiKey) {
    console.log(`
      📧 CAPACITY REACHED NOTIFICATION (Email not sent - RESEND_API_KEY not configured)
      Event: ${eventName} (${eventId})
      Capacity: ${capacity} spots filled
      Admin Email: ${adminEmail}
    `);
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    
    // Use the from email from env, or default to noreply
    const fromEmail = process.env.RESEND_FROM_EMAIL || "ovi@entersoma.space";
    
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `${eventName} has reached capacity`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111111;">Event Capacity Reached</h2>
          <p>The <strong>${eventName}</strong> event has reached its capacity of ${capacity} spots.</p>
          <p>Check the admin dashboard for details:</p>
          <p><a href="https://entersoma.space/admin" style="color: #05fd00;">View Admin Dashboard</a></p>
        </div>
      `,
    });

    console.log(`✅ Capacity reached email sent to ${adminEmail}`);
  } catch (error) {
    console.error("Error sending capacity reached email:", error);
    // Don't throw - we don't want email failures to break the booking flow
  }
}

/**
 * Ensure all <a> tags have inline color for Gmail compatibility.
 * Gmail strips <style> blocks; inline styles are required for reliable link colors.
 */
function inlineLinkColors(html: string, color: string): string {
  return html.replace(
    /<a\s+([^>]*)>/gi,
    (_, attrs) => {
      const colorStyle = `color: ${color} !important; text-decoration: underline;`;
      const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (styleMatch) {
        const existing = styleMatch[1].replace(/\bcolor\s*:\s*[^;]+;?/gi, "").trim();
        const newStyle = existing ? `${colorStyle} ${existing}` : colorStyle;
        return `<a ${attrs.replace(/style\s*=\s*["'][^"']*["']/i, `style="${newStyle}"`)}>`;
      }
      return `<a ${attrs} style="${colorStyle}">`;
    }
  );
}

/**
 * Generate branded email HTML template
 */
function getEmailTemplate(htmlBody: string, primaryColor: string = "#05fd00"): string {
  const processedBody = inlineLinkColors(normalizeEmailHtml(htmlBody), primaryColor);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
        <style>
          :root {
            color-scheme: light;
            supported-color-schemes: light;
          }
          @media only screen and (max-width: 600px) {
            body {
              background-color: transparent !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            table[role="presentation"] {
              background-color: transparent !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            table[role="presentation"] > tbody > tr > td {
              padding: 0 !important;
            }
            .email-container {
              max-width: 100% !important;
              width: 100% !important;
              border-radius: 0 !important;
              border: none !important;
              outline: none !important;
              background-color: transparent !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .email-container td {
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
            .email-padding {
              border-radius: 0 !important;
            }
            @media only screen and (max-width: 600px) {
              .email-padding[style] {
                padding-left: 30px !important;
                padding-right: 30px !important;
                padding-top: 40px !important;
                padding-bottom: 40px !important;
              }
            }
            .header-padding {
              padding: 24px 20px 24px !important;
            }
            td.header-padding[style] {
              padding: 24px 30px 24px !important;
            }
            td.header-padding {
              padding: 24px 30px 24px !important;
            }
            .footer-padding {
              padding-top: 20px !important;
              padding-bottom: 20px !important;
            }
            @media only screen and (max-width: 600px) {
              .footer-padding[style] {
                padding-left: 30px !important;
                padding-right: 30px !important;
                padding-top: 24px !important;
                padding-bottom: 24px !important;
              }
            }
          }
          ul, ol {
            color: #111111 !important;
            margin: 10px 0;
            padding-left: 30px;
          }
          li {
            color: #111111 !important;
            margin: 5px 0;
          }
          p, div, span {
            color: #111111 !important;
          }
          p {
            margin: 0 0 6px 0 !important;
          }
          p:last-child {
            margin-bottom: 0 !important;
          }
          .footer-accent {
            color: ${primaryColor} !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Avenir', 'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important; background-color: transparent !important; color-scheme: light !important;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: transparent !important; padding: 0; margin: 0; border: none !important; outline: none !important;">
          <tr>
            <td align="center" style="background-color: transparent !important; padding: 0 !important;">
              <table role="presentation" class="email-container" style="max-width: 1200px; width: 100%; border-collapse: collapse; background-color: transparent !important; border-radius: 16px; overflow: visible; color-scheme: light !important; border: none !important; outline: none !important; box-shadow: none !important; margin: 0; padding: 0;">
                <!-- Header -->
                <tr>
                  <td class="header-padding" style="padding: 24px 40px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 50%, #111111 100%) !important; text-align: center; vertical-align: middle; border: none !important; outline: none !important;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="text-align: center; vertical-align: middle;">
                          <h1 style="margin: 0; padding: 0; color: #ffffff; font-size: 20px; font-weight: 400; font-family: 'Avenir', 'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important; letter-spacing: -0.5px; text-transform: lowercase; line-height: 1.1;">soma space</h1>
                          <table role="presentation" style="margin: 6px auto 0 auto; border-collapse: collapse;">
                            <tr>
                              <td style="width: 60px; height: 2px; background: linear-gradient(90deg, transparent, ${primaryColor}, transparent); box-shadow: 0 0 10px ${primaryColor}80, 0 0 20px ${primaryColor}40; border-radius: 1px;"></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td class="email-padding" style="padding: 40px 30px; padding-left: 30px; padding-right: 30px; padding-top: 40px; padding-bottom: 40px; background: #ffffff !important; border-radius: 0;">
                    <div style="color: #111111 !important; font-size: 14px; line-height: 1.6; font-family: 'Avenir', 'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;">
                      <style>
                        p { margin: 0 0 6px 0 !important; }
                        p:last-child { margin-bottom: 0 !important; }
                        div { margin: 0 0 6px 0 !important; }
                        div:last-child { margin-bottom: 0 !important; }
                        a { color: ${primaryColor} !important; text-decoration: underline !important; }
                        a:hover { opacity: 0.8 !important; }
                      </style>
                      ${processedBody}
                    </div>
                  </td>
                </tr>
                <!-- Footer: use active event color only (no fallback green) so web/mobile clients show same color -->
                <tr>
                  <td class="footer-padding" style="padding: 20px 40px 20px; padding-top: 20px; padding-bottom: 20px; padding-left: 40px; padding-right: 40px; background: #111111 !important; text-align: center; position: relative; height: auto; border: none !important; outline: none !important;">
                    <p style="margin: 0; padding: 0; font-size: 13px; line-height: 1.3;">
                      <span class="footer-accent" style="color: ${primaryColor} !important;"><a class="footer-accent" href="https://entersoma.space" style="color: ${primaryColor} !important; text-decoration: none; font-weight: 600; letter-spacing: 0.5px; text-transform: lowercase;">entersoma.space</a></span>
                    </p>
                    <p style="margin: 5px 0 0; padding: 0; color: #aaaaaa !important; font-size: 10px; line-height: 1.3;">
                      connect. accept. discover.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

type Attachment = {
  filename: string;
  content: string; // Base64 encoded
  content_type?: string;
  contentId?: string; // For inline CID images
};

/**
 * Send email to registered users for an event
 * Supports both individual sends and BCC
 * Supports attachments (PDF, images, etc.)
 */
export async function sendEmailToRegistrations(
  emails: string[],
  subject: string,
  htmlBody: string,
  useBcc: boolean = false,
  attachments?: Attachment[],
  primaryColor: string = "#05fd00"
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.error("❌ RESEND_API_KEY is not set in environment variables");
    throw new Error("RESEND_API_KEY not configured. Please set it in Vercel environment variables.");
  }

  console.log(`📧 Attempting to send email to ${emails.length} recipient(s)`);
  console.log(`📧 From email: ${process.env.RESEND_FROM_EMAIL || "ovi@entersoma.space"}`);
  console.log(`📧 Subject: ${subject}`);
  console.log(`📧 Use BCC: ${useBcc}`);
  console.log(`📧 Attachments: ${attachments?.length || 0}`);
  console.log(`📧 Strategy: ${useBcc ? 'BCC' : (attachments?.length ? 'Individual (has attachments)' : 'Batch API (no attachments)')}`);

  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@entersoma.space";
  const emailHtml = getEmailTemplate(htmlBody, primaryColor);
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Prepare attachments for Resend format (include contentId and contentType for inline CID images)
  // Resend API expects base64-encoded string for content, not Buffer
  const resendAttachments = attachments?.map(att => {
    const res: { filename: string; content: string; contentId?: string; contentType?: string } = {
      filename: att.filename,
      content: att.content, // already base64 from CID extraction or file upload
    };
    if (att.contentId) res.contentId = att.contentId;
    if (att.content_type) res.contentType = att.content_type;
    return res;
  }) || [];

  if (useBcc && emails.length > 0) {
    // Send one email with all recipients in BCC
    try {
      await resend.emails.send({
        from: fromEmail,
        to: fromEmail, // Send to self, everyone else in BCC
        bcc: emails,
        subject: subject,
        html: emailHtml,
        attachments: resendAttachments,
      });
      sent = emails.length;
      console.log(`✅ BCC email sent successfully to ${emails.length} recipients`);
    } catch (error) {
      failed = emails.length;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`BCC send failed: ${errorMsg}`);
      console.error("❌ Failed to send BCC email:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
    }
  } else {
    // Send individual emails (more reliable, better deliverability)
    // Use batch API when possible (no attachments) for better performance
    // Resend batch API supports up to 100 emails per request but doesn't support attachments
    
    const BATCH_SIZE = 100;
    const RATE_LIMIT_DELAY_MS = 600; // ~1.67 requests per second (under 2 req/s limit)
    const hasAttachments = resendAttachments.length > 0;
    
    // If no attachments, use batch API for better performance
    if (!hasAttachments && emails.length > 1) {
      // Split emails into batches of 100
      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        
        try {
          const batchData = batch.map(email => ({
            from: fromEmail,
            to: email,
            subject: subject,
            html: emailHtml,
          }));
          
          const batchResponse = await resend.batch.send(batchData);
          
          // Count successful and failed sends from batch response
          if (batchResponse.data && Array.isArray(batchResponse.data)) {
            batchResponse.data.forEach((result: { id?: string; error?: { message?: string } }, index: number) => {
              if (result && result.error) {
                failed++;
                errors.push(`${batch[index]}: ${result.error.message || 'Unknown error'}`);
                console.error(`❌ Failed to send email to ${batch[index]}:`, result.error);
              } else if (result && result.id) {
                sent++;
                console.log(`✅ Email sent successfully to ${batch[index]} (ID: ${result.id})`);
              } else {
                // Unknown result format - assume success
                sent++;
                console.log(`✅ Email sent successfully to ${batch[index]}`);
              }
            });
          } else {
            // If batch response format is unexpected, assume all succeeded
            sent += batch.length;
            batch.forEach(email => {
              console.log(`✅ Email sent successfully to ${email} (batch)`);
            });
          }
          
          // Rate limiting: wait between batches (except after the last batch)
          if (i + BATCH_SIZE < emails.length) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
          }
        } catch (error) {
          // If batch fails, try sending individually as fallback
          console.warn(`⚠️ Batch send failed for batch starting at index ${i}, falling back to individual sends`);
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.error("Batch error:", errorMsg);
          
          // Fall through to individual sends for this batch
          for (const email of batch) {
            try {
              await resend.emails.send({
                from: fromEmail,
                to: email,
                subject: subject,
                html: emailHtml,
              });
              sent++;
              console.log(`✅ Email sent successfully to ${email} (fallback)`);
              
              // Rate limiting for individual sends
              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
            } catch (individualError) {
              failed++;
              const individualErrorMsg = individualError instanceof Error ? individualError.message : "Unknown error";
              errors.push(`${email}: ${individualErrorMsg}`);
              console.error(`❌ Failed to send email to ${email}:`, individualError);
            }
          }
        }
      }
    } else {
      // Has attachments or single email - use individual sends with rate limiting
      for (const email of emails) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: subject,
            html: emailHtml,
            attachments: resendAttachments,
          });
          sent++;
          console.log(`✅ Email sent successfully to ${email}`);
          
          // Rate limiting: wait between sends (except after the last email)
          const emailIndex = emails.indexOf(email);
          if (emailIndex < emails.length - 1) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          errors.push(`${email}: ${errorMsg}`);
          console.error(`❌ Failed to send email to ${email}:`, error);
          
          // Check if it's a rate limit error (429) and wait longer
          if (error instanceof Error && error.message.includes('429')) {
            console.warn(`⚠️ Rate limit hit, waiting 2 seconds before continuing...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }
  }

  console.log(`📊 Email sending complete: ${sent} sent, ${failed} failed out of ${emails.length} total`);
  if (failed > 0 && errors.length > 0) {
    console.error(`❌ Failed emails (first 10):`, errors.slice(0, 10));
  }
  
  return { sent, failed, errors };
}

/**
 * Generate registration confirmation email HTML
 */
function getRegistrationConfirmationEmail(
  eventName: string,
  eventDate: string,
  eventTime: string,
  eventPlace: string,
  eventAddress: string,
  primaryColor: string = "#05fd00"
): string {
  const htmlBody = `
    <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">you're in.</p>
    
    <p style="margin: 0 0 20px 0;">thank you for reserving your spot at ${eventName}.</p>
    
    <p style="margin: 0 0 20px 0;">a gathering of movement, music, connection, gentle guidance, and embodied presence.</p>
    
    <div style="margin: 20px 0;">
      <p style="margin: 5px 0; font-weight: 500;">${eventDate} • ${eventTime}</p>
      <p style="margin: 5px 0; font-weight: 500;">${eventPlace}</p>
      <p style="margin: 5px 0; font-weight: 500;">${eventAddress}</p>
    </div>
    
    <div style="margin: 20px 0;">
      <a href="https://entersoma.space/manifesto" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">read the manifesto →</a>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #666666;">see you there.</p>
  `;
  
  return getEmailTemplate(htmlBody, primaryColor);
}

/**
 * Email 1 — Primary payer only: "you're in" (no waiver link).
 * Payer signs the waiver on site before checkout.
 */
export async function sendRegistrationConfirmationEmail(
  customerEmail: string,
  customerName: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  eventPlace: string,
  eventAddress: string,
  primaryColor: string = "#05fd00"
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.error("[email] RESEND_API_KEY not set – add it to .env.local to receive confirmation emails");
    return;
  }

  if (!customerEmail || customerEmail === "N/A") {
    console.log("[email] No valid customer email, skipping");
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "ovi@entersoma.space";
    const emailHtml = getRegistrationConfirmationEmail(
      eventName,
      eventDate,
      eventTime,
      eventPlace,
      eventAddress,
      primaryColor
    );

    console.log(`[email] Sending confirmation to ${customerEmail} (from: ${fromEmail})`);
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `you're in. ${eventName} confirmation`,
      html: emailHtml,
    });

    if (error) {
      console.error("[email] Resend API error:", error);
      console.error("[email] If testing locally: Resend may only deliver to verified addresses or to test addresses like delivered@resend.dev. See https://resend.com/docs/knowledge-base/what-email-addresses-to-use-for-testing");
      return;
    }
    console.log(`[email] ✅ Confirmation sent to ${customerEmail}`, data?.id ? `(id: ${data.id})` : "");
  } catch (error) {
    console.error("[email] Error sending confirmation:", error);
    console.error("[email] If testing locally: use delivered@resend.dev as the checkout email, or verify your domain in Resend.");
  }
}

/**
 * Email 2 — Guest (multi-ticket): "you're in" + link to sign the waiver.
 * Sent automatically when payment completes (webhook). Admin resend uses Email 3.
 */
export async function sendGuestWaiverEmail(
  guestEmail: string,
  guestName: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  eventPlace: string,
  eventAddress: string,
  waiverLink: string,
  primaryColor: string = "#05fd00"
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !guestEmail?.trim()) return;
  try {
    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "ovi@entersoma.space";
    const htmlBody = `
    <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">you're in.</p>
    <p style="margin: 0 0 20px 0;">someone reserved a spot for you at ${eventName}.</p>
    <p style="margin: 0 0 20px 0;">a gathering of movement, music, connection, gentle guidance, and embodied presence.</p>
    <div style="margin: 20px 0;">
      <p style="margin: 5px 0; font-weight: 500;">${eventDate} • ${eventTime}</p>
      <p style="margin: 5px 0; font-weight: 500;">${eventPlace}</p>
      <p style="margin: 5px 0; font-weight: 500;">${eventAddress}</p>
    </div>
    <div style="margin: 20px 0;">
      <a href="${waiverLink}" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">sign the participation agreement →</a>
    </div>
    <p style="margin: 20px 0 0 0; color: #666666;">see you there.</p>
    `;
    const emailHtml = getEmailTemplate(htmlBody, primaryColor);
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: guestEmail.trim(),
      subject: `you're in. ${eventName} – please sign the agreement`,
      html: emailHtml,
    });
    if (error) {
      console.error("[email] Guest waiver email Resend error:", error);
      throw error;
    }
    console.log(`[email] ✅ Guest waiver email sent to ${guestEmail}`, data?.id ? `(Resend id: ${data.id})` : "");
  } catch (e) {
    console.error("[email] Guest waiver email failed:", e);
    throw e;
  }
}

/**
 * Email 3 — Waiver only (admin "resend waiver").
 * No event copy; just "please sign the participation agreement" + link.
 */
export async function sendGuestWaiverReminderEmail(
  guestEmail: string,
  guestName: string,
  waiverLink: string,
  primaryColor: string = "#05fd00"
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !guestEmail?.trim()) return;
  try {
    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "ovi@entersoma.space";
    const htmlBody = `
    <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">please sign the participation agreement</p>
    <p style="margin: 0 0 20px 0;">hi ${guestName ? guestName.trim() : "there"} — you're registered for an upcoming soma space gathering. we still need your signed agreement.</p>
    <div style="margin: 20px 0;">
      <a href="${waiverLink}" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">sign the participation agreement →</a>
    </div>
    <p style="margin: 20px 0 0 0; color: #666666;">see you there.</p>
    `;
    const emailHtml = getEmailTemplate(htmlBody, primaryColor);
    await resend.emails.send({
      from: fromEmail,
      to: guestEmail.trim(),
      subject: "soma space — please sign the participation agreement",
      html: emailHtml,
    });
    console.log(`[email] ✅ Guest waiver reminder sent to ${guestEmail}`);
  } catch (e) {
    console.error("[email] Guest waiver reminder failed:", e);
    throw e;
  }
}