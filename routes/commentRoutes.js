const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { protect, admin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { commentSchema } = require('../utils/schemas');

router.post('/', validate(commentSchema), commentController.createComment);
router.get('/', commentController.getComments);
router.delete('/:id', protect, admin, commentController.deleteComment);

module.exports = router;
