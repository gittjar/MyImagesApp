const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            user.googleId = profile.id;
            if (!user.avatar) user.avatar = profile.photos[0]?.value;
            await user.save();
          } else {
            user = await User.create({
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              avatar: profile.photos[0]?.value
            });
          }
        }

        if (!user.isActive) return done(null, false, { message: 'Account is disabled' });

        user.lastLoginAt = new Date();
        await user.save();

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.use(
  new LocalStrategy({ usernameField: 'identifier' }, async (identifier, password, done) => {
    try {
      const normalized = identifier.trim().toLowerCase();
      // Accept email or username
      const user = await User.findOne({
        $or: [{ email: normalized }, { username: normalized }]
      });
      if (!user) return done(null, false, { message: 'Invalid credentials' });
      if (!user.isActive) return done(null, false, { message: 'Account is disabled' });
      if (!user.password) return done(null, false, { message: 'Please sign in with Google' });

      // Check lockout
      if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
        const mins = Math.ceil((user.loginLockedUntil - Date.now()) / 60000);
        return done(null, false, { message: `Account locked. Try again in ${mins} minute(s).` });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        const attempts = (user.loginAttempts || 0) + 1;
        const update = { loginAttempts: attempts };
        if (attempts >= 10) {
          update.loginLockedUntil = new Date(Date.now() + 60 * 60 * 1000);
          update.loginAttempts = 0;
        }
        await user.updateOne(update);
        const remaining = 10 - attempts;
        const msg = attempts >= 10
          ? 'Too many failed attempts. Account locked for 1 hour.'
          : `Invalid credentials. ${remaining} attempt(s) remaining before lockout.`;
        return done(null, false, { message: msg });
      }

      // Success — reset attempts
      if (user.loginAttempts > 0 || user.loginLockedUntil) {
        await user.updateOne({ loginAttempts: 0, loginLockedUntil: null });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);
