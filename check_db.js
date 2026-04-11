require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./models/Event');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const events = await Event.find({});
  console.log(`Found ${events.length} events`);
  for (const e of events) {
    const title = e.title;
    const imgSize = e.image ? Math.round(e.image.length / 1024) : 0;
    const coverSize = e.coverPhoto ? Math.round(e.coverPhoto.length / 1024) : 0;
    let artistsSize = 0;
    if (e.artists) {
      for (const a of e.artists) {
        if (a.image) artistsSize += Math.round(a.image.length / 1024);
      }
    }
    console.log(`Event: ${title} | Image: ${imgSize}KB | Cover: ${coverSize}KB | Artists: ${artistsSize}KB | Total: ${imgSize+coverSize+artistsSize}KB`);
  }
  process.exit(0);
})();
