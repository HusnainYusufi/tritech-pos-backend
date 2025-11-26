'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const multer = require('multer');

/* Ensure uploads directory exists */
const rootDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(rootDir, { recursive: true });

/* Storage engine */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, rootDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  }
});

/* Accept only images */
const fileFilter = (_req, file, cb) => {
  if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, or WEBP images allowed'));
};

/* Base Multer instance (avatar ≤2 MB) */
const upload       = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter });
const avatarUpload = upload.single('profilePicture');

/* Portfolio helper (each ≤5 MB, max 10) */
const portfolioUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter
}).array('portfolio', 10);

/* ONE helper that knows both fields */
const profileUpload = upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'portfolio',      maxCount: 10 }
]);

module.exports = Object.assign(upload, {
  avatarUpload,
  portfolioUpload,
  profileUpload
});
