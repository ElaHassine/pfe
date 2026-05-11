const express = require('express');
const multer = require('multer');
const path = require('path');

const upload = multer({ dest: path.join(__dirname, '..', '..', 'uploads', 'speech') });
const { transcribe } = require('../controllers/speechController');

const router = express.Router();

router.post('/', upload.single('file'), transcribe);

module.exports = router;
