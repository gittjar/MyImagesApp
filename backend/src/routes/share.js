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

// Public (no JWT needed)
router.get('/:token', getShareInfo);
router.post('/:token/images', getShareImages);

// Authenticated
router.use(authenticateJWT);
router.get('/', listShares);
router.post('/', createShare);
router.delete('/:token', deleteShare);

module.exports = router;
