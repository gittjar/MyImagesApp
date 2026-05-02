const bcrypt = require('bcryptjs');
const Share = require('../models/Share');
const Image = require('../models/Image');
const Folder = require('../models/Folder');

// Sanitize a user-supplied slug: lowercase, replace spaces/invalid chars with '-', trim dashes
const sanitizeSlug = (raw) =>
  String(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// POST /api/share — create a share link (authenticated)
const createShare = async (req, res) => {
  try {
    const { slug: rawSlug, title, scope, folderId, imageIds, pin, expiresInDays } = req.body;

    const slug = sanitizeSlug(rawSlug || '');
    if (!slug) return res.status(400).json({ message: 'A link name (slug) is required' });
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      return res.status(400).json({ message: 'Link name may only contain letters, numbers, hyphens and underscores' });
    }

    // Enforce uniqueness per owner
    const existing = await Share.findOne({ owner: req.user._id, slug });
    if (existing) return res.status(409).json({ message: `You already have a share link named "${slug}"` });

    const validScopes = ['all', 'folder', 'selection'];
    const resolvedScope = validScopes.includes(scope) ? scope : 'all';

    const shareData = {
      owner: req.user._id,
      slug,
      title: title || '',
      scope: resolvedScope
    };

    if (resolvedScope === 'folder') {
      if (!folderId) return res.status(400).json({ message: 'folderId required for scope=folder' });
      const folder = await Folder.findOne({ _id: folderId, user: req.user._id });
      if (!folder) return res.status(404).json({ message: 'Folder not found' });
      shareData.folder = folder._id;
    } else if (resolvedScope === 'selection') {
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ message: 'imageIds required for scope=selection' });
      }
      shareData.images = imageIds;
    }

    if (pin) {
      if (!/^\d{4,8}$/.test(pin)) {
        return res.status(400).json({ message: 'PIN must be 4–8 digits' });
      }
      shareData.pinHash = await bcrypt.hash(pin, 10);
    }

    if (expiresInDays) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiresInDays, 10));
      shareData.expiresAt = d;
    }

    const share = await Share.create(shareData);

    res.status(201).json({
      slug: share.slug,
      url: `${process.env.FRONTEND_URL}/share/${req.user._id}/${share.slug}`,
      hasPin: !!pin,
      expiresAt: share.expiresAt,
      scope: share.scope
    });
  } catch (err) {
    console.error('Create share error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/share/:userId/:slug — get share metadata (public, no auth)
const getShareInfo = async (req, res) => {
  try {
    const share = await Share
      .findOne({ owner: req.params.userId, slug: req.params.slug })
      .populate('folder', 'name');
    if (!share) return res.status(404).json({ message: 'Share link not found' });

    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ message: 'This share link has expired' });
    }

    res.json({
      title: share.title,
      scope: share.scope,
      folderName: share.folder?.name || null,
      hasPin: !!share.pinHash,
      expiresAt: share.expiresAt
    });
  } catch (err) {
    console.error('Get share info error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/share/:userId/:slug/images — verify PIN and return images (public)
const getShareImages = async (req, res) => {
  try {
    const share = await Share.findOne({ owner: req.params.userId, slug: req.params.slug });
    if (!share) return res.status(404).json({ message: 'Share link not found' });

    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ message: 'This share link has expired' });
    }

    if (share.pinHash) {
      const { pin } = req.body;
      if (!pin) return res.status(401).json({ message: 'PIN required', requiresPin: true });
      const valid = await bcrypt.compare(String(pin), share.pinHash);
      if (!valid) return res.status(401).json({ message: 'Incorrect PIN', requiresPin: true });
    }

    let images;
    if (share.scope === 'selection' && share.images.length > 0) {
      images = await Image.find({ _id: { $in: share.images }, user: share.owner }).sort({ createdAt: -1 });
    } else if (share.scope === 'folder' && share.folder) {
      images = await Image.find({ user: share.owner, folder: share.folder }).sort({ createdAt: -1 });
    } else {
      images = await Image.find({ user: share.owner }).sort({ createdAt: -1 });
    }

    res.json({ title: share.title, scope: share.scope, images });
  } catch (err) {
    console.error('Get share images error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/share — list current user's share links (authenticated)
const listShares = async (req, res) => {
  try {
    const shares = await Share.find({ owner: req.user._id }).sort({ createdAt: -1 }).populate('folder', 'name');
    res.json({
      shares: shares.map((s) => ({
        id: s._id,
        slug: s.slug,
        title: s.title,
        scope: s.scope,
        folderName: s.folder?.name || null,
        hasPin: !!s.pinHash,
        imageCount: s.images.length,
        expiresAt: s.expiresAt,
        url: `${process.env.FRONTEND_URL}/share/${req.user._id}/${s.slug}`,
        createdAt: s.createdAt
      }))
    });
  } catch (err) {
    console.error('List shares error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/share/:slug — delete a share link (authenticated)
const deleteShare = async (req, res) => {
  try {
    const share = await Share.findOneAndDelete({ slug: req.params.slug, owner: req.user._id });
    if (!share) return res.status(404).json({ message: 'Share link not found' });
    res.json({ message: 'Share link deleted' });
  } catch (err) {
    console.error('Delete share error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createShare, getShareInfo, getShareImages, listShares, deleteShare };

