require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const listAllUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({}).select('name email isAdmin');
        console.log('Total Users Found:', users.length);
        users.forEach(user => {
            console.log(`- Name: ${user.name}, Email: ${user.email}, Admin: ${user.isAdmin}`);
        });
        process.exit();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

listAllUsers();
