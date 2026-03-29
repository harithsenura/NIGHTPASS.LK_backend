const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { signUp, signIn, googleLogin, logout } = require('../controllers/authController');

// Rate limiter for authentication routes (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.post('/signup', loginLimiter, signUp);
router.post('/signin', loginLimiter, signIn);
router.post('/google-login', googleLogin);
router.post('/logout', logout);

module.exports = router;
