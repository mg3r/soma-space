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
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap');
          @media only screen and (max-width: 600px) {
            .email-container {
              max-width: 100% !important;
              width: 100% !important;
              border-radius: 0 !important;
            }
            .email-padding {
              padding: 20px 25px !important;
            }
            .header-padding {
              padding: 25px 30px 20px !important;
            }
            .footer-padding {
              padding: 20px 30px !important;
            }
            .header-title {
              font-size: 24px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 10px;">
          <style>
            @media only screen and (max-width: 600px) {
              .email-wrapper {
                padding: 10px 5px !important;
              }
            }
          </style>
          <tr>
            <td align="center">
              <table role="presentation" class="email-container" style="max-width: 1200px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);">
                <!-- Header with spiral and aura -->
                <tr>
                  <td style="padding: 0; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); position: relative; overflow: hidden;">
                    <!-- Spiral SVG element -->
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; opacity: 0.08;">
                      <svg viewBox="0 0 200 200" style="width: 100%; height: 100%;">
                        <path d="M 100 100 m -80 0 a 80 80 0 1 1 160 0 a 80 80 0 1 1 -160 0" fill="none" stroke="#05fd00" stroke-width="1.5" stroke-dasharray="2,2" transform="rotate(0 100 100)">
                          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="60s" repeatCount="indefinite"/>
                        </path>
                        <path d="M 100 100 m -60 0 a 60 60 0 1 1 120 0 a 60 60 0 1 1 -120 0" fill="none" stroke="#05fd00" stroke-width="1" stroke-dasharray="1.5,1.5" transform="rotate(180 100 100)">
                          <animateTransform attributeName="transform" type="rotate" from="180 100 100" to="540 100 100" dur="45s" repeatCount="indefinite"/>
                        </path>
                      </svg>
                    </div>
                    <!-- Subtle aura effects -->
                    <div style="position: absolute; top: -100px; right: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(5, 253, 0, 0.12) 0%, transparent 70%); border-radius: 50%; filter: blur(40px);"></div>
                    <div style="position: absolute; bottom: -80px; left: -80px; width: 250px; height: 250px; background: radial-gradient(circle, rgba(5, 253, 0, 0.08) 0%, transparent 70%); border-radius: 50%; filter: blur(35px);"></div>
                    <div class="header-padding" style="padding: 30px 40px 25px; text-align: center; position: relative; z-index: 1;">
                      <h1 class="header-title" style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; text-transform: lowercase;">soma space</h1>
                      <div style="margin-top: 12px; width: 50px; height: 2px; background: linear-gradient(90deg, transparent, #05fd00, transparent); margin-left: auto; margin-right: auto;"></div>
                    </div>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td class="email-padding" style="padding: 40px 50px;">
                    <div style="color: #111111; font-size: 17px; line-height: 1.8; max-width: 100%;">
                      ${htmlBody}
                    </div>
                  </td>
                </tr>
                <!-- Footer with spiral and better visibility -->
                <tr>
                  <td class="footer-padding" style="padding: 25px 40px; background: linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%); border-top: 2px solid #e8e8e8; text-align: center; position: relative; overflow: hidden;">
                    <!-- Subtle spiral in footer -->
                    <div style="position: absolute; top: 50%; right: 20px; transform: translateY(-50%); width: 120px; height: 120px; opacity: 0.06;">
                      <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                        <path d="M 50 50 m -40 0 a 40 40 0 1 1 80 0 a 40 40 0 1 1 -80 0" fill="none" stroke="#05fd00" stroke-width="1" stroke-dasharray="1,1"/>
                      </svg>
                    </div>
                    <!-- Subtle aura in footer -->
                    <div style="position: absolute; top: -30px; left: -30px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(5, 253, 0, 0.06) 0%, transparent 70%); border-radius: 50%; filter: blur(25px);"></div>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; position: relative; z-index: 1;">
                      <a href="https://entersoma.space" style="color: #05fd00; text-decoration: none; font-weight: 600; letter-spacing: 0.5px; text-transform: lowercase;">entersoma.space</a>
                    </p>
                    <p style="margin: 8px 0 0; color: #666666; font-size: 11px; line-height: 1.5; position: relative; z-index: 1;">
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

