const router = require('express').Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/imageUpload');
const {
  listFeed,
  createPost,
  getPostById,
  updatePost,
  deletePost,
  addComment,
  addReply,
  updateComment,
  deleteComment,
  savePost,
  unsavePost,
  likeComment,
  unlikeComment,
  likePost,
  unlikePost,
  getComments,
} = require('../controllers/communityController');

router.use(protect);
router.get('/posts', listFeed);
router.post('/posts', upload.single('image'), createPost);
router.get('/posts/:postId', getPostById);
router.put('/posts/:postId', updatePost);
router.delete('/posts/:postId', deletePost);
router.get('/posts/:postId/comments', getComments);
router.post('/posts/:postId/comments', addComment);
router.post('/posts/:postId/comments/:commentId/replies', addReply);
router.put('/posts/:postId/comments/:commentId', updateComment);
router.delete('/posts/:postId/comments/:commentId', deleteComment);
router.post('/posts/:postId/save', savePost);
router.delete('/posts/:postId/save', unsavePost);
router.post('/posts/:postId/comments/:commentId/like', likeComment);
router.delete('/posts/:postId/comments/:commentId/like', unlikeComment);
router.post('/posts/:postId/like', likePost);
router.delete('/posts/:postId/like', unlikePost);

module.exports = router;
