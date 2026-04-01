require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const promoteToAdmin = async (email) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOneAndUpdate(
            { email: email.toLowerCase().trim() },
            { $set: { isAdmin: true } },
            { new: true }
        );
        
        if (user) {
            console.log(`Success! User ${user.name} (${user.email}) is now an Admin.`);
        } else {
            console.log(`Error: User with email ${email} not found.`);
        }
        process.exit();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

const emailToPromote = 'harithdivarathna@gmail.com';
promoteToAdmin(emailToPromote);
