const https = require('https');

const sendEmail = async ({ to, subject, data }) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment variable. Please add it to Railway.");
    }

    console.log(`[RESEND] Attempting to send email to: ${to} via REST API`);

    // Formatting date helper
    const formattedDate = data.eventDate || "Date TBD";
    
    // Generate the HTML table for tickets
    let ticketsHtml = '';
    let totalQty = 0;
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach((ticket) => {
        for (let i = 0; i < ticket.qty; i++) {
          totalQty++;
          const ticketIndexStr = totalQty.toString().padStart(2, '0');
          const pId = data.purchaseId || '00000000';
          const tName = ticket.name || 'TKT';
          const pseudoUniqueId = `NP-${pId.substring(0,4).toUpperCase()}-${tName.substring(0,3).toUpperCase()}-${ticketIndexStr}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${pseudoUniqueId}&bgcolor=ffffff`;
          
          ticketsHtml += `
            <div style="background-color: #0d0d12; border: 1px solid rgba(255,255,255,0.08); border-radius: 32px; padding: 32px; margin-bottom: 24px; max-width: 450px; margin-left: auto; margin-right: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 6px 0; font-family: monospace; font-size: 11px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.4); letter-spacing: 2px;">TICKET TIER</p>
                    <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-weight: 800; color: #ffffff; font-size: 22px; text-transform: uppercase;">${ticket.name}</p>
                  </td>
                  <td valign="top" align="right">
                    <table cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 50px;">
                      <tr><td style="padding: 6px 16px;"><span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">LKR ${ticket.price.toLocaleString()}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; font-family: Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">${data.eventName}</p>
                <p style="margin: 0; font-family: monospace; font-size: 11px; font-weight: bold; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.5px;">${formattedDate}</p>
              </div>
              <div style="height: 1px; background-color: rgba(255,255,255,0.1); width: 100%; margin-bottom: 24px;"></div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="bottom" style="padding-bottom: 4px;">
                    <p style="margin: 0 0 10px 0; font-family: monospace; font-size: 11px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.4); letter-spacing: 2px;">UNIQUE PASS ID</p>
                    <p style="margin: 0; font-family: monospace; font-size: 20px; font-weight: 800; color: #2e6dff; letter-spacing: 2px;">${pseudoUniqueId}</p>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="background-color: #ffffff; padding: 8px; border-radius: 16px; width: 96px; height: 96px; display: inline-block;">
                      <img src="${qrUrl}" width="96" height="96" style="display: block; border-radius: 8px;" alt="QR Code" />
                    </div>
                  </td>
                </tr>
              </table>
            </div>`;
        }
      });
    }

    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <body style="background-color: #05050A; color: #ffffff; font-family: sans-serif; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 32px; margin-bottom: 10px; font-weight: 900; letter-spacing: 1px;">YOU'RE ALL SET! 🎉</h1>
        <p style="color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 40px; font-size: 15px;">Hi ${data.customerName}, your purchase for <span style="font-weight: bold; color: #FF3366;">${data.eventName}</span> was successful. Below are your unique event passes.</p>
        ${ticketsHtml}
        <p style="margin-top: 40px; color: rgba(255,255,255,0.4); font-size: 14px; text-align: center;">Please present this email at the venue gate for scanning.</p>
        <div style="text-align: center; padding: 30px; color: rgba(255,255,255,0.4); font-size: 13px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 40px;">
          <p>NightPass | Sri Lanka's Premier Event Platform</p>
        </div>
      </div>
    </body>
    </html>`;

    const postData = JSON.stringify({
      from: 'NightPass <tickets@nightpass.lk>', // Using the verified custom domain
      to: [to],
      subject: subject || `Your Tickets for ${data.eventName} - NightPass`,
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
            console.log('[RESEND] Email sent successfully:', responseBody);
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
    console.error('Error in sendEmail (REST):', error.message);
    return { success: false, error: error.message || "Unknown API error" };
  }
};

module.exports = sendEmail;
