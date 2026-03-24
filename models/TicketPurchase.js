const mongoose = require('mongoose');

const ticketPurchaseSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  guestInfo: {
    name: String,
    email: String,
    phone: String,
    nicOrPassport: String
  },
  tickets: [{
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true
    },
    name: String,
    price: Number,
    qty: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    default: 'Completed'
  }
}, { timestamps: true });

module.exports = mongoose.model('TicketPurchase', ticketPurchaseSchema);
