const Image = require('../models/Image');
const User = require('../models/User');
const { uploadToAzure, deleteFromAzure } = require('../config/azure');

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // Quota check
    const user = await User.findById(req.user._id);
    if (user.storageUsed + req.file.size > user.storageQuota) {
      const remaining = user.storageQuota - user.storageUsed;
      return res.status(413).json({
        message: `Storage quota exceeded. You have ${formatBytes(remaining)} remaining.`
      });
    }

    const { url, blobName } = await uploadToAzure(req.file, req.user._id.toString());

    const image = await Image.create({
      user: req.user._id,
      filename: blobName.split('/').pop(),
      originalName: req.file.originalname,
      blobName,
      url,
      size: req.file.size,
      mimetype: req.file.mimetype,
      description: req.body.description || '',
      tags: req.body.tags ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      isPublic: req.body.isPublic === 'true'
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: req.file.size } });

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

    const [images, total, user] = await Promise.all([
      Image.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Image.countDocuments({ user: req.user._id }),
      User.findById(req.user._id).select('storageUsed storageQuota')
    ]);

    res.json({
      images,
      total,
      page,
      pages: Math.ceil(total / limit),
      storageUsed: user.storageUsed,
      storageQuota: user.storageQuota
    });
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

    const { description, tags, isPublic } = req.body;
    if (description !== undefined) image.description = description;
    if (tags !== undefined) image.tags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (isPublic !== undefined) image.isPublic = isPublic;

    await image.save();
    res.json({ image });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
};

module.exports = { uploadImage, getImages, deleteImage, updateImage };
