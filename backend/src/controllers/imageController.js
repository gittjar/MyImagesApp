const sharp = require('sharp');
const heicConvert = require('heic-convert');
const exifr = require('exifr');
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

const reverseGeocode = async (lat, lon) => {
  const key = process.env.GOOGLE_GEOCODING_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${key}&language=fi&result_type=locality|administrative_area_level_1|country`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const comps = data.results[0].address_components;
    const locality = comps.find(c => c.types.includes('locality'))?.long_name;
    const area = comps.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
    const country = comps.find(c => c.types.includes('country'))?.long_name;
    const parts = [locality || area, country].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  } catch (e) {
    console.warn('[Geocoding error]', e.message);
    return null;
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const userId = req.user._id.toString();
    let buffer = req.file.buffer;
    let mimetype = req.file.mimetype;
    let uploadExt = getExt(req.file.originalname);
    let mediaType = 'image';
    let width, height;

    // Extract EXIF from original buffer before conversion strips metadata
    let exifData = null;
    if (!isVideoFile(req.file)) {
      try {
        const raw = await exifr.parse(req.file.buffer, {
          tiff: true, exif: true, gps: true, ifd1: false,
          mergeOutput: true, reviveValues: true, translateValues: false,
          sanitize: true
        });
        if (raw) {
          console.log('[EXIF raw keys]', Object.keys(raw));
          const picks = [
            'Make', 'Model', 'LensMake', 'LensModel',
            'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
            'FocalLengthIn35mmFormat', 'ExposureBiasValue',
            'ExposureProgram', 'MeteringMode', 'WhiteBalance',
            'SceneCaptureType', 'Flash', 'Orientation',
            'DateTimeOriginal', 'OffsetTimeOriginal',
            'latitude', 'longitude', 'GPSAltitude', 'GPSSpeed',
            'GPSImgDirection', 'GPSHPositioningError'
          ];
          exifData = {};
          picks.forEach(k => { if (raw[k] !== undefined && raw[k] !== null) exifData[k] = raw[k]; });
          if (!Object.keys(exifData).length) exifData = null;
        }
      } catch (e) {
        console.warn('[EXIF parse error]', e.message);
      }
    }

    // Reverse geocode GPS coordinates if present
    if (exifData?.latitude !== undefined && exifData?.longitude !== undefined) {
      const locationName = await reverseGeocode(exifData.latitude, exifData.longitude);
      if (locationName) exifData.locationName = locationName;
    }

    // Convert HEIC/HEIF → JPEG (sharp's prebuilt libvips only supports AVIF, not HEIC)
    if (isHeic(req.file)) {
      buffer = Buffer.from(
        await heicConvert({ buffer, format: 'JPEG', quality: 0.9 })
      );
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
      exif: exifData,
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
      Image.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
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

const reorderImages = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'ids array required' });
    }
    const ops = ids.map((id, i) => ({
      updateOne: {
        filter: { _id: id, user: req.user._id },
        update: { $set: { order: i + 1 } }
      }
    }));
    await Image.bulkWrite(ops);
    res.json({ message: 'Reordered' });
  } catch (err) {
    console.error('reorderImages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { uploadImage, getImages, deleteImage, updateImage, reorderImages };
