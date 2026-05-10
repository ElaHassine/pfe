const router = require('express').Router();
const { protectDoctor } = require('../middleware/auth');
const { listDoctorBlogs, getBlogById, createBlog, updateBlog, deleteBlog } = require('../controllers/blogController');

router.use(protectDoctor);
router.get('/', listDoctorBlogs);
router.get('/:blogId', getBlogById);
router.post('/', createBlog);
router.patch('/:blogId', updateBlog);
router.delete('/:blogId', deleteBlog);

module.exports = router;