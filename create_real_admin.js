require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const email = 'admin@gmail.com';
        const password = 'admin';

        let user = await User.findOne({ email });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        if (user) {
            user.password = hashedPassword;
            user.isAdmin = true;
            await user.save();
            console.log('Admin user updated');
        } else {
            user = new User({
                name: 'System Admin',
                email: email,
                password: hashedPassword,
                isAdmin: true,
            });
            await user.save();
            console.log('Admin user created');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createAdmin();
