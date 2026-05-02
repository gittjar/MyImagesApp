const mongoose = require('mongoose');
const crypto = require('crypto');

const shareSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, unique: true, default: () => crypto.randomBytes(16).toString('hex') },
  title: { type: String, default: '' },
  // If empty, share ALL owner's images
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }],
  // PIN stored as 4–8 digit string (hashed with bcrypt in controller)
  pinHash: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Share', shareSchema);
