const router = require('express').Router();
const { protectDoctor } = require('../middleware/auth');
const { listThreads, getMessages, sendMessage } = require('../controllers/doctorChatController');

router.use(protectDoctor);
router.get('/threads', listThreads);
router.get('/threads/:threadId/messages', getMessages);
router.post('/threads/:threadId/messages', sendMessage);

module.exports = router;