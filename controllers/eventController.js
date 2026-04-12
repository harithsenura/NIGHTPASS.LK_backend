const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketPurchase = require('../models/TicketPurchase');

// Get all events (exclude large fields for fast loading)
const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .select('title date venue location price category status createdAt trailerUrl')
      .sort({ createdAt: -1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);
    if (!deletedEvent) return res.status(404).json({ message: 'Event not found' });
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
};

// Get single event by ID
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event', error: error.message });
  }
};

// Create a new event
const createEvent = async (req, res) => {
  try {
    const { 
      title, date, venue, price, image, coverPhoto, attendees, 
      status, artist, location, time, trailerUrl,
      venueAddress, venueMapLink, transportPublic, transportDriving,
      artists, tickets
    } = req.body;
    
    const newEvent = new Event({
      title,
      date,
      venue,
      price,
      image,
      coverPhoto,
      attendees,
      status,
      artist,
      location,
      time,
      trailerUrl,
      venueAddress,
      venueMapLink,
      transportPublic,
      transportDriving,
      artists,
      organizer: req.user ? req.user._id : undefined
    });

    await newEvent.save();

    // Create tickets parallelly if provided
    if (tickets && Array.isArray(tickets)) {
      console.log(`[CREATE EVENT] Saving ${tickets.length} tickets for event ${newEvent._id}`);
      await Promise.all(tickets.map(async (t) => {
        try {
          await new Ticket({
            eventId: newEvent._id,
            name: t.name,
            price: Number(t.price) || 0,
            quantity: Number(t.quantity) || 0,
            customStatus: t.customStatus || ''
          }).save();
        } catch (ticketErr) {
          console.error(`[CREATE EVENT] Failed to save ticket ${t.name}:`, ticketErr.message);
        }
      }));
    }

    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ message: 'Error creating event', error: error.message });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const { tickets, ...restBody } = req.body;
    const updateData = { ...restBody };

    // Transform highlights/guidelines from [{text, icon}] objects to plain strings
    if (updateData.highlights && Array.isArray(updateData.highlights)) {
      updateData.highlights = updateData.highlights.map(h => 
        typeof h === 'object' && h.text !== undefined ? h.text : h
      );
    }
    if (updateData.guidelines && Array.isArray(updateData.guidelines)) {
      updateData.guidelines = updateData.guidelines.map(g => 
        typeof g === 'object' && g.text !== undefined ? g.text : g
      );
    }

    // 1. Update main event document (without tickets in the $set object)
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // 2. Sync tickets if provided
    if (tickets && Array.isArray(tickets)) {
      console.log(`[UPDATE EVENT] Syncing ${tickets.length} tickets for event ${req.params.id}`);
      const incomingTicketNames = tickets.map(t => t.name);
      const eventObjectId = new mongoose.Types.ObjectId(req.params.id);
      
      try {
        // First delete old tickets sequentially (safer for synchronization)
        const deleteRes = await Ticket.deleteMany({
          eventId: eventObjectId,
          name: { $nin: incomingTicketNames },
          sold: 0
        });
        console.log(`[UPDATE EVENT] Deleted ${deleteRes.deletedCount} old tickets`);

        // Parallelize upserting of incoming tickets
        await Promise.all(tickets.map(async (t) => {
          await Ticket.findOneAndUpdate(
            { eventId: eventObjectId, name: t.name },
            { 
              $set: { 
                price: Number(t.price) || 0, 
                quantity: Number(t.quantity) || 0,
                customStatus: t.customStatus || ''
              } 
            },
            { upsert: true, new: true }
          );
        }));
        
        console.log(`[UPDATE EVENT] Successfully synced all tickets parallelly`);
      } catch (syncErr) {
        console.error(`[UPDATE EVENT] Ticket sync error:`, syncErr.message);
      }
    }
    
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
};

// Get just the image for a specific event (lightweight endpoint for lazy loading)
const getEventImage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select('image').lean();
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json({ image: event.image || '' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching event image', error: error.message });
  }
};

// Get admin overview data
const getAdminOverview = async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const registeredUsers = await User.countDocuments();
    
    // Aggregate for total revenue and tickets sold
    const purchases = await TicketPurchase.find({ status: 'Completed' });
    let totalRevenue = 0;
    let totalTicketsSold = 0;
    
    const eventStatsMap = {}; // eventId -> { sold, revenue }

    purchases.forEach(p => {
      totalRevenue += (p.totalAmount || 0);
      
      let purchaseTickets = 0;
      if (p.tickets && Array.isArray(p.tickets)) {
        p.tickets.forEach(t => {
          purchaseTickets += (t.qty || 0);
        });
      }
      totalTicketsSold += purchaseTickets;
      
      if (p.eventId) {
        const evtId = p.eventId.toString();
        if (!eventStatsMap[evtId]) {
          eventStatsMap[evtId] = { sold: 0, revenue: 0 };
        }
        eventStatsMap[evtId].sold += purchaseTickets;
        eventStatsMap[evtId].revenue += (p.totalAmount || 0);
      }
    });

    // Find top event
    let topEventId = null;
    let maxSold = -1;
    for (const [evtId, stats] of Object.entries(eventStatsMap)) {
      if (stats.sold > maxSold) {
        maxSold = stats.sold;
        topEventId = evtId;
      }
    }
    
    let topEventData = null;
    if (topEventId) {
      const topEventObj = await Event.findById(topEventId).select('title');
      if (topEventObj) {
        topEventData = {
          name: topEventObj.title,
          sold: maxSold
        };
      }
    }

    // Get all events to construct the events list
    const allEvents = await Event.find()
      .select('title status capacity organizer')
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });
    const eventsList = allEvents.map(evt => {
      const id = evt._id.toString();
      const st = eventStatsMap[id] || { sold: 0, revenue: 0 };
      
      let tot = 1000; // Default capacity
      if (evt.capacity) {
        let parsed = parseInt(evt.capacity.replace(/\D/g, ''));
        if (!isNaN(parsed) && parsed > 0) tot = parsed;
      }
      
      return {
        _id: id,
        name: evt.title,
        status: evt.status,
        sold: st.sold,
        total: tot,
        revenue: st.revenue,
        organizerName: evt.organizer ? evt.organizer.name : 'Unknown',
        organizerEmail: evt.organizer ? evt.organizer.email : ''
      };
    });

    res.status(200).json({
      totalEvents,
      registeredUsers,
      ticketsSold: totalTicketsSold,
      revenue: totalRevenue,
      topEvent: topEventData,
      events: eventsList
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin overview', error: error.message });
  }
};

// Get events created by the current logged-in organizer
const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user._id })
      .sort({ createdAt: -1 })
      .limit(1); // Only send latest to save bandwidth
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your events', error: error.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getAdminOverview,
  getEventImage,
  getMyEvents
};
