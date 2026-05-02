const sharp = require('sharp');
const Image = require('../models/Image');
const Folder = require('../models/Folder');
const User = require('../models/User');
const { uploadToAzure, deleteFromAzure } = require('../config/azure');

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/x-msvideo']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getExt = (filename) => filename.split('.').pop().toLowerCase();

const isHeic = (file) =>
  HEIC_TYPES.has(file.mimetype) || ['heic', 'heif'].includes(getExt(file.originalname));

const isVideoFile = (file) =>
  VIDEO_TYPES.has(file.mimetype) || VIDEO_EXTS.has(getExt(file.originalname));

const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const userId = req.user._id.toString();
    let buffer = req.file.buffer;
    let mimetype = req.file.mimetype;
    let uploadExt = getExt(req.file.originalname);
    let mediaType = 'image';
    let width, height;

    // Convert HEIC/HEIF → JPEG
    if (isHeic(req.file)) {
      buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      mimetype = 'image/jpeg';
      uploadExt = 'jpg';
    } else if (isVideoFile(req.file)) {
      mediaType = 'video';
    }

    const fileSize = buffer.length;

    // Quota check
    const user = await User.findById(req.user._id);
    if (user.storageUsed + fileSize > user.storageQuota) {
      const remaining = user.storageQuota - user.storageUsed;
      return res.status(413).json({
        message: `Storage quota exceeded. You have ${formatBytes(remaining)} remaining.`
      });
    }

    // Extract image dimensions
    if (mediaType === 'image') {
      try {
        const meta = await sharp(buffer).metadata();
        width = meta.width;
        height = meta.height;
      } catch (_) { /* unsupported format, skip */ }
    }

    // Validate folder ownership
    let folderId = req.body.folder || null;
    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, user: req.user._id });
      if (!folder) folderId = null;
    }

    const { url, blobName } = await uploadToAzure(req.file, userId, {
      buffer,
      contentType: mimetype,
      ext: uploadExt
    });

    const image = await Image.create({
      user: req.user._id,
      folder: folderId,
      filename: blobName.split('/').pop(),
      originalName: req.file.originalname,
      blobName,
      url,
      size: fileSize,
      mimetype,
      mediaType,
      width,
      height,
      description: req.body.description || '',
      tags: req.body.tags ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      isPublic: req.body.isPublic === 'true'
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: fileSize } });
    res.status(201).json({ image });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

const getImages = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };
    if (req.query.folder === 'none') {
      query.folder = null;
    } else if (req.query.folder) {
      query.folder = req.query.folder;
    }

    const [images, total, user] = await Promise.all([
      Image.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Image.countDocuments(query),
      User.findById(req.user._id).select('storageUsed storageQuota')
    ]);

    res.json({ images, total, page, pages: Math.ceil(total / limit), storageUsed: user.storageUsed, storageQuota: user.storageQuota });
  } catch (err) {
    console.error('Get images error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteImage = async (req, res) => {
  try {
    const image = await Image.findOne({ _id: req.params.id, user: req.user._id });
    if (!image) return res.status(404).json({ message: 'Image not found' });

    await deleteFromAzure(image.blobName);
    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: -image.size } });
    await image.deleteOne();

    res.json({ message: 'Image deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
};

const updateImage = async (req, res) => {
  try {
    const image = await Image.findOne({ _id: req.params.id, user: req.user._id });
    if (!image) return res.status(404).json({ message: 'Image not found' });

    const { description, tags, isPublic, folder } = req.body;
    if (description !== undefined) image.description = description;
    if (tags !== undefined) image.tags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (isPublic !== undefined) image.isPublic = isPublic;
    if (folder !== undefined) {
      if (!folder) {
        image.folder = null;
      } else {
        const f = await Folder.findOne({ _id: folder, user: req.user._id });
        if (f) image.folder = f._id;
      }
    }

    await image.save();
    res.json({ image });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
};

module.exports = { uploadImage, getImages, deleteImage, updateImage };
