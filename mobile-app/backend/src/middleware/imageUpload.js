const multer = require('multer');
const path = require('path');

// Configure multer for in-memory image uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Only accept image files
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

module.exports = upload;
