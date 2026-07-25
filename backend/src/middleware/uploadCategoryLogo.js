const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = path.resolve(__dirname, '../../../frontend/public');
const categoryLogosDir = path.join(publicDir, 'media', 'categorias', 'logos');
const allowedExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(categoryLogosDir, { recursive: true });
    cb(null, categoryLogosDir);
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
    cb(new Error('El logo debe ser AVIF, WEBP, JPG o PNG'));
    return;
  }

  cb(null, true);
};

const uploadCategoryLogo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadCategoryLogo;
