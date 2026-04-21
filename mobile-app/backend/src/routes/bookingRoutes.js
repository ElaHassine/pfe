const router = require('express').Router();
const { protect, protectDoctor } = require('../middleware/auth');
const {
  createRequest,
  listMyRequests,
  listRequestsForDoctors,
  listMyAppointments,
  suggestTime,
  respondToSuggestion,
  cancelAppointment,
} = require('../controllers/bookingController');

router.post('/request', protect, createRequest);
router.get('/me', protect, listMyRequests);
router.get('/me/appointments', protect, listMyAppointments);
router.get('/doctor', protectDoctor, listRequestsForDoctors);
router.patch('/doctor/:requestId/suggest-time', protectDoctor, suggestTime);
router.patch('/me/:requestId/respond', protect, respondToSuggestion);
router.patch('/me/appointments/:requestId/cancel', protect, cancelAppointment);

module.exports = router;