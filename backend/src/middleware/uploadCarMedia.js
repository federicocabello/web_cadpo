const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = path.resolve(__dirname, '../../../frontend/public');
const carLogosDir = path.join(publicDir, 'media', 'autos', 'logos');
const carImagesDir = path.join(publicDir, 'media', 'autos', 'imagenes');
const allowedExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetDir = file.fieldname === 'logo' ? carLogosDir : carImagesDir;

    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    cb(new Error('La imagen debe ser AVIF, WEBP, JPG o PNG'));
    return;
  }

  cb(null, true);
};

const uploadCarMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

module.exports = uploadCarMedia;
