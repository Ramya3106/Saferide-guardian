const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${path.extname(file.originalname)}`;
    cb(null, safe);
  }
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/uploads - single file upload
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    return res.status(201).json({ message: 'File uploaded', url, filename: req.file.filename });
  } catch (e) {
    console.error('Upload error:', e.message);
    return res.status(500).json({ message: 'Upload failed', error: e.message });
  }
});

module.exports = router;
