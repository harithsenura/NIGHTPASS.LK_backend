const express = require('express');
const router = express.Router();
const { getEvents, getEventById, createEvent, updateEvent, deleteEvent, getAdminOverview, getEventImage, getMyEvents } = require('../controllers/eventController');
const { protect, admin, adminOrOrganizer } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { eventSchema } = require('../utils/schemas');

router.get('/', getEvents);
router.get('/admin/overview', protect, admin, getAdminOverview);
router.get('/my-events', protect, adminOrOrganizer, getMyEvents);
router.get('/:id/image', getEventImage);
router.get('/:id', getEventById);
router.post('/', protect, adminOrOrganizer, validate(eventSchema), createEvent);
router.put('/:id', protect, adminOrOrganizer, updateEvent);
router.delete('/:id', protect, adminOrOrganizer, deleteEvent);

module.exports = router;
