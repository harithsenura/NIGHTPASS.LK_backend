const Comment = require('../models/Comment');
const { sanitizeInput } = require('../utils/sanitize');

exports.createComment = async (req, res) => {
  try {
    const { name, email, comment, role } = req.body;
    
    const sanitizedName = sanitizeInput(name);
    const sanitizedComment = sanitizeInput(comment);
    
    const newComment = new Comment({ 
      name: sanitizedName, 
      email, 
      role: role || 'User',
      comment: sanitizedComment 
    });
    
    await newComment.save();
    res.status(201).json({ message: 'Comment submitted successfully', comment: newComment });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting comment', error: error.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const comments = await Comment.find().sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching comments', error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting comment', error: error.message });
  }
};
