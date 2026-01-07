/**
 * Send email notification when event reaches capacity
 * Currently logs to console. Can be extended to use Resend, SendGrid, etc.
 */
export async function sendCapacityReachedNotification(
  eventId: string,
  eventName: string,
  capacity: number
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  
  if (!adminEmail) {
    console.log("ADMIN_EMAIL not set, skipping email notification");
    return;
  }

  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  // For now, just log the notification
  console.log(`
    📧 CAPACITY REACHED NOTIFICATION
    Event: ${eventName} (${eventId})
    Capacity: ${capacity} spots filled
    Admin Email: ${adminEmail}
    
    Would send email to ${adminEmail} with:
    Subject: "${eventName} has reached capacity"
    Body: "The ${eventName} event has reached its capacity of ${capacity} spots."
  `);

  // Example Resend integration (uncomment when Resend is set up):
  /*
  import { Resend } from 'resend';
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  await resend.emails.send({
    from: 'noreply@entersoma.space',
    to: adminEmail,
    subject: `${eventName} has reached capacity`,
    html: `
      <h2>Event Capacity Reached</h2>
      <p>The <strong>${eventName}</strong> event has reached its capacity of ${capacity} spots.</p>
      <p>Check the admin dashboard for details: https://entersoma.space/admin</p>
    `,
  });
  */
}

