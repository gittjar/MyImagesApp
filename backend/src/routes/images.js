const express = require('express');
const multer = require('multer');
const { authenticateJWT } = require('../middleware/auth');
const { uploadImage, getImages, deleteImage, updateImage } = require('../controllers/imageController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WEBP)'), false);
    }
  }
});

router.use(authenticateJWT);

router.post('/upload', upload.single('image'), uploadImage);
router.get('/', getImages);
router.patch('/:id', updateImage);
router.delete('/:id', deleteImage);

module.exports = router;
