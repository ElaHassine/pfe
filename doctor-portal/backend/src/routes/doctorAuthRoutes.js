const router = require('express').Router();
const { protectDoctor } = require('../middleware/auth');
const { login, register, me, updateMe, resetPassword } = require('../controllers/doctorAuthController');

router.post('/register', register);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.get('/me', protectDoctor, me);
router.patch('/me', protectDoctor, updateMe);

module.exports = router;