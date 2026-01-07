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

