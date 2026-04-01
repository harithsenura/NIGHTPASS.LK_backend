const https = require('https');

/**
 * Sends a premium HTML email via Resend REST API
 */
const sendEmail = async ({ to, subject, data }) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable. Please add it to Railway.");
    }

    const nextAuthUrl = process.env.NEXTAUTH_URL || 'https://nightpass.lk';
    
    // 1. Generate Ticket Cards HTML
    let ticketsHtml = '';
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach((ticket) => {
        // Each entry in processedTickets has an array of 'ticketIds'
        const ids = ticket.ticketIds || [data.purchaseId]; 
        
        ids.forEach((uniqueId) => {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${uniqueId}&bgcolor=ffffff`;
          
          // Gmail and others strip base64 images, so we use a dark gradient if it's base64 to ensure it still looks good.
          const isBase64 = data.eventImage && data.eventImage.startsWith('data:image/');
          const bgAttr = (!isBase64 && data.eventImage) ? `background="${data.eventImage}"` : '';

          ticketsHtml += `
            <!-- Premium Ticket Card Container -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin: 0 auto 40px auto; background-color: #0F1014; border-radius: 24px; border: 1px solid #222532; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; overflow: hidden;">
              <!-- TOP SECTION (Background) -->
              <tr>
                <td align="center" ${bgAttr} bgcolor="#1a1b26" style="background-size: cover; background-position: center; border-radius: 24px 24px 0 0;">
                  <!-- Dark Overlay for readability -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(15, 16, 20, 0.45); padding: 24px;">
                    <tr>
                      <td align="left" valign="top">
                        <span style="display:inline-block; background-color: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px; padding: 6px 12px; border-radius: 20px;">✓ VALID PASS</span>
                      </td>
                      <td align="right" valign="top">
                         <span style="display:inline-block; background-color: rgba(0,0,0,0.6); color: #ffffff; font-family: monospace; font-size: 12px; font-weight: bold; padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">LKR ${ticket.price.toLocaleString()}</span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top: 120px;">
                        <span style="color: #3b82f6; font-family: monospace; font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Ticket Tier</span><br/>
                        <span style="color: #ffffff; font-size: 32px; font-weight: 900; text-transform: uppercase; margin-top: 4px; display:inline-block;">${ticket.name}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CUTOUT DIVIDER -->
              <tr>
                <td style="padding: 0; background-color: #0F1014;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="20" style="background-color: #05050A; border-radius: 0 50% 50% 0; height: 40px; border-right: 1px solid #222532;"></td>
                      <td align="center" style="border-top: 2px dashed #2a2e40; line-height:0; height:0;"></td>
                      <td width="20" style="background-color: #05050A; border-radius: 50% 0 0 50%; height: 40px; border-left: 1px solid #222532;"></td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- BOTTOM SECTION -->
              <tr>
                <td style="padding: 10px 30px 40px 30px; background-color: #0F1014; border-radius: 0 0 24px 24px;">
                  <h2 style="margin: 0 0 24px 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">${data.eventName}</h2>
                  
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                      <td width="30" valign="top"><span style="font-size:18px;">📅</span></td>
                      <td><span style="color: #d1d5db; font-family: monospace; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; line-height: 20px;">${data.eventDate}</span></td>
                    </tr>
                    <tr><td colspan="2" height="12"></td></tr>
                    <tr>
                      <td width="30" valign="top"><span style="font-size:18px;">📍</span></td>
                      <td><span style="color: #d1d5db; font-family: monospace; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; line-height: 20px;">${data.eventVenue || 'SEE DETAILS ON WEB'}</span></td>
                    </tr>
                  </table>

                  <div style="height: 1px; background-color: #222532; margin-bottom: 24px;"></div>

                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td valign="bottom" align="left">
                        <p style="margin: 0 0 8px 0; color: #6b7280; font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">UNIQUE PASS ID</p>
                        <p style="margin: 0 0 16px 0; color: #ffffff; font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 1px;">${uniqueId}</p>
                        
                        <span style="display:inline-block; background-color: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.3); color: #3b82f6; font-size: 10px; font-weight: bold; padding: 6px 10px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">🛡 SECURE ENTRY GUARANTEED</span>
                      </td>
                      <td align="right" valign="bottom" width="100">
                         <div style="background-color: #ffffff; padding: 8px; border-radius: 12px; display:inline-block;">
                             <img src="${qrUrl}" width="80" height="80" alt="QR Code" style="display:block; border-radius: 6px;"/>
                         </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `;
        });
      });
    }

    // 2. Main HTML Wrapper
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="background-color: #05050A; color: #ffffff; font-family: sans-serif; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 50px 20px;">
        
        <!-- Header Section -->
        <div style="text-align: center; margin-bottom: 50px;">
          <h1 style="margin: 0; font-size: 42px; font-weight: 900; letter-spacing: -2px; color: #ffffff; text-transform: uppercase;">YOU'RE <span style="color: #2e6dff;">ALL SET!</span></h1>
          <p style="margin: 15px 0 0 0; color: rgba(255,255,255,0.5); font-size: 16px; line-height: 1.6; max-width: 400px; margin-left: auto; margin-right: auto;">
            Hi <strong style="color: #ffffff;">${data.customerName}</strong>, your transaction was successful. Your digital passes are ready for capture!
          </p>
        </div>

        <!-- Ticket Stack -->
        ${ticketsHtml}

        <!-- View Online Action -->
        <div style="text-align: center; margin: 50px 0;">
          <a href="${nextAuthUrl}/find-ticket?bookingId=${data.purchaseId}&identifier=${data.to || ''}" style="background-color: #2e6dff; color: #ffffff; padding: 18px 36px; border-radius: 18px; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; box-shadow: 0 15px 30px rgba(46,109,255,0.4); display: inline-block;">View Ticket on Web</a>
        </div>

        <!-- Billing Matrix Section -->
        <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; padding: 30px; margin-top: 40px;">
          <h3 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #2e6dff;">Order Information</h3>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 13px;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);">CUSTOMER DETAILS</td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #ffffff; font-weight: bold;">${data.customerName}<br/><span style="font-size: 11px; font-weight: normal; color: rgba(255,255,255,0.5);">${to}</span></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);">ORDER DETAILS</td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #ffffff; font-weight: bold;">#${data.purchaseId.substring(data.purchaseId.length-8).toUpperCase()}<br/><span style="font-size: 11px; font-weight: normal; color: rgba(255,255,255,0.5);">nightpass.lk</span></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);">BILLING DETAILS</td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #ffffff; font-weight: bold;">${data.billingAddress || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);">PAYMENT METHOD</td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; color: #ffffff; font-weight: bold;">${data.paymentMethod || 'Credit / Debit Card'}</td>
            </tr>
            <tr>
              <td style="padding: 20px 0 0 0; font-size: 18px; font-weight: 900; color: #ffffff;">GRAND TOTAL</td>
              <td style="padding: 20px 0 0 0; text-align: right; font-size: 18px; font-weight: 900; color: #ffffff;">LKR ${data.totalAmount.toLocaleString()}.00</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 60px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05);">
          <p style="margin: 0; color: rgba(255,255,255,0.3); font-size: 12px; letter-spacing: 1px;">&copy; 2026 NIGHTPASS.LK | SRI LANKA'S PREMIER EVENT HUB</p>
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

  } catch (error) {
    console.error('Error in sendEmail (Premium):', error.message);
    return { success: false, error: error.message || "Unknown API error" };
  }
};

module.exports = sendEmail;
