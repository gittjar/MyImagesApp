const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // User-defined URL slug — unique per owner, e.g. /share/:ownerId/:slug
  slug: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, default: '' },
  // 'all' = all owner's media, 'folder' = one folder, 'selection' = specific images
  scope: { type: String, enum: ['all', 'folder', 'selection'], default: 'all' },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }],
  pinHash: { type: String, default: null },
  pinCipher: { type: String, default: null },
  pinFailedAttempts: { type: Number, default: 0 },
  pinLockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// slug is unique per owner, not globally
shareSchema.index({ owner: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Share', shareSchema);
