const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    res.json({
      token,
      user: { id: req.user._id, name: req.user.name, email: req.user.email, avatar: req.user.avatar }
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
    user: { id: req.user._id, name: req.user.name, email: req.user.email, avatar: req.user.avatar }
  });
};

module.exports = { register, login, googleCallback, getMe };
