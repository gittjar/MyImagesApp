const bcrypt = require('bcryptjs');
const archiver = require('archiver');
const crypto = require('crypto');
const Share = require('../models/Share');
const Image = require('../models/Image');
const Folder = require('../models/Folder');

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 60 * 60 * 1000; // 1 hour
const PIN_CIPHER_ALGO = 'aes-256-gcm';

// Sanitize a user-supplied slug: lowercase, replace spaces/invalid chars with '-', trim dashes
const sanitizeSlug = (raw) =>
  String(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const sanitizeFilename = (raw, fallback = 'share') => {
  const cleaned = String(raw || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  return cleaned || fallback;
};

const getPinSecret = () => process.env.SHARE_PIN_SECRET || process.env.JWT_SECRET || '';

const encryptSharePin = (pin) => {
  const secret = getPinSecret();
  if (!secret) return null;
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(PIN_CIPHER_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptSharePin = (cipherText) => {
  if (!cipherText) return null;
  const secret = getPinSecret();
  if (!secret) return null;
  try {
    const [ivB64, tagB64, dataB64] = String(cipherText).split(':');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(PIN_CIPHER_ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (_) {
    return null;
  }
};

const buildOwnedShareLookup = (ownerId, identifier) => {
  if (/^[a-f\d]{24}$/i.test(String(identifier || ''))) {
    return { owner: ownerId, $or: [{ _id: identifier }, { slug: identifier }] };
  }
  return { owner: ownerId, slug: identifier };
};

const getShareImagesQueryResult = async (share) => {
  if (share.scope === 'selection' && share.images.length > 0) {
    return Image.find({ _id: { $in: share.images }, user: share.owner }).sort({ createdAt: -1 });
  }
  if (share.scope === 'folder' && share.folder) {
    return Image.find({ user: share.owner, folder: share.folder }).sort({ createdAt: -1 });
  }
  return Image.find({ user: share.owner }).sort({ createdAt: -1 });
};

const getPinState = (share) => {
  const now = Date.now();
  const lockedUntilMs = share.pinLockedUntil ? new Date(share.pinLockedUntil).getTime() : 0;
  const isLocked = lockedUntilMs > now;
  const attemptsRemaining = Math.max(0, PIN_MAX_ATTEMPTS - (share.pinFailedAttempts || 0));
  return {
    isLocked,
    lockedUntil: isLocked ? new Date(lockedUntilMs) : null,
    attemptsRemaining,
    maxAttempts: PIN_MAX_ATTEMPTS
  };
};

const verifySharePin = async (share, pin) => {
  if (!share.pinHash) return { ok: true };

  const state = getPinState(share);
  if (state.isLocked) {
    return {
      ok: false,
      status: 423,
      payload: {
        message: 'PIN is temporarily locked due to too many failed attempts. Try again later.',
        requiresPin: true,
        pinLocked: true,
        lockedUntil: state.lockedUntil,
        attemptsRemaining: 0,
        maxAttempts: state.maxAttempts
      }
    };
  }

  if (!pin) {
    return {
      ok: false,
      status: 401,
      payload: {
        message: 'PIN required',
        requiresPin: true,
        pinLocked: false,
        attemptsRemaining: state.attemptsRemaining,
        maxAttempts: state.maxAttempts
      }
    };
  }

  const valid = await bcrypt.compare(String(pin), share.pinHash);
  if (valid) {
    if (share.pinFailedAttempts || share.pinLockedUntil) {
      share.pinFailedAttempts = 0;
      share.pinLockedUntil = null;
      await share.save();
    }
    return { ok: true };
  }

  const currentAttempts = share.pinFailedAttempts || 0;
  const nextAttempts = currentAttempts + 1;
  const shouldLock = nextAttempts >= PIN_MAX_ATTEMPTS;
  share.pinFailedAttempts = shouldLock ? PIN_MAX_ATTEMPTS : nextAttempts;
  share.pinLockedUntil = shouldLock ? new Date(Date.now() + PIN_LOCK_MS) : null;
  await share.save();

  if (shouldLock) {
    return {
      ok: false,
      status: 423,
      payload: {
        message: 'PIN locked for 1 hour due to too many failed attempts.',
        requiresPin: true,
        pinLocked: true,
        lockedUntil: share.pinLockedUntil,
        attemptsRemaining: 0,
        maxAttempts: PIN_MAX_ATTEMPTS
      }
    };
  }

  return {
    ok: false,
    status: 401,
    payload: {
      message: 'Incorrect PIN',
      requiresPin: true,
      pinLocked: false,
      attemptsRemaining: PIN_MAX_ATTEMPTS - nextAttempts,
      maxAttempts: PIN_MAX_ATTEMPTS
    }
  };
};

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
      shareData.pinCipher = encryptSharePin(pin);
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

    const pinState = getPinState(share);

    res.json({
      title: share.title,
      scope: share.scope,
      folderName: share.folder?.name || null,
      hasPin: !!share.pinHash,
      expiresAt: share.expiresAt,
      pinLocked: pinState.isLocked,
      pinLockedUntil: pinState.lockedUntil,
      attemptsRemaining: pinState.attemptsRemaining,
      maxAttempts: pinState.maxAttempts
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
      const result = await verifySharePin(share, req.body?.pin);
      if (!result.ok) return res.status(result.status).json(result.payload);
    }

    const images = await getShareImagesQueryResult(share);

    res.json({ title: share.title, scope: share.scope, images });
  } catch (err) {
    console.error('Get share images error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/share/:userId/:slug/download-folder — stream folder share as ZIP (public)
const downloadSharedFolderZip = async (req, res) => {
  try {
    const share = await Share
      .findOne({ owner: req.params.userId, slug: req.params.slug })
      .populate('folder', 'name');
    if (!share) return res.status(404).json({ message: 'Share link not found' });

    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ message: 'This share link has expired' });
    }

    if (share.scope !== 'folder') {
      return res.status(400).json({ message: 'ZIP download is only available for folder shares' });
    }

    if (share.pinHash) {
      const result = await verifySharePin(share, req.body?.pin);
      if (!result.ok) return res.status(result.status).json(result.payload);
    }

    const images = await getShareImagesQueryResult(share);
    if (!images.length) {
      return res.status(404).json({ message: 'No images found in this shared folder' });
    }

    const folderLabel = sanitizeFilename(share.folder?.name || share.title || 'shared-folder');
    const zipName = `${folderLabel}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('ZIP archive error:', err);
      if (!res.headersSent) res.status(500).json({ message: 'Failed to create ZIP' });
    });
    archive.pipe(res);

    let runningIndex = 1;
    for (const img of images) {
      try {
        const response = await fetch(img.url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        const safeName = sanitizeFilename(img.originalName, `image-${runningIndex}`);
        archive.append(Buffer.from(arrayBuffer), { name: safeName });
        runningIndex += 1;
      } catch (fetchErr) {
        console.warn('Skipping ZIP file entry:', fetchErr.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('downloadSharedFolderZip error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Server error' });
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
        canRevealPin: !!s.pinCipher,
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

// GET /api/share/:slug/pin — reveal current user's share PIN (authenticated owner only)
const revealSharePin = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.slug;
    const share = await Share.findOne(buildOwnedShareLookup(req.user._id, identifier));
    if (!share) return res.status(404).json({ message: 'Share link not found' });
    if (!share.pinHash) return res.status(400).json({ message: 'This share does not use a PIN' });

    const pin = decryptSharePin(share.pinCipher);
    if (!pin) {
      return res.status(409).json({
        message: 'PIN cannot be revealed for this share (created before PIN reveal support or missing secret).'
      });
    }

    res.json({ pin });
  } catch (err) {
    console.error('revealSharePin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/share/:slug — delete a share link (authenticated)
const deleteShare = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.slug;
    const share = await Share.findOneAndDelete(buildOwnedShareLookup(req.user._id, identifier));
    if (!share) return res.status(404).json({ message: 'Share link not found' });
    res.json({ message: 'Share link deleted' });
  } catch (err) {
    console.error('Delete share error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createShare, getShareInfo, getShareImages, downloadSharedFolderZip, listShares, revealSharePin, deleteShare };

