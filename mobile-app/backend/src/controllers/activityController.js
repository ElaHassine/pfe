const asyncHandler = require('../middleware/asyncHandler');
const ActivityEvent = require('../models/ActivityEvent');

exports.listMyActivity = asyncHandler(async (req, res) => {
  const events = await ActivityEvent.find({ patientId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ events });
});

exports.clearMyActivity = asyncHandler(async (req, res) => {
  await ActivityEvent.deleteMany({ patientId: req.user._id });
  res.json({ message: 'Notifications cleared' });
});

exports.deleteMyActivity = asyncHandler(async (req, res) => {
  const deleted = await ActivityEvent.findOneAndDelete({
    _id: req.params.eventId,
    patientId: req.user._id,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.json({ message: 'Notification deleted' });
});
