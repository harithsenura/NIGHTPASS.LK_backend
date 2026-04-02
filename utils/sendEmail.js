const https = require('https');
const nodemailer = require('nodemailer');

/**
 * Sends a premium HTML email via Resend REST API or Nodemailer fallback
 */
const sendEmail = async ({ to, subject, data }) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_APP_PASSWORD;

    if (!resendApiKey && (!emailUser || !emailPass)) {
      throw new Error("Missing email configuration. Please set RESEND_API_KEY or EMAIL_USER/EMAIL_APP_PASSWORD environment variables.");
    }

    const nextAuthUrl = process.env.NEXTAUTH_URL || 'https://nightpass.lk';
    
    // 1. Generate Order Summary
    let ticketSummaryHtml = '';
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach((ticket) => {
        ticketSummaryHtml += `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ffffff;">${ticket.qty}x ${ticket.name}</td>
            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #ffffff;">LKR ${(ticket.price * ticket.qty).toLocaleString()}</td>
          </tr>
        `;
      });
    }

    // 2. Main HTML Wrapper
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="background-color: #05050A; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px;">
          <div style="display:inline-block; background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); padding: 12px 24px; border-radius: 50px; margin-bottom: 24px;">
            <span style="color: #4ade80; font-weight: bold; font-family: monospace; letter-spacing: 1px;">✓ PAYMENT SUCCESSFUL</span>
          </div>
          <h1 style="margin: 0; font-size: 36px; font-weight: 900; letter-spacing: -1px; color: #ffffff; text-transform: uppercase;">ORDER <span style="color: #2e6dff;">CONFIRMED</span></h1>
          <p style="margin: 15px 0 0 0; color: rgba(255,255,255,0.6); font-size: 16px; line-height: 1.6;">
            Hi <strong style="color: #ffffff;">${data.customerName}</strong>, thank you for your purchase. Your order for <strong>${data.eventName}</strong> has been confirmed.
          </p>
        </div>

        <!-- Receipt Box -->
        <div style="background-color: #0F1014; border: 1px solid #1a1b23; border-radius: 20px; padding: 30px; margin-bottom: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          <h3 style="margin: 0 0 24px 0; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #2e6dff; border-bottom: 1px solid #1a1b23; padding-bottom: 15px;">Your Receipt</h3>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5); width: 40%;">Order No:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right; font-family: monospace; font-weight: bold;">#${data.purchaseId.substring(data.purchaseId.length-8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5);">Date:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5);">Name:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${data.customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5);">Email:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${to}</td>
            </tr>
            ${data.phone ? `
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5);">Phone:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${data.phone}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5);">Billing Address:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${data.billingAddress || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: rgba(255,255,255,0.5);">Payment Method:</td>
              <td style="padding: 8px 0; color: #ffffff; text-align: right;">${data.paymentMethod || 'Credit / Debit Card'}</td>
            </tr>
          </table>

          <h4 style="margin: 0 0 15px 0; font-size: 14px; font-weight: bold; color: rgba(255,255,255,0.8);">Order Summary</h4>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            ${ticketSummaryHtml}
            <tr>
              <td style="padding: 20px 0 0 0; font-size: 18px; font-weight: 900; color: #ffffff;">GRAND TOTAL</td>
              <td style="padding: 20px 0 0 0; text-align: right; font-size: 18px; font-weight: 900; color: #4ade80;">LKR ${data.totalAmount.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <!-- Download Instructions -->
        <div style="background-color: rgba(46, 109, 255, 0.05); border: 1px solid rgba(46, 109, 255, 0.15); border-radius: 20px; padding: 30px; margin-bottom: 40px;">
          <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 900; color: #ffffff;">How to securely view your tickets:</h3>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 15px; line-height: 1.6;">
            <tr>
              <td width="36" valign="top" style="padding-bottom: 16px;">
                <div style="background-color: #2e6dff; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">1</div>
              </td>
              <td style="padding-bottom: 16px; color: rgba(255,255,255,0.8);">Click the dashboard button below to visit NightPass.</td>
            </tr>
            <tr>
              <td width="36" valign="top" style="padding-bottom: 16px;">
                <div style="background-color: #2e6dff; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">2</div>
              </td>
              <td style="padding-bottom: 16px; color: rgba(255,255,255,0.8);">Sign in using exactly this email: <strong style="color: #ffffff;">${to}</strong></td>
            </tr>
            <tr>
              <td width="36" valign="top">
                <div style="background-color: #2e6dff; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">3</div>
              </td>
              <td style="color: rgba(255,255,255,0.8);">Navigate to your <strong>Dashboard</strong> to view and download your secure QR code.</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 35px;">
            <a href="${nextAuthUrl}/dashboard" style="display: inline-block; background-color: #2e6dff; color: #ffffff; padding: 18px 40px; border-radius: 12px; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; font-size: 15px; box-shadow: 0 10px 25px rgba(46,109,255,0.3);">⬇ Download The Ticket From Here</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05);">
           <p style="margin: 0; color: rgba(255,255,255,0.6); font-size: 13px; margin-bottom: 10px;">Event: <strong>${data.eventName}</strong></p>
           <p style="margin: 0; color: rgba(255,255,255,0.6); font-size: 13px; margin-bottom: 20px;">Date & Time: <strong>${data.eventDate}</strong></p>
           <p style="margin: 0; color: rgba(255,255,255,0.3); font-size: 11px; letter-spacing: 1px;">&copy; ${new Date().getFullYear()} NIGHTPASS.LK | SECURE TICKETING</p>
        </div>

      </div>
    </body>
    </html>`;

    if (resendApiKey) {
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
              console.log('[RESEND] Premium email sent successfully');
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
    } else {
      // Fallback to Nodemailer
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      const mailOptions = {
        from: `"NightPass" <${emailUser}>`,
        to,
        subject: subject || `🎟️ Your Tickets for ${data.eventName} - NightPass`,
        html: htmlTemplate,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('[NODEMAILER] Premium email sent successfully via Gmail:', info.messageId);
      return { success: true, details: info };
    }

  } catch (error) {
    console.error('Error in sendEmail (Premium):', error.message);
    return { success: false, error: error.message || "Unknown API error" };
  }
};

module.exports = sendEmail;
