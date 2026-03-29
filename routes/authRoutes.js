const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { signUp, signIn, googleLogin, logout } = require('../controllers/authController');
const validate = require('../middleware/validate');
const { signupSchema, signinSchema } = require('../utils/schemas');

// Rate limiter for authentication routes (6 attempts per 10 minutes)
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 6, 
  standardHeaders: true, 
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      message: 'Too many failed login attempts. Please wait for 10 minutes.',
      resetTime: req.rateLimit.resetTime.getTime()
    });
  }
});

router.post('/signup', loginLimiter, validate(signupSchema), signUp);
router.post('/signin', loginLimiter, validate(signinSchema), signIn);
router.post('/google-login', googleLogin);
router.post('/logout', logout);

module.exports = router;
