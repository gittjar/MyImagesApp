const express = require('express');
const passport = require('passport');
const { register, login, googleCallback, getMe } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// Local auth
router.post('/register', register);
router.post(
  '/login',
  (req, res, next) => {
    // passport-local needs the field called 'identifier' (configured in passport.js)
    passport.authenticate('local', { session: false }, (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      req.user = user;
      next();
    })(req, res, next);
  },
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
