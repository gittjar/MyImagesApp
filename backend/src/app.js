const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const connectDB = require('./config/database');
require('./config/passport');

const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');
const shareRoutes = require('./routes/share');
const adminRoutes = require('./routes/admin');
const folderRoutes = require('./routes/folders');

const app = express();

connectDB();

// ── CORS ────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGINS is a comma-separated list in .env, e.g.:
//   ALLOWED_ORIGINS=http://localhost:5173,https://myimages.example.com
// Falls back to FRONTEND_URL for backwards compatibility.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Rate limiters ────────────────────────────────────────────────────────────
// 1. Auth endpoints — tight limit to prevent brute-force login/register attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// 2. Public share endpoints — prevent slug enumeration / brute-force
const shareLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// 3. General API limiter — catch-all safety net for all other routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/images', generalLimiter, imageRoutes);
app.use('/api/share', generalLimiter, shareRoutes);
app.use('/api/admin', generalLimiter, adminRoutes);
app.use('/api/folders', generalLimiter, folderRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
