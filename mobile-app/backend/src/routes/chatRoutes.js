const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  listThreads,
  upsertThread,
  getMessages,
  markThreadAsRead,
  sendMessage,
  setThreadPinned,
} = require('../controllers/chatController');

router.use(protect);
router.get('/threads', listThreads);
router.post('/threads', upsertThread);
router.get('/threads/:threadId/messages', getMessages);
router.post('/threads/:threadId/read', markThreadAsRead);
router.patch('/threads/:threadId/pin', setThreadPinned);
router.post('/threads/:threadId/messages', sendMessage);

module.exports = router;
