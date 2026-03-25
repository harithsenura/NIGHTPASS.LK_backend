const express = require('express');
const router = express.Router();
const { getEvents, getEventById, createEvent, updateEvent, getAdminOverview } = require('../controllers/eventController');

router.get('/', getEvents);
router.get('/admin/overview', getAdminOverview);
router.get('/:id/full', getEventFullDetails);
router.get('/:id', getEventById);

router.post('/', createEvent);
router.put('/:id', updateEvent);

module.exports = router;
