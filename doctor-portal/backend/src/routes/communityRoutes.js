const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  listFeed,
  createPost,
  getPostById,
  addComment,
  likePost,
  unlikePost,
  getComments,
} = require('../controllers/communityController');

router.use(protect);
router.get('/posts', listFeed);
router.post('/posts', createPost);
router.get('/posts/:postId', getPostById);
router.get('/posts/:postId/comments', getComments);
router.post('/posts/:postId/comments', addComment);
router.post('/posts/:postId/like', likePost);
router.delete('/posts/:postId/like', unlikePost);

module.exports = router;
