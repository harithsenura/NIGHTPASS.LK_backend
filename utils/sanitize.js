const sanitizeHtml = require('sanitize-html');

/**
 * Sanitizes input string to prevent XSS.
 * Removes all HTML tags by default.
 * @param {string} text - The text to sanitize.
 * @returns {string} - Cleaned text.
 */
const sanitizeInput = (text) => {
  if (typeof text !== 'string') return text;
  
  return sanitizeHtml(text, {
    allowedTags: [], // Don't allow any HTML tags
    allowedAttributes: {}, // Don't allow any attributes
    disallowedTagsMode: 'discard' // Completely remove tags
  }).trim();
};

module.exports = { sanitizeInput };
