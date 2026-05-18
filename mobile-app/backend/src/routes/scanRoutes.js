const router = require('express').Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/imageUpload');
const {
	listScans,
	createScan,
	getScanById,
	updatePatientNotes,
	getPreviousFeatures,
	uploadScanImage,
} = require('../controllers/scanController');

router.use(protect);
router.get('/', listScans);
router.post('/', createScan);
router.post('/upload', upload.single('image'), uploadScanImage);
router.get('/:scanId', getScanById);
router.patch('/:scanId/patient-notes', updatePatientNotes);
router.get('/group/:trackingGroupId/previous-features', getPreviousFeatures);

module.exports = router;
