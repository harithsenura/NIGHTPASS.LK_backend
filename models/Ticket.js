const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  sold: {
    type: Number,
    default: 0
  },
  lockedQty: {
    type: Number,
    default: 0
  },
  reservations: [{
    purchaseId: String,
    qty: Number,
    expiresAt: Date
  }],
  customStatus: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
