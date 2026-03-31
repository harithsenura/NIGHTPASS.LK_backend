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
    const { 
      title, date, venue, price, image, coverPhoto, attendees, 
      status, artist, location, time, trailerUrl,
      venueAddress, venueMapLink, transportPublic, transportDriving 
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
      transportDriving
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

const getAdminOverview = async (req, res) => {
  try {
    const [totalEvents, registeredUsers, purchaseStats, allEvents] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments(),
      TicketPurchase.aggregate([
        { $match: { status: 'Completed' } },
        { $unwind: { path: "$tickets", preserveNullAndEmptyArrays: true } },
        { 
          $group: {
            _id: "$_id", 
            eventId: { $first: "$eventId" },
            totalAmount: { $first: "$totalAmount" },
            orderTicketsQty: { $sum: "$tickets.qty" }
          }
        },
        {
          $group: {
            _id: "$eventId",
            revenue: { $sum: "$totalAmount" },
            sold: { $sum: "$orderTicketsQty" }
          }
        },
        { $sort: { sold: -1 } }
      ]),
      // Extremely important: Exclude heavy payload fields like image, coverPhoto, trailerUrl
      Event.find().select('title status capacity createdAt').sort({ createdAt: -1 })
    ]);
    
    let totalRevenue = 0;
    let totalTicketsSold = 0;
    let topEventId = null;
    let maxSold = 0;
    const eventStatsMap = {};

    purchaseStats.forEach((stat, index) => {
      totalRevenue += stat.revenue || 0;
      totalTicketsSold += stat.sold || 0;
      
      if (stat._id) {
        eventStatsMap[stat._id.toString()] = {
          sold: stat.sold,
          revenue: stat.revenue
        };
      }

      if (index === 0 && stat._id && stat.sold > 0) {
        topEventId = stat._id.toString();
        maxSold = stat.sold;
      }
    });

    let topEventData = null;
    if (topEventId) {
      const topEvt = allEvents.find(e => e._id.toString() === topEventId);
      if (topEvt) {
        topEventData = {
          name: topEvt.title,
          sold: maxSold
        };
      }
    }

    const eventsList = allEvents.map(evt => {
      const id = evt._id.toString();
      const st = eventStatsMap[id] || { sold: 0, revenue: 0 };
      
      let tot = 1000; // Default capacity
      if (evt.capacity) {
        const parsed = parseInt(String(evt.capacity).replace(/\D/g, ''));
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
