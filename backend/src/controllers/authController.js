const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory registration IP rate limiter: { ip -> [{ts}] }
const regIpMap = new Map();
const REG_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REG_MAX = 10;

const checkRegIpLimit = (ip) => {
  const now = Date.now();
  const times = (regIpMap.get(ip) || []).filter(t => now - t < REG_WINDOW_MS);
  if (times.length >= REG_MAX) return false;
  times.push(now);
  regIpMap.set(ip, times);
  return true;
};

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and contain at least one uppercase letter, one number, and one special character'
      });
    }

    if (username && !USERNAME_RE.test(username)) {
      return res.status(400).json({ message: 'Username may only contain letters, numbers, underscores, dots and hyphens (3–32 chars)' });
    }

    // IP rate limit for registrations
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!checkRegIpLimit(ip)) {
      return res.status(429).json({ message: 'Too many registrations from this IP. Try again in 1 hour.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    if (username) {
      const existingUsername = await User.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        return res.status(409).json({ message: 'Username already taken' });
      }
    }

    const user = await User.create({
      name,
      email,
      username: username ? username.toLowerCase() : undefined,
      password
    });
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, username: user.username, avatar: user.avatar, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    await req.user.updateOne({ lastLoginAt: new Date() });
    const token = generateToken(req.user._id);
    res.json({
      token,
      user: { id: req.user._id, name: req.user.name, email: req.user.email, username: req.user.username, avatar: req.user.avatar, role: req.user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const googleCallback = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};

const getMe = async (req, res) => {
  res.json({
    user: { id: req.user._id, name: req.user.name, email: req.user.email, username: req.user.username, avatar: req.user.avatar, role: req.user.role }
  });
};

module.exports = { register, login, googleCallback, getMe };
