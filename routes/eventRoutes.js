const express = require('express');
const router = express.Router();
const { getEvents, getEventById, createEvent, updateEvent, getAdminOverview } = require('../controllers/eventController');
const { protect, admin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { eventSchema } = require('../utils/schemas');

router.get('/', getEvents);
router.get('/admin/overview', protect, admin, getAdminOverview);
router.get('/:id', getEventById);
router.post('/', protect, admin, validate(eventSchema), createEvent);
router.put('/:id', protect, admin, updateEvent);

module.exports = router;
