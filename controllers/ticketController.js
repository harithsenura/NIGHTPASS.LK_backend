const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const TicketPurchase = require('../models/TicketPurchase');
const Event = require('../models/Event');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { sanitizeInput } = require('../utils/sanitize');

// Get all tickets for a specific event
const getEventTickets = async (req, res) => {
  try {
    const { eventId } = req.params;
    const tickets = await Ticket.find({ eventId });
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
};

// Create a new ticket (Admin)
const createTicket = async (req, res) => {
  try {
    const { eventId, name, price, quantity, customStatus } = req.body;
    
    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const newTicket = new Ticket({
      eventId,
      name: sanitizeInput(name),
      price,
      quantity,
      customStatus: sanitizeInput(customStatus)
    });

    await newTicket.save();
    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ message: 'Error creating ticket', error: error.message });
  }
};

// Update a ticket (Admin)
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, quantity, customStatus } = req.body;
    
    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { $set: { 
        name: sanitizeInput(name), 
        price, 
        quantity, 
        customStatus: sanitizeInput(customStatus) 
      } },
      { new: true, runValidators: true }
    );

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Error updating ticket', error: error.message });
  }
};

// Delete a ticket (Admin)
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByIdAndDelete(id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting ticket', error: error.message });
  }
};

// Buy tickets
const buyTickets = async (req, res) => {
  try {
    const { eventId, user, guestInfo, tickets, totalAmount } = req.body;

    // Validate request
    if (!tickets || tickets.length === 0) {
      return res.status(400).json({ message: 'No tickets selected' });
    }

    // Process each ticket to ensure availability and update sold count
    const dbTickets = [];
    for (const item of tickets) {
      const dbTicket = await Ticket.findById(item.ticketId);
      
      if (!dbTicket) {
        return res.status(404).json({ message: `Ticket ${item.name} not found` });
      }

      if (dbTicket.quantity - dbTicket.sold < item.qty) {
        return res.status(400).json({ message: `Not enough availability for ${item.name}` });
      }
      dbTickets.push({ dbTicket: dbTicket, qtyToBuy: item.qty });
    }

    // After all checks pass, save the updates
    const processedTickets = [];
    const eventIdShort = eventId.toString().slice(-4).toUpperCase();
    
    for (const { dbTicket, qtyToBuy } of dbTickets) {
      dbTicket.sold += qtyToBuy;
      await dbTicket.save();

      const ticketNameShort = dbTicket.name.slice(0, 3).toUpperCase();
      const ticketIds = [];
      
      for (let i = 0; i < qtyToBuy; i++) {
        const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const uniqueId = `NP-${eventIdShort}-${ticketNameShort}-${randomSuffix}`;
        ticketIds.push(uniqueId);
      }

      processedTickets.push({
        ticketId: dbTicket._id,
        name: dbTicket.name,
        price: dbTicket.price,
        qty: qtyToBuy,
        ticketIds: ticketIds
      });
    }

    // Create purchase record
    const purchase = new TicketPurchase({
      eventId,
      user: req.user ? req.user._id : (user || null),
      guestInfo: {
        name: sanitizeInput(guestInfo?.name || "Guest"),
        email: sanitizeInput(guestInfo?.email?.toLowerCase().trim() || ""),
        phone: sanitizeInput(guestInfo?.phone || ""),
        nicOrPassport: sanitizeInput(guestInfo?.nic || guestInfo?.nicOrPassport || "")
      },
      tickets: processedTickets,
      totalAmount
    });

    await purchase.save();
    
    // Asynchronously send the confirmation email
    try {
      let recipientEmail = null;
      let customerName = "Valued Customer";

      if (user) {
        const buyer = await User.findById(user);
        if (buyer) {
          recipientEmail = buyer.email;
          customerName = buyer.name;
        }
      } else if (guestInfo && guestInfo.email) {
        recipientEmail = guestInfo.email;
        customerName = guestInfo.name || "Guest";
      }

      if (recipientEmail) {
        const eventData = await Event.findById(eventId);
        if (eventData) {
          console.log(`Attempting to send ticket email to: ${recipientEmail} for event: ${eventData.title}`);
          const emailResult = await sendEmail({
            to: recipientEmail,
            data: {
              customerName,
              eventName: eventData.title,
              eventDate: eventData.date,
              eventVenue: eventData.venue || eventData.location,
              eventImage: eventData.image,
              purchaseId: purchase._id.toString(),
              tickets: processedTickets,
              totalAmount,
              paymentMethod: "Manual/Login Purchase",
              billingAddress: guestInfo?.address || "N/A"
            }
          });
          
          if (emailResult.success) {
            console.log(`Email successfully sent to ${recipientEmail}`);
          } else {
            console.error(`Email failed to send to ${recipientEmail}:`, emailResult.error);
          }
        }
      }
    } catch (emailErr) {
      console.error("Non-fatal: Failed to trigger email notification", emailErr);
    }

    res.status(201).json({ message: 'Purchase successful', purchase });
  } catch (error) {
    res.status(500).json({ message: 'Error processing purchase', error: error.message });
  }
};

// Get User Tickets
const getUserTickets = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 1. First, find all tickets where user matches the ID
    // 2. Also find tickets where guestInfo.email matches the logged-in user's email
    // This allows guests who later register to see their old tickets.
    
    const mongoose = require('mongoose');
    let user = null;
    
    // Validate if userId is a standard MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      // If no valid user ID, try one more thing: search for user by ID string if it's stored differently
      // or just return 404 if truly not found.
      return res.status(404).json({ message: 'User not found or invalid session' });
    }

    // Escape special regex characters in the email string
    const escapedEmail = user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const purchases = await TicketPurchase.find({
      $or: [
        { user: userId },
        { "guestInfo.email": { $regex: new RegExp(`^${escapedEmail}$`, 'i') } }
      ]
    })
      .populate('eventId')
      .sort({ createdAt: -1 });
    
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user tickets', error: error.message });
  }
};

// Test Email Connectivity (Diagnostics)
const testEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    console.log(`[DIAGNOSTICS] Running email test for: ${email}`);
    const result = await sendEmail({
      to: email,
      subject: "NightPass Email Diagnostic Test",
      data: {
        customerName: "Diagnostic User",
        eventName: "SYSTEM TEST",
        eventDate: new Date().toLocaleString(),
        eventVenue: "Digital Arena",
        eventImage: "https://nightpass.lk/og-image.png",
        purchaseId: "TEST-12345",
        tickets: [{ name: "Standard Test", price: 0, qty: 1 }],
        totalAmount: 0,
        paymentMethod: "Test Payment",
        billingAddress: "No. 01, Colombo, Sri Lanka"
      }
    });

    if (result.success) {
      res.status(200).json({ message: 'Test email sent successfully!', details: result });
    } else {
      res.status(500).json({ message: 'Test email failed to send', error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error during email test', error: error.message });
  }
};

// Find Ticket by ID and Phone/NIC
const findPurchase = async (req, res) => {
  try {
    const { identifier, bookingId } = req.body;

    if (!identifier || !bookingId) {
      return res.status(400).json({ message: 'Booking ID and Phone/NIC are required' });
    }

    // Clean identifiers (remove spaces, etc.)
    const cleanId = identifier.trim();
    const lowerCleanId = cleanId.toLowerCase();
    const cleanBookingId = bookingId.trim().toUpperCase();

    // Escape special regex characters in the email string
    const escapedId = lowerCleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find all purchases that match the identifier (phone OR NIC OR email)
    // Using $regex for email to catch case differences if any
    const purchases = await TicketPurchase.find({
      $or: [
        { 'guestInfo.phone': cleanId },
        { 'guestInfo.nicOrPassport': cleanId },
        { 'guestInfo.email': { $regex: new RegExp(`^${escapedId}$`, 'i') } }
      ]
    }).populate('eventId').populate('user');

    // If no direct guest matches, try finding by user account
    let finalPurchases = [...purchases];
    
    if (finalPurchases.length === 0) {
      // Find a user who matches this phone/NIC/Email
      const matchingUser = await User.findOne({
        $or: [
          { phone: cleanId },
          { nicOrPassport: cleanId },
          { email: lowerCleanId }
        ]
      });

      if (matchingUser) {
        const userPurchases = await TicketPurchase.find({ user: matchingUser._id }).populate('eventId').populate('user');
        finalPurchases = [...userPurchases];
      }
    }

    if (!finalPurchases || finalPurchases.length === 0) {
      return res.status(404).json({ message: 'No tickets found for this identifier' });
    }

    // Filter in-memory to find the one that matches the booking ID (full or suffix)
    const purchase = finalPurchases.find(p => {
      const fullId = p._id.toString().toUpperCase();
      return fullId === cleanBookingId || fullId.endsWith(cleanBookingId);
    });

    if (!purchase) {
      return res.status(404).json({ message: 'No ticket found with this Booking ID for the given Phone/NIC' });
    }

    res.status(200).json(purchase);
  } catch (error) {
    console.error("Error in findPurchase:", error);
    res.status(500).json({ message: 'Error finding ticket', error: error.message });
  }
};

// Initiate PayHere Payment
const initiatePayHerePayment = async (req, res) => {
  try {
    const { eventId, user, guestInfo, tickets, totalAmount } = req.body;

    console.log(`[PAYHERE] Initiating payment for Event: ${eventId}, Amount: ${totalAmount}`);

    // 1. Basic Validation
    if (!tickets || tickets.length === 0) {
      console.error("[PAYHERE] Initiation failed: No tickets selected");
      return res.status(400).json({ message: 'No tickets selected' });
    }

    // 2. Check Availability (without updating sold count yet)
    for (const item of tickets) {
      const dbTicket = await Ticket.findById(item.ticketId);
      if (!dbTicket) {
        console.error(`[PAYHERE] Initiation failed: Ticket ${item.name} not found`);
        return res.status(404).json({ message: `Ticket ${item.name} not found` });
      }
      if (dbTicket.quantity - dbTicket.sold < item.qty) {
        console.error(`[PAYHERE] Initiation failed: Not enough availability for ${item.name}`);
        return res.status(400).json({ message: `Not enough availability for ${item.name}` });
      }
    }

    // 3. Generate unique Order ID
    const orderId = `NP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // 4. PayHere Hash Generation
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    if (!merchantId || !merchantSecret) {
      console.error("[PAYHERE] Initiation failed: Missing Merchant ID or Secret in .env");
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const currency = "LKR";
    const amountFormatted = parseFloat(totalAmount).toFixed(2);

    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashStr = merchantId + orderId + amountFormatted + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(hashStr).digest('hex').toUpperCase();

    console.log(`[PAYHERE] Generated Hash for Order: ${orderId}, Amount: ${amountFormatted}`);

    // 5. Prepare response for frontend
    const payhereData = {
      sandbox: process.env.PAYHERE_SANDBOX === 'true',
      merchant_id: merchantId,
      return_url: `${process.env.NEXTAUTH_URL}/checkout?status=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/checkout?status=cancelled`,
      notify_url: `${process.env.NEXTAUTH_URL}/api/tickets/payhere-notify`, // Ensure public access
      order_id: orderId,
      items: tickets.map(t => t.name).join(", "),
      amount: amountFormatted,
      currency: currency,
      hash: hash,
      first_name: guestInfo?.name?.split(" ")[0] || "Guest",
      last_name: guestInfo?.name?.split(" ").slice(1).join(" ") || "User",
      email: guestInfo?.email || "",
      phone: guestInfo?.phone || "",
      address: guestInfo?.address || "N/A",
      city: "Colombo", // Default needed for PayHere SDK
      country: "Sri Lanka",
      // Metadata for the notification step (passed as custom variables if needed, 
      // but we'll use order_id as key)
      custom_1: JSON.stringify({ eventId, userId: user, tickets, guestInfo })
    };

    res.status(200).json(payhereData);
  } catch (error) {
    console.error("PayHere initiation error:", error);
    res.status(500).json({ message: 'Error initiating payment', error: error.message });
  }
};

// PayHere Notification Webhook
const payhereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      custom_1
    } = req.body;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();

    // Verify Hash
    const localHashStr = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
    const localHash = crypto.createHash('md5').update(localHashStr).digest('hex').toUpperCase();

    if (localHash !== md5sig) {
      console.error("[PAYHERE] Hash mismatch! Potential tampering detected.");
      return res.status(400).send("Hash mismatch");
    }

    // status_code: 2 = Success
    if (status_code === "2") {
      console.log(`[PAYHERE] Payment SUCCESS for Order: ${order_id}`);

      // Extract metadata
      const { eventId, userId, tickets, guestInfo } = JSON.parse(custom_1);

      // --- SIMILAR TO buyTickets logic ---
      
      const dbTickets = [];
      for (const item of tickets) {
        const dbTicket = await Ticket.findById(item.ticketId);
        if (dbTicket) {
          dbTickets.push({ dbTicket: dbTicket, qtyToBuy: item.qty });
        }
      }

      const processedTickets = [];
      const eventIdShort = eventId.toString().slice(-4).toUpperCase();
      
      for (const { dbTicket, qtyToBuy } of dbTickets) {
        dbTicket.sold += qtyToBuy;
        await dbTicket.save();

        const ticketNameShort = dbTicket.name.slice(0, 3).toUpperCase();
        const ticketIds = [];
        for (let i = 0; i < qtyToBuy; i++) {
          const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
          const uniqueId = `NP-${eventIdShort}-${ticketNameShort}-${randomSuffix}`;
          ticketIds.push(uniqueId);
        }

        processedTickets.push({
          ticketId: dbTicket._id,
          name: dbTicket.name,
          price: dbTicket.price,
          qty: qtyToBuy,
          ticketIds: ticketIds
        });
      }

      // Create purchase record
      const purchase = new TicketPurchase({
        eventId,
        user: userId || null,
        guestInfo: {
          name: sanitizeInput(guestInfo?.name || "Guest"),
          email: sanitizeInput(guestInfo?.email?.toLowerCase().trim() || ""),
          phone: sanitizeInput(guestInfo?.phone || ""),
          nicOrPassport: sanitizeInput(guestInfo?.nic || guestInfo?.nicOrPassport || "")
        },
        tickets: processedTickets,
        totalAmount: parseFloat(payhere_amount),
        paymentStatus: 'paid',
        payhereOrderId: order_id
      });

      await purchase.save();

      // Trigger Email
      try {
        const eventData = await Event.findById(eventId);
        if (eventData) {
          await sendEmail({
            to: (guestInfo?.email || "").toLowerCase(),
            data: {
              customerName: guestInfo?.name || "Customer",
              eventName: eventData.title,
              eventDate: eventData.date,
              eventVenue: eventData.venue || eventData.location,
              eventImage: eventData.image,
              purchaseId: purchase._id.toString(),
              tickets: processedTickets,
              totalAmount: parseFloat(payhere_amount),
              paymentMethod: req.body.method || "PayHere Card Payment",
              billingAddress: guestInfo?.address || "N/A"
            }
          });
        }
      } catch (emailErr) {
        console.error("Email error after payment:", emailErr);
      }
    } else {
      console.log(`[PAYHERE] Payment status: ${status_code} for order: ${order_id}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("PayHere notify error:", error);
    res.status(500).send("Error");
  }
};

module.exports = {
  getEventTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  buyTickets,
  initiatePayHerePayment,
  payhereNotify,
  getUserTickets,
  findPurchase,
  testEmail
};

