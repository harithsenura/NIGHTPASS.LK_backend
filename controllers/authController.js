const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sanitizeInput } = require('../utils/sanitize');

// Helper function to set JWT in cookie
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    secure: true, // Always true to support sameSite: 'none'
    sameSite: 'none', // Required for cross-site requests (e.g. Railway to nightpass.lk)
    // Removed domain restriction to allow browser to handle it based on origin
  };
  res.cookie('token', token, cookieOptions);
};

const signUp = async (req, res) => {
  try {
    let { name, email, password } = req.body;
    email = email.toLowerCase().trim();
    
    // Sanitize user name
    const sanitizedName = sanitizeInput(name);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      name: sanitizedName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Generate token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set cookie
    setTokenCookie(res, token);

    res.status(201).json({
      token, // Include token in response body
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong on the server', error: error.message });
  }
};

const signIn = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set cookie
    setTokenCookie(res, token);

    res.status(200).json({
      token, // Include token in response body
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong on the server', error: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    let { email, name } = req.body;
    email = email.toLowerCase().trim();
    
    // Sanitize user name from Google
    const sanitizedName = sanitizeInput(name);

    // Check if user exists
    let user = await User.findOne({ email }).lean();

    if (!user) {
      // Create new user if not exists
      const randomPassword = Math.random().toString(36).slice(-10);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({
        name: sanitizedName,
        email,
        password: hashedPassword,
      });

      await user.save();
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set cookie
    setTokenCookie(res, token);

    res.status(200).json({
      token, // Include token in response body
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong on the server', error: error.message });
  }
};

const logout = async (req, res) => {
  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

module.exports = { signUp, signIn, googleLogin, logout };
