const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { getFolders, createFolder, renameFolder, deleteFolder } = require('../controllers/folderController');

const router = express.Router();

router.use(authenticateJWT);

router.get('/', getFolders);
router.post('/', createFolder);
router.patch('/:id', renameFolder);
router.delete('/:id', deleteFolder);

module.exports = router;
