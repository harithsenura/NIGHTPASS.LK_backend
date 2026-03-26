const express = require('express');
const router = express.Router();
const { signUp, signIn, googleLogin } = require('../controllers/authController');

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/google-login', googleLogin);

module.exports = router;
