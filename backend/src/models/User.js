const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  password: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'subadmin', 'admin'], default: 'user' },
  storageUsed: { type: Number, default: 0 },  // bytes
  storageQuota: { type: Number, default: 1 * 1024 * 1024 * 1024 }, // 1 GB
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
