const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../middleware/admin');
const { getUsers, updateUser, deleteUser, getStats } = require('../controllers/adminController');

const router = express.Router();

router.use(authenticateJWT, requireAdmin);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', requireSuperAdmin, deleteUser);

module.exports = router;
