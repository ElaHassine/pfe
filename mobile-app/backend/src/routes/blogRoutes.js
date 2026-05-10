const router = require('express').Router();
const { listPublishedBlogs, getBlogById } = require('../controllers/blogController');

// Public routes — published blogs are readable by anyone
router.get('/', listPublishedBlogs);
router.get('/:blogId', getBlogById);

module.exports = router;