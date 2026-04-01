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
          
          // CRITICAL: Gmail clips emails larger than 102KB and completely strips base64 images, 
          // breaking the ticket UI into a blank box.
          const isBase64 = data.eventImage && data.eventImage.startsWith('data:image');
          const headerBgUrl = (!isBase64 && data.eventImage) ? data.eventImage : "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=800&q=80&auto=format&fit=crop";
          
          ticketsHtml += `
            <!-- Ticket Card for Email -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; margin: 0 auto 30px auto; background-color: #0d0d14; border: 1px solid #1f2937; border-radius: 24px; font-family: Arial, sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
              <!-- Header Image & Badges -->
              <tr>
                <td background="${headerBgUrl}" bgcolor="#111111" valign="top" style="border-top-left-radius: 24px; border-top-right-radius: 24px; height: 220px; background-size: cover; background-position: center; padding: 25px;">
                  <!--[if gte mso 9]>
                  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:480px;height:220px;">
                    <v:fill type="tile" src="${headerBgUrl}" color="#111111" />
                    <v:textbox inset="0,0,0,0">
                  <![endif]-->
                  <div>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="left" valign="top">
                          <span style="background-color: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.4); padding: 8px 16px; border-radius: 50px; font-family: 'Courier New', monospace; font-size: 10px; font-weight: bold; color: #4ade80; letter-spacing: 2px;">● VALID PASS</span>
                        </td>
                        <td align="right" valign="top">
                          <span style="background-color: rgba(0, 0, 0, 0.7); border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 12px; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; color: #ffffff;">LKR ${ticket.price.toLocaleString()}</span>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 80px;">
                      <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; color: #2e6dff; letter-spacing: 3px;">TICKET TIER</p>
                      <h4 style="margin: 8px 0 0 0; font-size: 28px; font-weight: 900; color: #ffffff; text-transform: uppercase;">${ticket.name}</h4>
                    </div>
                  </div>
                  <!--[if gte mso 9]>
                    </v:textbox>
                  </v:rect>
                  <![endif]-->
                </td>
              </tr>
              <!-- Separator -->
              <tr>
                <td style="padding: 0 25px;">
                  <div style="border-top: 2px dashed #1f2937; height: 1px; width: 100%;"></div>
                </td>
              </tr>
              <!-- Details Content -->
              <tr>
                <td style="padding: 30px 25px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">${data.eventName}</h2>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-bottom: 15px;">
                        <span style="font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; color: #888888; letter-spacing: 2px;">📅 DATE</span><br/>
                        <span style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; color: #ffffff; text-transform: uppercase; display: inline-block; margin-top: 6px;">${data.eventDate}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 25px;">
                        <span style="font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; color: #888888; letter-spacing: 2px;">📍 LOCATION</span><br/>
                        <span style="font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; color: #ffffff; text-transform: uppercase; display: inline-block; margin-top: 6px;">${data.eventVenue || 'See details on web'}</span>
                      </td>
                    </tr>
                  </table>

                  <div style="border-top: 1px solid #1f2937; margin: 0 0 25px 0; height: 1px; width: 100%;"></div>

                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="bottom" align="left">
                        <p style="margin: 0 0 8px 0; font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; color: #888888; letter-spacing: 2px;">UNIQUE PASS ID</p>
                        <p style="margin: 0 0 15px 0; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">${uniqueId}</p>
                        <span style="background-color: rgba(46, 109, 255, 0.1); border: 1px solid rgba(46, 109, 255, 0.2); color: #2e6dff; padding: 6px 12px; border-radius: 6px; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">🛡 SECURE ENTRY GUARANTEED</span>
                      </td>
                      <td valign="bottom" align="right">
                        <div style="background-color: #ffffff; padding: 10px; border-radius: 12px; display: inline-block;">
                          <img src="${qrUrl}" width="90" height="90" style="display: block; border-radius: 8px;" alt="QR" />
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
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
