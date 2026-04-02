const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const TicketPurchase = require('../models/TicketPurchase');
const Event = require('../models/Event');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { sanitizeInput } = require('../utils/sanitize');

// Helper to clean up expired PayHere reservations globally
const clearExpiredReservations = async () => {
  try {
    const expiredTickets = await Ticket.find({ 'reservations.expiresAt': { $lt: new Date() } });
    for (const t of expiredTickets) {
      const expired = t.reservations.filter(r => r.expiresAt < new Date());
      const expiredQty = expired.reduce((acc, r) => acc + r.qty, 0);
      if (expiredQty > 0) {
        await Ticket.updateOne(
          { _id: t._id },
          { 
            $pull: { reservations: { expiresAt: { $lt: new Date() } } },
            $inc: { lockedQty: -expiredQty }
          }
        );
      }
    }
  } catch (error) {
    console.error("Cleanup reservations error:", error);
  }
};

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

    await clearExpiredReservations(); // Clear out Old Locks

    // Verify first (Soft check)
    for (const item of tickets) {
      const dbTicket = await Ticket.findById(item.ticketId);
      if (!dbTicket) {
        return res.status(404).json({ message: `Ticket ${item.name} not found` });
      }
      if (dbTicket.quantity - dbTicket.sold - (dbTicket.lockedQty || 0) < item.qty) {
        return res.status(400).json({ message: `Not enough availability for ${item.name}` });
      }
    }

    // Process each ticket to ensure availability and update sold count ATOMICALLY
    const dbTickets = [];
    const rollbackLog = []; // Keep track to rollback if needed

    for (const item of tickets) {
      // Atomic increment
      const updatedTicket = await Ticket.findOneAndUpdate(
        { 
          _id: item.ticketId, 
          $expr: { $gte: [{ $subtract: ["$quantity", { $add: [{ $ifNull: ["$sold", 0] }, { $ifNull: ["$lockedQty", 0] }] }] }, item.qty] } 
        },
        { $inc: { sold: item.qty } },
        { new: true }
      );
      
      if (!updatedTicket) {
        // Rollback previous increments
        for (const rb of rollbackLog) {
          await Ticket.updateOne({ _id: rb.id }, { $inc: { sold: -rb.qty } });
        }
        return res.status(400).json({ message: `Race condition: Not enough availability for ${item.name} at this exact moment.` });
      }

      rollbackLog.push({ id: item.ticketId, qty: item.qty });
      dbTickets.push({ dbTicket: updatedTicket, qtyToBuy: item.qty });
    }

    // After all checks pass, save the updates
    const processedTickets = [];
    const eventIdShort = eventId.toString().slice(-4).toUpperCase();
    
    for (const { dbTicket, qtyToBuy } of dbTickets) {
      // Notice: dbTicket is already incremented and saved atomically above.
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
              billingAddress: guestInfo?.address || "N/A",
              phone: guestInfo?.phone || "N/A"
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
      .populate({
        path: 'eventId',
        select: 'title date venue location status' // ⚡ Exclude image/coverPhoto (base64) to keep response fast
      })
      .sort({ createdAt: -1 })
      .lean(); // ⚡ Lean queries are much faster than full Mongoose documents
    
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user tickets', error: error.message });
  }
};

// Get Single Purchase by ID (Direct Lookup)
const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const purchase = await TicketPurchase.findById(id)
      .populate('eventId')
      .populate('user', 'name email');
      
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Security: Check if the requester is the owner OR if we should allow public view by ID
    // Since IDs are long and unguessable (ObjectIDs), allowing public view-by-ID is common for tickets
    // to allow sharing or guest access, but we can add a simple check if needed.
    
    res.status(200).json(purchase);
  } catch (error) {
    console.error("Error fetching purchase by ID:", error);
    res.status(500).json({ message: 'Error retrieving ticket details', error: error.message });
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

// Lock tickets temporarily before checkout
const lockTickets = async (req, res) => {
  try {
    const { tickets } = req.body;
    if (!tickets || tickets.length === 0) return res.status(400).json({ message: 'No tickets provided', success: false });

    await clearExpiredReservations();

    const lockSessionId = `LOCK_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expirationDate = new Date(Date.now() + 10 * 60 * 1000); 
    const rollbackLog = [];

    for (const item of tickets) {
      const lockedTicket = await Ticket.findOneAndUpdate(
        { 
          _id: item.ticketId, 
          $expr: { $gte: [{ $subtract: ["$quantity", { $add: [{ $ifNull: ["$sold", 0] }, { $ifNull: ["$lockedQty", 0] }] }] }, item.qty] }
        },
        { 
          $inc: { lockedQty: item.qty },
          $push: { reservations: { purchaseId: lockSessionId, qty: item.qty, expiresAt: expirationDate } } 
        },
        { new: true }
      );

      if (!lockedTicket) {
        // Rollback
        for (const rb of rollbackLog) {
          await Ticket.updateOne(
            { _id: rb.id },
            { 
               $inc: { lockedQty: -rb.qty },
               $pull: { reservations: { purchaseId: lockSessionId } }
            }
          );
        }
        return res.status(400).json({ success: false, message: `Race condition: Not enough availability for ${item.name || 'a ticket'} right now.` });
      }
      rollbackLog.push({ id: item.ticketId, qty: item.qty });
    }

    res.status(200).json({ success: true, lockSessionId, expiresAt: expirationDate.toISOString() });
  } catch (error) {
    console.error("Locking tickets error:", error);
    res.status(500).json({ success: false, message: 'Error locking tickets', error: error.message });
  }
};

// Initiate PayHere Payment
const initiatePayHerePayment = async (req, res) => {
  try {
    const { eventId, user, guestInfo, tickets, totalAmount, lockSessionId } = req.body;

    console.log(`[PAYHERE] Initiating payment for Event: ${eventId}, Amount: ${totalAmount}`);

    // 1. Basic Validation
    if (!tickets || tickets.length === 0) {
      console.error("[PAYHERE] Initiation failed: No tickets selected");
      return res.status(400).json({ message: 'No tickets selected' });
    }

    await clearExpiredReservations(); // Clear out Old Locks

    // 2. Check Availability and Atomically LOCK Tickets for 10 minutes (if no lockSessionId provided)
    const rollbackLog = []; // In case partial locking occurs
    const processedTickets = [];
    const eventIdShort = eventId.toString().slice(-4).toUpperCase();

    for (const item of tickets) {
      let dbTicket;
      
      if (lockSessionId) {
        // Very important: Verify they actually hold the lock!
        dbTicket = await Ticket.findOne({
          _id: item.ticketId,
          reservations: { $elemMatch: { purchaseId: lockSessionId, qty: item.qty, expiresAt: { $gte: new Date() } } }
        });
        
        if (!dbTicket) {
          console.error(`[PAYHERE] Session expired or invalid for ticket ${item.name}`);
          return res.status(400).json({ message: `Your checkout session for ${item.name} has expired. Please go back and try again.` });
        }
      } else {
        // Atomic increment of lockedQty and reservation pushing (Legacy Fallback)
        const expirationDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lock
        dbTicket = await Ticket.findOneAndUpdate(
          { 
            _id: item.ticketId, 
            $expr: { $gte: [{ $subtract: ["$quantity", { $add: [{ $ifNull: ["$sold", 0] }, { $ifNull: ["$lockedQty", 0] }] }] }, item.qty] }
          },
          { 
            $inc: { lockedQty: item.qty },
            $push: { reservations: { purchaseId: "PENDING", qty: item.qty, expiresAt: expirationDate } } 
          },
          { new: true }
        );

        if (!dbTicket) {
          console.error(`[PAYHERE] Initiation failed: Not enough real-time availability for ${item.name}`);
          for (const rb of rollbackLog) {
            await Ticket.updateOne(
              { _id: rb.id },
              { $inc: { lockedQty: -rb.qty }, $pull: { reservations: { expiresAt: expirationDate } } }
            );
          }
          return res.status(400).json({ message: `Race condition: Not enough availability for ${item.name} right now.` });
        }
        rollbackLog.push({ id: item.ticketId, qty: item.qty });
      }

      // Generate Ticket IDs
      const ticketNameShort = dbTicket.name.slice(0, 3).toUpperCase();
      const ticketIds = [];
      for (let i = 0; i < item.qty; i++) {
        const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        ticketIds.push(`NP-${eventIdShort}-${ticketNameShort}-${randomSuffix}`);
      }

      processedTickets.push({
        ticketId: dbTicket._id,
        name: dbTicket.name,
        price: dbTicket.price,
        qty: item.qty,
        ticketIds: ticketIds
      });
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

    // Make a note of this purchase's ID to map to reservations
    const purchase = new TicketPurchase({
      eventId,
      user: user || null,
      guestInfo: {
        name: sanitizeInput(guestInfo?.name || "Guest"),
        email: sanitizeInput(guestInfo?.email?.toLowerCase().trim() || ""),
        phone: sanitizeInput(guestInfo?.phone || ""),
        nicOrPassport: sanitizeInput(guestInfo?.nic || guestInfo?.nicOrPassport || ""),
        address: sanitizeInput(guestInfo?.address || "N/A")
      },
      tickets: processedTickets,
      totalAmount: parseFloat(totalAmount),
      paymentStatus: 'pending'
    });

    await purchase.save();

    // Map the temporary reservations to this purchase._id
    for (const pt of processedTickets) {
      await Ticket.updateOne(
        { _id: pt.ticketId, "reservations.purchaseId": lockSessionId || "PENDING" },
        { $set: { "reservations.$.purchaseId": purchase._id.toString() } }
      );
    }
    // 6. Prepare response for frontend
    const payhereData = {
      sandbox: process.env.PAYHERE_SANDBOX === 'true',
      merchant_id: merchantId,
      return_url: `${process.env.NEXTAUTH_URL}/checkout?status=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/checkout?status=cancelled`,
      notify_url: "https://nightpasslkbackend-production.up.railway.app/api/tickets/payhere-notify", 
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
      city: "Colombo", 
      country: "Sri Lanka",
      custom_1: purchase._id.toString() // Only pass the ID to avoid truncation
    };

    res.status(200).json({ 
      payhereData, 
      purchase: {
        _id: purchase._id,
        tickets: purchase.tickets
      }
    });

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

    console.log(`[PAYHERE-WEBHOOK] Received notification for Order: ${order_id}, Status: ${status_code}, custom_1: ${custom_1}`);

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();

    // Verify Hash
    const localHashStr = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
    const localHash = crypto.createHash('md5').update(localHashStr).digest('hex').toUpperCase();

    if (localHash !== md5sig) {
      console.error(`[PAYHERE-WEBHOOK] Hash mismatch! Local: ${localHash}, Received: ${md5sig}`);
      return res.status(400).send("Hash mismatch");
    }

    console.log(`[PAYHERE-WEBHOOK] Hash verified successfully for ${order_id}`);

    // status_code: 2 = Success
    if (status_code == 2) {
      console.log(`[PAYHERE] Payment SUCCESS for Order: ${order_id}`);

      // Fetch the pending purchase
      const purchaseId = custom_1;
      console.log(`[PAYHERE-WEBHOOK] Searching for Pending Purchase: ${purchaseId}`);
      const purchase = await TicketPurchase.findById(purchaseId);
      
      if (!purchase) {
        console.error(`[PAYHERE-WEBHOOK] Critical failure: Purchase ID ${purchaseId} not found in DB!`);
        return res.status(404).send("Purchase not found");
      }

      if (purchase.paymentStatus === 'paid') {
        console.log(`[PAYHERE] Duplicate notification for Purchase: ${purchaseId}. Skipping.`);
        return res.status(200).send("OK");
      }

      // 1. Update ticket availability (Sold counts ATOMICALLY)
      for (const item of purchase.tickets) {
        // First conditionally remove the reservation lock if it hasn't expired yet
        await Ticket.updateOne(
          { _id: item.ticketId, "reservations.purchaseId": purchaseId },
          { 
            $inc: { lockedQty: -item.qty },
            $pull: { reservations: { purchaseId: purchaseId } }
          }
        );

        // Then atomically increment the sold count
        const dbTicket = await Ticket.findOneAndUpdate(
          { _id: item.ticketId },
          { $inc: { sold: item.qty } },
          { new: true }
        );
        if (dbTicket && dbTicket.sold > dbTicket.quantity) {
          console.error(`[CRITICAL] Oversold ticket ${dbTicket.name}! Sold: ${dbTicket.sold}, Max: ${dbTicket.quantity}. User already paid via PayHere.`);
        }
      }

      // 2. Update purchase record
      purchase.paymentStatus = 'paid';
      purchase.payhereOrderId = order_id;
      await purchase.save();
      console.log(`[PAYHERE-WEBHOOK] Purchase ${purchaseId} updated to 'paid'. Sending email...`);

      // Trigger Email
      try {
        const eventData = await Event.findById(purchase.eventId);
        if (eventData) {
          const emailResult = await sendEmail({
            to: (purchase.guestInfo?.email || "").toLowerCase(),
            data: {
              customerName: purchase.guestInfo?.name || "Customer",
              eventName: eventData.title,
              eventDate: eventData.date,
              eventVenue: eventData.venue || eventData.location,
              eventImage: eventData.image,
              purchaseId: purchase._id.toString(),
              tickets: purchase.tickets,
              totalAmount: purchase.totalAmount,
              paymentMethod: req.body.method || "PayHere Card Payment",
              billingAddress: purchase.guestInfo?.address || "N/A",
              phone: purchase.guestInfo?.phone || "N/A"
            }
          });
          console.log(`[PAYHERE-WEBHOOK] Resend API call result: ${JSON.stringify(emailResult)}`);
        } else {
           console.warn(`[PAYHERE-WEBHOOK] Skipping email: Event Data not found for ID: ${purchase.eventId}`);
        }
      } catch (emailErr) {
        console.error(`[PAYHERE-WEBHOOK] Internal error during email processing: ${emailErr.message}`);
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

// Verify Ticket Availability (Before Checkout/Payment)
const verifyAvailability = async (req, res) => {
  try {
    const { tickets } = req.body;
    if (!tickets || tickets.length === 0) {
      return res.status(400).json({ message: 'No tickets provided', available: false });
    }

    const unavailabilities = [];

    await clearExpiredReservations(); // Clear out Old Locks

    for (const item of tickets) {
      // Use fallback properties if needed since payload mighty vary slightly
      const tId = item.ticketId || item.id || item._id; 
      const dbTicket = await Ticket.findById(tId);
      
      if (!dbTicket) {
        unavailabilities.push(`${item.name || 'Unknown Ticket'} not found`);
        continue;
      }
      
      // Real-time capacity check including lockedQty
      const available = dbTicket.quantity - dbTicket.sold - (dbTicket.lockedQty || 0);
      if (available < item.qty) {
        unavailabilities.push(`Not enough availability for ${dbTicket.name} (Only ${Math.max(0, available)} left)`);
      }
    }

    if (unavailabilities.length > 0) {
      return res.status(200).json({ 
        available: false, 
        message: 'Some tickets are no longer available', 
        details: unavailabilities 
      });
    }

    res.status(200).json({ available: true, message: 'Tickets are available' });
  } catch (error) {
    console.error("Availability verification error:", error);
    res.status(500).json({ message: 'Error verifying tickets', error: error.message, available: false });
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
  getPurchaseById,
  findPurchase,
  testEmail,
  verifyAvailability,
  lockTickets
};

