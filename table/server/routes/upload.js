const express = require('express');
const multer = require('multer');
const router = express.Router();
const excelParser = require('../utils/excelParser');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload-excel
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const buffer = req.file.buffer;
    const result = excelParser.parseExcelBuffer(buffer);
    res.json({ ok: true, parsed: result });
  } catch (err) {
    console.error('Upload parse error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
