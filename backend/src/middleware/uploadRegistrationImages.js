const path = require('path');
const multer = require('multer');

const allowedExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);
const allowedMimeTypes = new Set(['image/avif', 'image/webp', 'image/jpeg', 'image/png']);

const uploadRegistrationImages = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Las fotos deben ser AVIF, WEBP, JPG o PNG'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10,
  },
});

module.exports = uploadRegistrationImages;
