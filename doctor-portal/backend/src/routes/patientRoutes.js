const router = require('express').Router();
const { protect, requireSelfOrAdmin } = require('../middleware/auth');
const { getPatientById, getActivity, getLikedPosts, getDashboardSummary } = require('../controllers/patientController');
const { listMyActivity } = require('../controllers/activityController');

router.get('/me/summary', protect, getDashboardSummary);
router.get('/me/activity', protect, listMyActivity);
router.get('/:id', protect, requireSelfOrAdmin('id'), getPatientById);
router.get('/:id/activity', protect, requireSelfOrAdmin('id'), getActivity);
router.get('/:id/liked-posts', protect, requireSelfOrAdmin('id'), getLikedPosts);

module.exports = router;
