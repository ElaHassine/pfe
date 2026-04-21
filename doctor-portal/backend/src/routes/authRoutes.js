const router = require('express').Router();
const { login, register, me, updateMe, googleSignIn, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleSignIn);
router.post('/reset-password', resetPassword);
router.get('/me', protect, me);
router.patch('/me', protect, updateMe);

module.exports = router;
