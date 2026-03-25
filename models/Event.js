const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  venue: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
  },
  coverPhoto: {
    type: String,
  },
  attendees: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    default: 'Draft',
  },
  artist: {
    type: String,
  },
  location: {
    type: String,
  },
  time: {
    type: String,
  },
  // Detailed Sections
  description: {
    type: String,
  },
  highlights: [String],
  guidelines: [String],
  setTimes: [{
    name: String,
    time: String,
    desc: String,
    tag: String,
    isMain: Boolean
  }],
  capacity: {
    type: String,
  },
  amenities: [String],
  venueAddress: {
    type: String,
  },
  venueMapLink: {
    type: String,
  },
  transportPublic: {
    type: String,
  },
  transportDriving: {
    type: String,
  },
  trailerUrl: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
