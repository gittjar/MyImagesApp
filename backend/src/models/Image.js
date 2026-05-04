const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  blobName: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  width: { type: Number },
  height: { type: Number },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  exif: { type: mongoose.Schema.Types.Mixed, default: null },
  order: { type: Number, default: 0 }
});

module.exports = mongoose.model('Image', imageSchema);
