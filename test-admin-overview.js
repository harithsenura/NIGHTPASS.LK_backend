const mongoose = require('mongoose');
const User = require('./models/User');
const Event = require('./models/Event');
const TicketPurchase = require('./models/TicketPurchase');
const { getAdminOverview } = require('./controllers/eventController');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");
  
  const req = {};
  const res = {
    status: (code) => ({
      json: (data) => console.log(`Status: ${code}`, JSON.stringify(data, null, 2))
    })
  };
  
  await getAdminOverview(req, res);
  process.exit(0);
}
test();
