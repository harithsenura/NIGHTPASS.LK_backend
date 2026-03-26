const Event = require('../models/Event');
const User = require('../models/User');
const TicketPurchase = require('../models/TicketPurchase');

// Get all events (exclude large fields for fast loading)
const getEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .select('-trailerUrl')
      .sort({ createdAt: -1 });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
};

// Get single event by ID
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .select('-trailerUrl');
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
    const { title, date, venue, price, image, coverPhoto, attendees, status, artist, location, time, trailerUrl } = req.body;
    
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
      trailerUrl
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ message: 'Error creating event', error: error.message });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!updatedEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
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
      const topEventObj = await Event.findById(topEventId);
      if (topEventObj) {
        topEventData = {
          name: topEventObj.title,
          sold: maxSold
        };
      }
    }

    // Get all events to construct the events list
    const allEvents = await Event.find().sort({ createdAt: -1 });
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
        revenue: st.revenue
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

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  getAdminOverview
};
