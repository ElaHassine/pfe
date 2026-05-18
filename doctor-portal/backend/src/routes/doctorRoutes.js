const router = require('express').Router();
const { protectDoctor } = require('../middleware/auth');
const upload = require('../middleware/imageUpload');
const {
        getDashboard,
        listCases,
        getCaseById,
        listPatients,
        getPatientHistory,
        getCommunitySummary,
        listNotifications,
        listDoctorReviews,
        listAppointments,
        createAppointment,
        updateAppointmentDetails,
        heartbeatPresence,
        setOfflinePresence,
} = require('../controllers/doctorController');
const {
        listFeed,
        createPost,
        updatePost,
        deletePost,
        getPostById,
        addComment,
        getComments,
        addReply,
        updateComment,
        deleteComment,
        likePost,
        unlikePost,
        likeComment,
        unlikeComment,
        savePost,
        unsavePost,
} = require('../controllers/doctorCommunityController');
const { submitScanReview } = require('../controllers/scanReviewController');

router.use(protectDoctor);

router.get('/dashboard', getDashboard);
router.get('/cases', listCases);
router.get('/cases/:id', getCaseById);
router.post('/cases/:scanId/review', submitScanReview);
router.get('/patients', listPatients);
router.get('/patients/:id/history', getPatientHistory);
router.get('/community/posts', listFeed);
router.post('/community/posts', upload.single('image'), createPost);
router.get('/community/posts/:postId', getPostById);
router.post('/community/posts/:postId/comments', addComment);
router.get('/community/posts/:postId/comments', getComments);
router.post('/community/posts/:postId/comments/:commentId/replies', addReply);
router.patch('/community/posts/:postId', updatePost);
router.delete('/community/posts/:postId', deletePost);
router.patch('/community/posts/:postId/comments/:commentId', updateComment);
router.delete('/community/posts/:postId/comments/:commentId', deleteComment);
router.post('/community/posts/:postId/like', likePost);
router.delete('/community/posts/:postId/like', unlikePost);
router.post('/community/posts/:postId/comments/:commentId/like', likeComment);
router.delete('/community/posts/:postId/comments/:commentId/like', unlikeComment);
router.post('/community/posts/:postId/save', savePost);
router.delete('/community/posts/:postId/save', unsavePost);
router.get('/community/summary', getCommunitySummary);
router.get('/notifications', listNotifications);
router.get('/reviews', listDoctorReviews);
router.get('/appointments', listAppointments);
router.post('/appointments', createAppointment);
router.patch('/appointments/:id/details', updateAppointmentDetails);
router.post('/presence/heartbeat', heartbeatPresence);
router.post('/presence/offline', setOfflinePresence);

module.exports = router;
