const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
	listScans,
	createScan,
	getScanById,
	updatePatientNotes,
	getPreviousFeatures,
} = require('../controllers/scanController');

router.use(protect);
router.get('/', listScans);
router.post('/', createScan);
router.get('/:scanId', getScanById);
router.patch('/:scanId/patient-notes', updatePatientNotes);
router.get('/group/:trackingGroupId/previous-features', getPreviousFeatures);

module.exports = router;
