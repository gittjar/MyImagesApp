const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 32 },
  name: { type: String, required: true, trim: true },
  password: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'subadmin', 'admin'], default: 'user' },
  storageUsed: { type: Number, default: 0 },
  storageQuota: { type: Number, default: 1 * 1024 * 1024 * 1024 }, // 1 GB
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  // Login lockout
  loginAttempts: { type: Number, default: 0 },
  loginLockedUntil: { type: Date, default: null }
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
