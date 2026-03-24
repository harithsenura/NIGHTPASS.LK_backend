const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, data }) => {
  try {
    // Determine the host for sending the email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // Formatting date helper
    const formattedDate = data.eventDate || "Date TBD";
    
    // Generate the HTML table for tickets seamlessly
    let ticketsHtml = '';
    let totalQty = 0;
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets.forEach((ticket) => {
        for (let i = 0; i < ticket.qty; i++) {
          totalQty++;
          const ticketIndexStr = totalQty.toString().padStart(2, '0');
          // Fallback parsing for purchaseId if not provided
          const pId = data.purchaseId || '00000000';
          const evName = data.eventName || 'EVENT';
          const tName = ticket.name || 'TKT';
          const pseudoUniqueId = `NP-${pId.substring(0,4).toUpperCase()}-${tName.substring(0,3).toUpperCase()}-${ticketIndexStr}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${pseudoUniqueId}&bgcolor=ffffff`;
          
          ticketsHtml += `
            <div style="background-color: #0d0d12; border: 1px solid rgba(255,255,255,0.08); border-radius: 32px; padding: 32px; margin-bottom: 24px; max-width: 450px; margin-left: auto; margin-right: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              
              <!-- Top Row: Tier and Price -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top">
                    <p style="margin: 0 0 6px 0; font-family: monospace; font-size: 11px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.4); letter-spacing: 2px;">TICKET TIER</p>
                    <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-weight: 800; color: #ffffff; font-size: 22px; text-transform: uppercase;">${ticket.name}</p>
                  </td>
                  <td valign="top" align="right">
                    <table cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 50px;">
                      <tr>
                        <td style="padding: 6px 16px;">
                          <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">LKR ${ticket.price.toLocaleString()}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Row: Event Name and Date -->
              <div style="margin-top: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; font-family: Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">${data.eventName}</p>
                <p style="margin: 0; font-family: monospace; font-size: 11px; font-weight: bold; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.5px;">${formattedDate}</p>
              </div>

              <!-- Subtle divider -->
              <div style="height: 1px; background-color: rgba(255,255,255,0.1); width: 100%; margin-bottom: 24px;"></div>

              <!-- Bottom Row: Pass ID and QR -->
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
            </div>
          `;
        }
      });
    }

    // NightPass Dark Themed Email Template
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #05050A; color: #ffffff; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; }
        p.intro { color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 40px; font-size: 15px; }
        .glow { font-weight: bold; color: #FF3366; }
        .footer { text-align: center; padding: 30px; color: rgba(255,255,255,0.4); font-size: 13px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 40px; }
      </style>
    </head>
    <body style="background-color: #05050A;">
      <div class="container" style="background-color: #05050A; padding-top: 60px;">
        <h1 style="color: #ffffff; font-size: 32px; margin-bottom: 10px; font-weight: 900; letter-spacing: 1px;">YOU'RE ALL SET! 🎉</h1>
        <p class="intro" style="text-align: center;">Hi ${data.customerName}, your purchase for <span class="glow">${data.eventName}</span> was successful. Below are your unique event passes.</p>
        
        <!-- Generated Tickets via CheckoutPage Aesthetic -->
        ${ticketsHtml}

        <p style="margin-top: 40px; color: rgba(255,255,255,0.4); font-size: 14px; text-align: center;">Please present this email or your ID at the venue gate for scanning. Keep your QR codes private.</p>
        
        <div class="footer">
          <p>NightPass | Sri Lanka's Premier Event Platform</p>
          <p>Need help? Contact support@nightpass.lk</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"NightPass" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject: subject || `Your Tickets for ${data.eventName} - NightPass`, // Subject line
      html: htmlTemplate, // html body
    };

    // Send email asynchronously
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};

module.exports = sendEmail;
