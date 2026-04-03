const https = require('https');

/**
 * Sends a professional, premium HTML email via Resend REST API (Light-Mode Optimized)
 */
const sendEmail = async ({ to, subject, data }) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable. Please add it to Railway.");
    }

    const nextAuthUrl = process.env.NEXTAUTH_URL || 'https://nightpass.lk';
    
    // 1. Generate Order Summary Rows (Light-Mode Optimized)
    let ticketSummaryHtml = '';
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach((ticket) => {
        ticketSummaryHtml += `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #edf2f7; color: #1e293b; font-size: 14px;">
              <span style="font-weight: 600;">${ticket.qty}x</span> ${ticket.name}
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #edf2f7; text-align: right; color: #1e293b; font-weight: 600; font-size: 14px;">
              LKR ${(ticket.price * ticket.qty).toLocaleString()}
            </td>
          </tr>
        `;
      });
    }

    // 2. Professional Light-Mode HTML Template
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Confirmation</title>
    </head>
    <body style="background-color: #f4f7fa; color: #1e293b; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        
        <!-- Header & Logo -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h2 style="margin: 0; color: #2563eb; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">NIGHT<span style="color: #1e293b;">PASS</span>.LK</h2>
        </div>

        <!-- Main Content Card -->
        <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Success Status -->
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 8px 16px; border-radius: 9999px; margin-bottom: 20px;">
              <span style="color: #059669; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">✓ Payment Successful</span>
            </div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2;">Your Order is Confirmed!</h1>
            <p style="margin: 12px 0 0 0; color: #64748b; font-size: 16px; line-height: 1.5;">
              Hi <span style="color: #0f172a; font-weight: 600;">${data.customerName}</span>, your seats are booked for <span style="color: #2563eb; font-weight: 600;">${data.eventName}</span>.
            </p>
          </div>

          <!-- Divider -->
          <div style="height: 1px; background-color: #f1f5f9; margin-bottom: 32px;"></div>

          <!-- Customer & Order details -->
          <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Order Details</h3>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; margin-bottom: 32px;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Order Number:</td>
              <td style="padding: 4px 0; color: #0f172a; text-align: right; font-weight: 600;">#${data.purchaseId.substring(data.purchaseId.length-8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Date:</td>
              <td style="padding: 4px 0; color: #0f172a; text-align: right; font-weight: 600;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Payment Method:</td>
              <td style="padding: 4px 0; color: #0f172a; text-align: right; font-weight: 600;">${data.paymentMethod || 'Online Payment'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Billing Email:</td>
              <td style="padding: 4px 0; color: #0f172a; text-align: right; font-weight: 600;">${to}</td>
            </tr>
          </table>

          <!-- Items Table -->
          <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Ticket Summary</h3>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
            ${ticketSummaryHtml}
            <tr>
               <td style="padding: 24px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 800;">Total Paid</td>
               <td style="padding: 24px 0 0 0; text-align: right; color: #2563eb; font-size: 20px; font-weight: 800;">LKR ${data.totalAmount.toLocaleString()}</td>
            </tr>
          </table>

          <!-- CTA Buttons -->
          <div style="margin-top: 40px; text-align: center;">
            <a href="${nextAuthUrl}/download/${data.purchaseId}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 18px 36px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.25); border: 2px solid #059669; margin-bottom: 20px;">
              ⬇ Download Digital Passes
            </a>
            <br>
            <a href="${nextAuthUrl}/dashboard" style="display: inline-block; background-color: transparent; color: #64748b; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #e2e8f0;">
              Go to User Dashboard
            </a>
            <p style="margin: 16px 0 0 0; font-size: 13px; color: #94a3b8;">
              Click the green button above to instantly save your high-resolution tickets.
            </p>
          </div>
        </div>

        <!-- How to Use Section -->
        <div style="margin-top: 32px; padding: 0 20px;">
          <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 700;">Event Information:</h4>
          <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
            <strong>Event:</strong> ${data.eventName}<br>
            <strong>Date:</strong> ${data.eventDate}<br>
            <strong>Venue:</strong> ${data.eventVenue || 'See details in dashboard'}
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
            &copy; ${new Date().getFullYear()} NIGHTPASS.LK. All rights reserved.<br>
            This is an automated confirmation of your purchase. For support, please reply to this email.
          </p>
        </div>

      </div>
    </body>
    </html>`;

    const postData = JSON.stringify({
      from: 'NightPass <tickets@nightpass.lk>',
      to: [to],
      subject: subject || `🎟️ Your Tickets for ${data.eventName} - NightPass`,
      html: htmlTemplate,
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[RESEND] Professional Light-Mode email sent successfully');
            resolve({ success: true, details: JSON.parse(responseBody) });
          } else {
            console.error('[RESEND] API Error:', responseBody);
            resolve({ success: false, error: `Resend API Error: ${responseBody}` });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[RESEND] Network Error:', err.message);
        resolve({ success: false, error: `Network error: ${err.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Resend API connection timed out' });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    console.error('Error in sendEmail (Professional):', error.message);
    return { success: false, error: error.message || "Unknown API error" };
  }
};

module.exports = sendEmail;
