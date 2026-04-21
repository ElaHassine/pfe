const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { listDoctors, listArticles, getRiskHistory, analyze, analyzeWithGradCAM } = require('../controllers/catalogController');
const upload = require('../middleware/imageUpload');

router.get('/doctors', listDoctors);
router.get('/articles', listArticles);
router.get('/analysis/analyze', protect, analyze);
router.post('/analysis/gradcam', protect, upload.single('image'), analyzeWithGradCAM);
router.get('/risk-history', protect, getRiskHistory);

module.exports = router;
