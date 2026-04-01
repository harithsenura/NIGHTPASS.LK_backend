require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const findAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const admins = await User.find({ isAdmin: true }).select('name email');
        console.log('Admin Users Found:');
        admins.forEach(admin => {
            console.log(`- Name: ${admin.name}, Email: ${admin.email}`);
        });
        process.exit();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

findAdmins();
