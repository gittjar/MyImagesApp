const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateJWT } = require('../middleware/auth');
const {
  createShare,
  getShareInfo,
  getShareImages,
  listShares,
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

// Public (no JWT needed) — route: /share/:userId/:slug
router.get('/:userId/:slug', shareLimiter, getShareInfo);
router.post('/:userId/:slug/images', shareLimiter, getShareImages);

// Authenticated
router.use(authenticateJWT);
router.get('/', listShares);
router.post('/', createShare);
router.delete('/:slug', deleteShare);

module.exports = router;
