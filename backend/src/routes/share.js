const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateJWT } = require('../middleware/auth');
const {
  createShare,
  getShareInfo,
  getShareImages,
  downloadSharedFolderZip,
  listShares,
  revealSharePin,
  deleteShare
} = require('../controllers/shareController');

const router = express.Router();

// Stricter limiter for public share endpoints — prevents slug brute-force
const shareLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Authenticated
router.get('/', authenticateJWT, listShares);
router.get('/item/:id/pin', authenticateJWT, revealSharePin);
router.get('/:slug/pin', authenticateJWT, revealSharePin);
router.post('/', authenticateJWT, createShare);
router.delete('/item/:id', authenticateJWT, deleteShare);
router.delete('/:slug', authenticateJWT, deleteShare);

// Public (no JWT needed) — route: /share/:userId/:slug
router.get('/:userId/:slug', shareLimiter, getShareInfo);
router.post('/:userId/:slug/images', shareLimiter, getShareImages);
router.post('/:userId/:slug/download-folder', shareLimiter, downloadSharedFolderZip);

module.exports = router;
