const asyncHandler = require('../middleware/asyncHandler');
const ActivityEvent = require('../models/ActivityEvent');

exports.listMyActivity = asyncHandler(async (req, res) => {
  const events = await ActivityEvent.find({ patientId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ events });
});
