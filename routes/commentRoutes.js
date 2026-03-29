const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { commentSchema } = require('../utils/schemas');

router.post('/', protect, validate(commentSchema), commentController.createComment);
router.get('/', commentController.getComments);

module.exports = router;
