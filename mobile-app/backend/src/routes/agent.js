const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { queryAgent, sendMessageToDoctor } = require('../controllers/agentController');
const {
	listConversations,
	saveConversation,
	deleteConversation,
} = require('../controllers/agentConversationController');

router.post('/', protect, queryAgent);
router.post('/send-doctor-message', protect, sendMessageToDoctor);
router.get('/conversations', protect, listConversations);
router.post('/conversations', protect, saveConversation);
router.delete('/conversations/:conversationId', protect, deleteConversation);

module.exports = router;