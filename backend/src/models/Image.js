const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  blobName: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Image', imageSchema);
