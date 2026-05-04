const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }
}, { timestamps: true });

// Unique name within the same parent (drop old 'user_1_name_1' index in Atlas if upgrading)
folderSchema.index({ user: 1, parent: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);
