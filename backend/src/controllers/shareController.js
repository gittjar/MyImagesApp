const bcrypt = require('bcryptjs');
const Share = require('../models/Share');
const Image = require('../models/Image');

// POST /api/share — create a share link (authenticated)
const createShare = async (req, res) => {
  try {
    const { title, imageIds, pin, expiresInDays } = req.body;

    const shareData = {
      owner: req.user._id,
      title: title || '',
      images: Array.isArray(imageIds) && imageIds.length > 0 ? imageIds : []
    };

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
      token: share.token,
      url: `${process.env.FRONTEND_URL}/share/${share.token}`,
      hasPin: !!pin,
      expiresAt: share.expiresAt
    });
  } catch (err) {
    console.error('Create share error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/share/:token — get share metadata (does it need a PIN?)
const getShareInfo = async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share) return res.status(404).json({ message: 'Share link not found' });

    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ message: 'This share link has expired' });
    }

    res.json({
      title: share.title,
      hasPin: !!share.pinHash,
      expiresAt: share.expiresAt
    });
  } catch (err) {
    console.error('Get share info error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/share/:token/images — verify PIN (if required) and return images
const getShareImages = async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
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
    if (share.images.length > 0) {
      images = await Image.find({ _id: { $in: share.images }, user: share.owner }).sort({ createdAt: -1 });
    } else {
      images = await Image.find({ user: share.owner }).sort({ createdAt: -1 });
    }

    res.json({ title: share.title, images });
  } catch (err) {
    console.error('Get share images error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/share — list current user's share links
const listShares = async (req, res) => {
  try {
    const shares = await Share.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json({
      shares: shares.map((s) => ({
        id: s._id,
        token: s.token,
        title: s.title,
        hasPin: !!s.pinHash,
        imageCount: s.images.length,
        expiresAt: s.expiresAt,
        url: `${process.env.FRONTEND_URL}/share/${s.token}`,
        createdAt: s.createdAt
      }))
    });
  } catch (err) {
    console.error('List shares error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/share/:token — delete a share link
const deleteShare = async (req, res) => {
  try {
    const share = await Share.findOneAndDelete({ token: req.params.token, owner: req.user._id });
    if (!share) return res.status(404).json({ message: 'Share link not found' });
    res.json({ message: 'Share link deleted' });
  } catch (err) {
    console.error('Delete share error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createShare, getShareInfo, getShareImages, listShares, deleteShare };
