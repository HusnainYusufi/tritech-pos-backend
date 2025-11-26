'use strict';

const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ok = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (ok.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx')) {
    return cb(null, true);
  }
  cb(new Error('Only CSV or XLSX files are allowed'));
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
