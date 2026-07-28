const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = require('../utils/publicDir');
const circuitImagesDir = path.join(publicDir, 'media', 'circuitos', 'fotos');
const circuitLayoutsDir = path.join(publicDir, 'media', 'circuitos', 'trazados');
const allowedExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetDir = file.fieldname === 'trazado' ? circuitLayoutsDir : circuitImagesDir;

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

  if (file.fieldname === 'trazado' && extension !== '.png') {
    cb(new Error('El trazado debe ser PNG'));
    return;
  }

  if (!allowedExtensions.has(extension)) {
    cb(new Error('La imagen debe ser AVIF, WEBP, JPG o PNG'));
    return;
  }

  cb(null, true);
};

const uploadCircuitImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadCircuitImage;
