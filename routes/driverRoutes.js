const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { verifyToken, verifyRole } = require('../middleware/auth');
const {
  validateDriverLogin,
  validateStartRide,
  validateEndRide,
  sanitizeInput,
} = require('../middleware/validation');
const { authLimiter, apiLimiter } = require('../middleware/security');

// Public routes
router.post(
  '/login',
  authLimiter,
  sanitizeInput,
  validateDriverLogin,
  driverController.login
);

// Protected routes
router.use(verifyToken);
router.use(verifyRole('driver'));

router.get('/rides/assigned', apiLimiter, driverController.getAssignedRides);

router.post(
  '/rides/start',
  apiLimiter,
  sanitizeInput,
  validateStartRide,
  driverController.startRide
);

router.post(
  '/rides/end',
  apiLimiter,
  sanitizeInput,
  validateEndRide,
  driverController.endRide
);

router.get('/rides/history', apiLimiter, driverController.getRideHistory);

router.get('/stats/daily', apiLimiter, driverController.getDailyStats);

module.exports = router;
