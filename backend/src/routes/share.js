const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const {
  createShare,
  getShareInfo,
  getShareImages,
  listShares,
  deleteShare
} = require('../controllers/shareController');

const router = express.Router();

// Public (no JWT needed) — route: /share/:userId/:slug
router.get('/:userId/:slug', getShareInfo);
router.post('/:userId/:slug/images', getShareImages);

// Authenticated
router.use(authenticateJWT);
router.get('/', listShares);
router.post('/', createShare);
router.delete('/:slug', deleteShare);

module.exports = router;
