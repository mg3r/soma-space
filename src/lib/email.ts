import { Resend } from "resend";

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
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@entersoma.space";
    
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
 * Generate branded email HTML template
 */
function getEmailTemplate(htmlBody: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
          @media only screen and (max-width: 600px) {
            .email-container {
              max-width: 100% !important;
              width: 100% !important;
              border-radius: 0 !important;
              border-width: 0 !important;
            }
            .email-padding {
              padding: 30px 20px !important;
            }
            .header-padding {
              padding: 12px 30px 12px !important;
            }
            .footer-padding {
              padding: 12px 30px 12px !important;
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
            margin: 0 0 10px 0 !important;
          }
          p:last-child {
            margin-bottom: 0 !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" class="email-container" style="max-width: 1200px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="padding: 24px 40px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 50%, #111111 100%); text-align: center; vertical-align: middle;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="text-align: center; vertical-align: middle;">
                          <h1 style="margin: 0; padding: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.5px; text-transform: lowercase; line-height: 1.1;">soma space</h1>
                          <div style="margin-top: 6px; width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #05fd00, transparent); margin-left: auto; margin-right: auto; box-shadow: 0 0 10px rgba(5, 253, 0, 0.7), 0 0 20px rgba(5, 253, 0, 0.4); border-radius: 1px;"></div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td class="email-padding" style="padding: 40px 30px; background: #f8f8f8;">
                    <div style="color: #111111 !important; font-size: 14px; line-height: 1.6; font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                      <style>
                        p { margin: 0 0 10px 0 !important; }
                        p:last-child { margin-bottom: 0 !important; }
                        div { margin: 0 0 10px 0 !important; }
                        div:last-child { margin-bottom: 0 !important; }
                      </style>
                      ${htmlBody}
                    </div>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td class="footer-padding" style="padding: 12px 40px 12px; background: #111111; text-align: center; position: relative; height: auto;">
                    <p style="margin: 0; padding: 0; font-size: 13px; line-height: 1.3;">
                      <a href="https://entersoma.space" style="color: #05fd00; text-decoration: none; font-weight: 600; letter-spacing: 0.5px; text-transform: lowercase;">entersoma.space</a>
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
  attachments?: Attachment[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.error("❌ RESEND_API_KEY is not set in environment variables");
    throw new Error("RESEND_API_KEY not configured. Please set it in Vercel environment variables.");
  }

  console.log(`📧 Attempting to send email to ${emails.length} recipient(s)`);
  console.log(`📧 From email: ${process.env.RESEND_FROM_EMAIL || "noreply@entersoma.space"}`);
  console.log(`📧 Subject: ${subject}`);
  console.log(`📧 Use BCC: ${useBcc}`);
  console.log(`📧 Attachments: ${attachments?.length || 0}`);

  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@entersoma.space";
  const emailHtml = getEmailTemplate(htmlBody);
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Prepare attachments for Resend format
  const resendAttachments = attachments?.map(att => ({
    filename: att.filename,
    content: Buffer.from(att.content, 'base64'),
  })) || [];

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
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${email}: ${errorMsg}`);
        console.error(`❌ Failed to send email to ${email}:`, error);
        if (error instanceof Error) {
          console.error("Error details:", error.message);
        }
      }
    }
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
  eventAddress: string
): string {
  const htmlBody = `
    <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">you're in.</p>
    
    <p style="margin: 0 0 20px 0;">thank you for reserving your spot at ${eventName}.</p>
    
    <p style="margin: 0 0 20px 0;">an evening of movement, music, connection, gentle guidance, and embodied presence.</p>
    
    <div style="margin: 20px 0;">
      <p style="margin: 5px 0; font-weight: 500;">${eventDate} • ${eventTime}</p>
      <p style="margin: 5px 0; font-weight: 500;">${eventPlace}</p>
      <p style="margin: 5px 0; font-weight: 500;">${eventAddress}</p>
    </div>
    
    <div style="margin: 20px 0;">
      <a href="https://entersoma.space/manifesto" style="color: #05fd00; text-decoration: none; font-weight: 500;">read the manifesto →</a>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #666666;">see you there.</p>
  `;
  
  return getEmailTemplate(htmlBody);
}

/**
 * Send registration confirmation email to customer
 */
export async function sendRegistrationConfirmationEmail(
  customerEmail: string,
  customerName: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  eventPlace: string,
  eventAddress: string
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not set, skipping registration confirmation email");
    return;
  }

  if (!customerEmail || customerEmail === "N/A") {
    console.log("No valid customer email, skipping registration confirmation email");
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@entersoma.space";
    const emailHtml = getRegistrationConfirmationEmail(
      eventName,
      eventDate,
      eventTime,
      eventPlace,
      eventAddress
    );
    
    await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `you're in. ${eventName} confirmation`,
      html: emailHtml,
    });

    console.log(`✅ Registration confirmation email sent to ${customerEmail}`);
  } catch (error) {
    console.error("Error sending registration confirmation email:", error);
    // Don't throw - we don't want email failures to break the booking flow
  }
}

