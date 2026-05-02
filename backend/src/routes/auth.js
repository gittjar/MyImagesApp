const express = require('express');
const passport = require('passport');
const { register, login, googleCallback, getMe } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// Local auth
router.post('/register', register);
router.post(
  '/login',
  passport.authenticate('local', { session: false }),
  login
);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
  }),
  googleCallback
);

// Protected
router.get('/me', authenticateJWT, getMe);

module.exports = router;
