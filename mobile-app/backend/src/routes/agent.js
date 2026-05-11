const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { queryAgent } = require('../controllers/agentController');

router.post('/', protect, queryAgent);

module.exports = router;