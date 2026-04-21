const router = require('express').Router();
const { protect, protectDoctor } = require('../middleware/auth');
const {
  createRequest,
  listMyRequests,
  listRequestsForDoctors,
  suggestTime,
  respondToBooking,
  respondToSuggestion,
} = require('../controllers/bookingController');

router.post('/request', protect, createRequest);
router.get('/me', protect, listMyRequests);
router.get('/doctor', protectDoctor, listRequestsForDoctors);
router.patch('/doctor/:requestId/suggest-time', protectDoctor, suggestTime);
router.patch('/doctor/:requestId/respond', protectDoctor, respondToBooking);
router.patch('/me/:requestId/respond', protect, respondToSuggestion);

module.exports = router;