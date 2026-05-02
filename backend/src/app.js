const express = require('express');
const cors = require('cors');
const passport = require('passport');
const connectDB = require('./config/database');
require('./config/passport');

const authRoutes = require('./routes/auth');
const imageRoutes = require('./routes/images');

const app = express();

connectDB();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
