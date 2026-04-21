const router = require('express').Router();
const { protectDoctor } = require('../middleware/auth');
const {
	getDashboard,
	listCases,
	getCaseById,
	listPatients,
	listCommunityPosts,
	getCommunitySummary,
	listNotifications,
	listDoctorReviews,
} = require('../controllers/doctorController');

router.use(protectDoctor);

router.get('/dashboard', getDashboard);
router.get('/cases', listCases);
router.get('/cases/:id', getCaseById);
router.get('/patients', listPatients);
router.get('/community/posts', listCommunityPosts);
router.get('/community/summary', getCommunitySummary);
router.get('/notifications', listNotifications);
router.get('/reviews', listDoctorReviews);

module.exports = router;
