const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = require('../utils/publicDir');
const replayDir = path.join(publicDir, 'media', 'replays');
const allowedExtensions = new Set(['.vcr', '.rpl', '.replay', '.acreplay', '.zip', '.rar', '.7z']);
const maximumSizeMb = Math.max(1, Number(process.env.REPLAY_MAX_FILE_MB) || 500);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(replayDir, { recursive: true });
    cb(null, replayDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${extension}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: maximumSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      cb(new Error('Formato de replay no permitido. Usá VCR, RPL, REPLAY, ACREPLAY, ZIP, RAR o 7Z.'));
      return;
    }
    cb(null, true);
  },
});
