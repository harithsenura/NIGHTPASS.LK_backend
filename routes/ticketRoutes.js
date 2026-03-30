const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { protect, admin, optionalProtect } = require('../middleware/auth');

// Routes
router.get('/event/:eventId', ticketController.getEventTickets);
router.get('/user/:userId', protect, ticketController.getUserTickets);
router.post('/', protect, admin, ticketController.createTicket);
router.put('/:id', protect, admin, ticketController.updateTicket);
router.delete('/:id', protect, admin, ticketController.deleteTicket);
router.post('/buy', optionalProtect, ticketController.buyTickets);
router.post('/initiate-payhere', optionalProtect, ticketController.initiatePayHerePayment);
router.post('/payhere-notify', ticketController.payhereNotify); // Public webhook
router.post('/test-email', optionalProtect, ticketController.testEmail);

router.post('/find', ticketController.findPurchase); // Keep public for guest find feature

module.exports = router;
