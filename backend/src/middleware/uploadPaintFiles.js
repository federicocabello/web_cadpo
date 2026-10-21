const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsRoot = process.env.PRIVATE_UPLOADS_DIR
  ? path.resolve(process.env.PRIVATE_UPLOADS_DIR)
  : path.resolve(__dirname, '../../storage');
const paintDir = path.join(uploadsRoot, 'pinturas');
const allowedExtensions = new Set(['.dds', '.png', '.jpg', '.jpeg']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(paintDir, { recursive: true });
    cb(null, paintDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`);
  },
});

const uploadPaintFiles = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      cb(new Error('Solo se permiten archivos DDS, PNG y JPG.'));
      return;
    }
    cb(null, true);
  },
});

uploadPaintFiles.paintDir = paintDir;
uploadPaintFiles.cleanupFiles = files => Promise.all((files || []).map(file => fs.promises.unlink(file.path).catch(error => {
  if (error.code !== 'ENOENT') throw error;
})));

module.exports = uploadPaintFiles;
