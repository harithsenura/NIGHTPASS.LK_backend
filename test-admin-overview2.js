require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Event = require('./models/Event');
const TicketPurchase = require('./models/TicketPurchase');
const { getAdminOverview } = require('./controllers/eventController');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Test the specific aggregation pipeline
    const purchases = await TicketPurchase.aggregate([
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
    ]);
    console.log("Purchase stats:", purchases);

    const req = {};
    const res = {
      status: (code) => {
        return {
          json: (data) => console.log('API RESPONSE', code, JSON.stringify(data, null, 2))
        }
      }
    };
    await getAdminOverview(req, res);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    process.exit(0);
  }
}
test();
