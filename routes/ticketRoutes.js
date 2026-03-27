const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

// Routes
router.get('/event/:eventId', ticketController.getEventTickets);
router.get('/user/:userId', ticketController.getUserTickets);
router.post('/', ticketController.createTicket);
router.put('/:id', ticketController.updateTicket);
router.delete('/:id', ticketController.deleteTicket);
router.post('/buy', ticketController.buyTickets);
router.post('/test-email', ticketController.testEmail);

module.exports = router;
