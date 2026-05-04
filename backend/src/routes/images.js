const express = require('express');
const multer = require('multer');
const { authenticateJWT } = require('../middleware/auth');
const { uploadImage, getImages, deleteImage, updateImage, reorderImages } = require('../controllers/imageController');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'
]);
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-matroska', 'video/x-msvideo'
]);
const HEIC_VIDEO_EXTS = new Set(['heic', 'heif', 'mp4', 'webm', 'mov', 'avi', 'mkv']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB (supports videos)
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype) || ALLOWED_VIDEO_TYPES.has(file.mimetype) || HEIC_VIDEO_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: JPEG, PNG, GIF, WEBP, HEIC, MP4, WEBM, MOV, AVI, MKV'), false);
    }
  }
});

router.use(authenticateJWT);

router.post('/upload', upload.single('image'), uploadImage);
router.get('/', getImages);
router.patch('/reorder', reorderImages);
router.patch('/:id', updateImage);
router.delete('/:id', deleteImage);

module.exports = router;
