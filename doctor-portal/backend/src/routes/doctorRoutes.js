const router = require('express').Router();
const { protectDoctor } = require('../middleware/auth');
const {
	getDashboard,
	listCases,
	getCaseById,
	listPatients,
	getPatientHistory,
	listCommunityPosts,
	getCommunitySummary,
	listNotifications,
	listDoctorReviews,
	listAppointments,
	createAppointment,
	updateAppointmentDetails,
	heartbeatPresence,
	setOfflinePresence,
} = require('../controllers/doctorController');
const { submitScanReview } = require('../controllers/scanReviewController');

router.use(protectDoctor);

router.get('/dashboard', getDashboard);
router.get('/cases', listCases);
router.get('/cases/:id', getCaseById);
router.post('/cases/:scanId/review', submitScanReview);
router.get('/patients', listPatients);
router.get('/patients/:id/history', getPatientHistory);
router.get('/community/posts', listCommunityPosts);
router.get('/community/summary', getCommunitySummary);
router.get('/notifications', listNotifications);
router.get('/reviews', listDoctorReviews);
router.get('/appointments', listAppointments);
router.post('/appointments', createAppointment);
router.patch('/appointments/:id/details', updateAppointmentDetails);
router.post('/presence/heartbeat', heartbeatPresence);
router.post('/presence/offline', setOfflinePresence);

module.exports = router;
